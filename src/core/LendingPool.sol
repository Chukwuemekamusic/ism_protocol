// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {ILendingPool} from "../interfaces/ILendingPool.sol";
import {IPoolToken} from "src/interfaces/IPoolToken.sol";
import {IOracleRouter} from "src/interfaces/IOracleRouter.sol";
import {IInterestRateModel} from "src/interfaces/IInterestRateModel.sol";
import {MathLib} from "src/libraries/MathLib.sol";
import {Validator} from "src/libraries/Validator.sol";
import {Errors} from "src/libraries/Errors.sol";

/// @title LendingPool
/// @notice Isolated lending pool for a single collateral/borrow pair
/// @dev Each market is a separate instance of this contract
contract LendingPool is ILendingPool, ReentrancyGuard, Ownable {
    using MathLib for uint256;
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 public constant WAD = 1e18;

    /*//////////////////////////////////////////////////////////////
                               IMMUTABLES
    //////////////////////////////////////////////////////////////*/

    // TOKEN REFERENCES
    IERC20 public collateralToken;
    IERC20 public borrowToken;
    IPoolToken public poolToken;

    // CONTRACT REFERENCES
    /// @notice Interest rate model for this pool (shared across all markets)
    IInterestRateModel public interestRateModel;
    /// @notice The oracle router for this pool
    IOracleRouter public oracleRouter;

    // DECIMALS
    uint8 public collateralDecimals;
    uint8 public borrowDecimals;

    // RISK PARAMETERS

    uint64 public ltv; // (e.g., 0.75e18 = 75%)
    uint64 public liquidationThreshold; // (e.g., 0.80e18 = 80%)
    uint64 public liquidationPenalty; // (e.g., 0.05e18 = 5%)
    uint64 public reserveFactor; // (e.g., 0.10e18 = 10%)

    /*//////////////////////////////////////////////////////////////
                               STORAGE
    //////////////////////////////////////////////////////////////*/

    bool private _initialized; // Initialization flag
    address public liquidator; // address of authorized liquidator
    address public factory;

    /// @notice User => Position
    mapping(address => Position) public positions;

    // MARKET STATE
    uint256 public totalCollateral; // Total collateral in the pool
    uint256 public totalBorrowAssets; // Total borrows assets (principal + accrued interest)
    uint256 public totalBorrowShares; // Total borrow shares issued
    uint256 public borrowIndex; // Borrow index (starts at WAD)
    uint256 public lastAccrualTime; // Last time interest was accrued
    uint256 public totalReserves; // Total Protocol reserves
    uint256 public totalSupplyAssets; // Total supply assets (what suppliers deposited + interest)
    uint256 public totalSupplyShares; // Total supply shares
    uint256 public lockedCollateral; // Total collateral locked for liquidation

    /*//////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyLiquidator() {
        if (msg.sender != liquidator) revert Errors.OnlyLiquidator();
        _;
    }

    modifier onlyFactory() {
        if (msg.sender != factory) revert Errors.OnlyFactory();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                             INITIALIZATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Disable initializers for the implementation contract
    /// @dev This prevents anyone from initializing the logic contract itself
    constructor() Ownable(msg.sender) {}

    /// @notice Initialize the pool (called by factory)
    function initialize(MarketConfig calldata config, address _poolToken, address _liquidator, address _factory)
        external
    {
        if (_initialized) revert Errors.AlreadyInitialized();
        _initialized = true;

        {
            Validator.ensureCollateralTokenIsNotZero(config.collateralToken);
            Validator.ensureBorrowTokenIsNotZero(config.borrowToken);
            Validator.ensureTokenIsNotSame(config.collateralToken, config.borrowToken);
            Validator.ensureAddressIsNotZeroAddress(config.interestRateModel);
            Validator.ensureAddressIsNotZeroAddress(config.oracleRouter);
            Validator.ensureAddressIsNotZeroAddress(_poolToken);
            Validator.ensureAddressIsNotZeroAddress(_liquidator);
            Validator.ensureAddressIsNotZeroAddress(_factory);
        }

        collateralToken = IERC20(config.collateralToken);
        borrowToken = IERC20(config.borrowToken);
        poolToken = IPoolToken(_poolToken);
        interestRateModel = IInterestRateModel(config.interestRateModel);
        oracleRouter = IOracleRouter(config.oracleRouter);
        liquidator = _liquidator;
        factory = _factory;

        // cache decimals
        collateralDecimals = _getDecimals(config.collateralToken);
        borrowDecimals = _getDecimals(config.borrowToken);

        // Set risk parameters
        ltv = config.ltv;
        liquidationThreshold = config.liquidationThreshold;
        liquidationPenalty = config.liquidationPenalty;
        reserveFactor = config.reserveFactor;

        // Set initial state
        borrowIndex = WAD;
        lastAccrualTime = block.timestamp;

        emit Initialized(config.collateralToken, config.borrowToken, config.interestRateModel, config.oracleRouter);
    }

    /*//////////////////////////////////////////////////////////////
                            INTEREST ACCRUAL
    //////////////////////////////////////////////////////////////*/

    /// @notice Accrue interest since last update
    /// @dev This function is called automatically before any state-changing action
    function accrueInterest() public {
        uint256 timeElapsed = block.timestamp - lastAccrualTime;
        if (timeElapsed == 0) return;

        lastAccrualTime = block.timestamp;

        if (totalBorrowAssets == 0) return;

        // Get current borrow rate
        uint256 borrowRate = interestRateModel.getBorrowRate(totalSupplyAssets, totalBorrowAssets);

        // Calculate interest factor: (1 + rate × time)
        uint256 interestFactor = WAD + (borrowRate * timeElapsed);

        // Update borrow index (compounds interest)
        borrowIndex = borrowIndex.mulWadDown(interestFactor);

        // Update total borrows
        uint256 interestAccrued = totalBorrowAssets.mulWadDown(interestFactor) - totalBorrowAssets;
        totalBorrowAssets += interestAccrued;

        // Extract protocol reserve
        uint256 reserveAmount = interestAccrued.mulWadDown(reserveFactor);
        totalReserves += reserveAmount;

        // Remaining interest is added to totalSupplyAssets (suppliers)
        totalSupplyAssets += (interestAccrued - reserveAmount);

        emit InterestAccrued(borrowIndex, totalBorrowAssets, reserveAmount);
    }

    /*//////////////////////////////////////////////////////////////
                        SUPPLY OPERATIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Deposit borrow tokens to earn interest
    /// @param assets Amount of borrow tokens to deposit
    /// @return shares Amount of pool shares received
    function deposit(uint256 assets) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert Errors.ZeroAmount();

        accrueInterest();

        // Calculate shares to mint
        shares = _convertToShares(assets, totalSupplyAssets, totalSupplyShares, false);

        // Update state
        totalSupplyAssets += assets;
        totalSupplyShares += shares;

        // Transfer tokens in
        borrowToken.safeTransferFrom(msg.sender, address(this), assets);

        // Mint pool tokens
        poolToken.mint(msg.sender, shares);

        emit Deposit(msg.sender, assets, shares);
    }

    /// @notice Withdraw borrow tokens
    /// @param assets Amount of borrow tokens to withdraw
    /// @return shares Amount of pool shares burned
    function withdraw(uint256 assets) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert Errors.ZeroAmount();

        accrueInterest();

        // Calculate shares to burn
        shares = _convertToShares(assets, totalSupplyAssets, totalSupplyShares, true);

        // Check liquidity
        uint256 availableLiquidity = totalSupplyAssets - totalBorrowAssets;
        if (assets > availableLiquidity) revert Errors.InsufficientLiquidity();

        // Check user has enough shares
        if (poolToken.balanceOf(msg.sender) < shares) revert Errors.InsufficientBalance();

        // Update state
        totalSupplyAssets -= assets;
        totalSupplyShares -= shares;

        // Burn pool tokens
        poolToken.burn(msg.sender, shares);
        // Transfer tokens out
        borrowToken.safeTransfer(msg.sender, assets);

        emit Withdraw(msg.sender, assets, shares);
    }

    /*//////////////////////////////////////////////////////////////
                       COLLATERAL OPERATIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Deposit collateral
    /// @param amount Amount of collateral to deposit
    function depositCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert Errors.ZeroAmount();

        // Update state
        positions[msg.sender].collateralAmount += uint128(amount);
        totalCollateral += amount;

        // Transfer collateral in
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);

        emit DepositCollateral(msg.sender, amount);
    }

    /// @notice Withdraw collateral
    /// @param amount Amount of collateral to withdraw
    function withdrawCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert Errors.ZeroAmount();

        accrueInterest();

        Position storage pos = positions[msg.sender];

        // Check balance
        if (pos.collateralAmount < amount) revert Errors.InsufficientBalance();

        // Check if withdrawal would make position unhealthy
        uint256 newCollateral = pos.collateralAmount - amount;
        if (pos.borrowShares > 0) {
            uint256 newHf = _calculateHealthFactor(newCollateral, pos.borrowShares);
            if (newHf < WAD) revert Errors.WouldBeUndercollateralized();
        }

        // Update state
        pos.collateralAmount = uint128(newCollateral);
        totalCollateral -= amount;

        // Transfer collateral out
        collateralToken.safeTransfer(msg.sender, amount);

        emit WithdrawCollateral(msg.sender, amount);
    }

    /*//////////////////////////////////////////////////////////////
                           BORROW OPERATIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Borrow assets against deposited collateral
    /// @param amount Amount of borrow tokens to borrow
    /// @return shares Amount of borrow shares created
    function borrow(uint256 amount) external nonReentrant returns (uint256 shares) {
        Validator.ensureValueIsNotZero(amount);

        accrueInterest();

        Position storage pos = positions[msg.sender];

        // check liquidity
        uint256 availableLiquidity = totalSupplyAssets - totalBorrowAssets;
        if (amount > availableLiquidity) revert Errors.InsufficientLiquidity();

        // Calculate shares to mint
        shares = _convertToBorrowShares(amount, false);

        // Check if borrow would exceed LTV
        uint256 newBorrowShares = pos.borrowShares + shares;
        uint256 maxBorrowValue = _getMaxBorrowValue(pos.collateralAmount);
        uint256 newDebtValue = _getBorrowValue(newBorrowShares);
        if (newDebtValue > maxBorrowValue) revert Errors.WouldBeUndercollateralized();

        // Update state
        pos.borrowShares = uint128(newBorrowShares);
        totalBorrowAssets += amount;
        totalBorrowShares += shares;

        // Transfer tokens in
        borrowToken.safeTransfer(msg.sender, amount);

        emit Borrow(msg.sender, amount, shares);
    }

    /// @notice Repay borrowed assets
    /// @param amount Amount of borrow tokens to repay (use type(uint256).max for full repay)
    /// @return shares Amount of borrow shares burned
    function repay(uint256 amount) external nonReentrant returns (uint256 shares) {
        return _repay(msg.sender, msg.sender, amount);
    }

    /// @notice Repay borrowed assets on behalf of another user
    /// @param onBehalfOf User whose debt to repay
    /// @param amount Amount to repay
    /// @return shares Amount of borrow shares burned
    function repayOnBehalf(address onBehalfOf, uint256 amount) external nonReentrant returns (uint256 shares) {
        Validator.ensureAddressIsNotZeroAddress(onBehalfOf);
        return _repay(onBehalfOf, msg.sender, amount);
    }

    /*//////////////////////////////////////////////////////////////
                          LIQUIDATION SUPPORT
    //////////////////////////////////////////////////////////////*/
    /// @notice Set the liquidator contract (admin only)
    function setLiquidator(address _liquidator) external onlyOwner {
        require(_liquidator != address(0), "Invalid liquidator");
        liquidator = _liquidator;
    }

    /// @notice Lock collateral for an active liquidation auction
    /// @param user The user whose collateral to lock
    /// @param amount The amount to lock
    function lockCollateralForLiquidation(address user, uint256 amount) external onlyLiquidator {
        Position storage pos = positions[user];
        if (pos.collateralAmount < amount) revert Errors.InsufficientCollateral();

        pos.collateralAmount -= uint128(amount);
        lockedCollateral += amount;

        emit CollateralLocked(user, amount);
    }

    /// @notice Unlock collateral after auction cancellation
    /// @param user The user whose collateral to unlock
    /// @param amount The amount to unlock
    function unlockCollateralAfterLiquidation(address user, uint256 amount) external onlyLiquidator {
        if (lockedCollateral < amount) revert Errors.InsufficientLocked();

        positions[user].collateralAmount += uint128(amount);
        lockedCollateral -= amount;

        emit CollateralUnlocked(user, amount);
    }

    /// @notice Execute a liquidation (called by liquidator contract)
    /// @param user The user being liquidated
    /// @param liquidatorAddr The liquidator receiving collateral
    /// @param debtRepaid Amount of debt being repaid
    /// @param collateralSeized Amount of collateral being seized
    function executeLiquidation(address user, address liquidatorAddr, uint256 debtRepaid, uint256 collateralSeized)
        external
        onlyLiquidator
        nonReentrant
    {
        accrueInterest();

        Position storage pos = positions[user];

        // Calculate shares to burn
        uint256 sharesToBurn = debtRepaid.divWadUp(borrowIndex);
        if (sharesToBurn > pos.borrowShares) {
            sharesToBurn = pos.borrowShares;
        }

        // Update state
        pos.borrowShares -= uint128(sharesToBurn);
        totalBorrowShares -= sharesToBurn;
        totalBorrowAssets -= debtRepaid;
        lockedCollateral -= collateralSeized;

        // Transfer collateral to liquidator
        collateralToken.safeTransfer(liquidatorAddr, collateralSeized);

        emit Liquidation(user, liquidatorAddr, debtRepaid, collateralSeized);
    }

    /// @notice Check if position has locked collateral (in active auction)
    function hasLockedCollateral(address user) external view returns (bool) {
        // This would need tracking per user - simplified version
        return lockedCollateral > 0;
    }

    /*//////////////////////////////////////////////////////////////
                         VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get a user's position
    function getPosition(address user) external view returns (Position memory) {
        return positions[user];
    }

    /// @notice Get user's current debt including accrued interest
    function getUserDebt(address user) external view returns (uint256) {
        uint256 borrowShares = positions[user].borrowShares;
        return _getDebt(borrowShares);
    }

    /// @notice Get user's health factor (simulated with current prices)
    function healthFactor(address user) external view returns (uint256) {
        return _healthFactor(user);
    }

    /// @notice Check if a position can be liquidated
    function isLiquidatable(address user) external view returns (bool) {
        return _healthFactor(user) < WAD;
    }

    /// @notice Convert supply assets to shares
    function convertToShares(uint256 assets) external view returns (uint256) {
        return _convertToShares(assets, totalSupplyAssets, totalSupplyShares, false);
    }

    /// @notice Convert supply shares to assets
    function convertToAssets(uint256 shares) external view returns (uint256) {
        return _convertToAssets(shares, totalSupplyAssets, totalSupplyShares, false);
    }

    /// @notice Get user's underlying asset balance (convenience function)
    /// @param user Address to query
    /// @return Underlying asset value of user's pool token shares
    function balanceOfUnderlying(address user) external view returns (uint256) {
        uint256 shares = poolToken.balanceOf(user);
        return _convertToAssets(shares, totalSupplyAssets, totalSupplyShares, false);
    }

    /// @notice Get User's max additional borrow amount
    function getMaxBorrow(address user) external view returns (uint256) {
        Position memory pos = positions[user];
        uint256 maxBorrowValue = _getMaxBorrowValue(pos.collateralAmount);
        uint256 currentDebtValue = _getBorrowValueWithAccrual(pos.borrowShares);

        if (maxBorrowValue <= currentDebtValue) return 0;

        uint256 remainingBorrowValue = maxBorrowValue - currentDebtValue;
        uint256 borrowPrice = _getPrice(address(borrowToken));

        // Convert value back to borrow token amount
        uint256 maxAmount = remainingBorrowValue * (10 ** borrowDecimals) / borrowPrice;

        // Cap at available liquidity
        uint256 availableLiquidity = totalSupplyAssets - totalBorrowAssets;
        return MathLib.min(maxAmount, availableLiquidity);
    }

    /*//////////////////////////////////////////////////////////////
                        INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get user's current debt including accrued interest
    function _getDebt(uint256 borrowShares) internal view returns (uint256) {
        return borrowShares.mulWadUp(_simulateAccrual());
    }

    /// @notice Convert assets to shares
    function _convertToShares(uint256 assets, uint256 totalAssets, uint256 totalShares, bool roundUp)
        internal
        pure
        returns (uint256)
    {
        if (totalShares == 0 || totalAssets == 0) {
            return assets; // 1:1 initially
        }
        if (roundUp) {
            // assets * totalShares / totalAssets
            return assets.mulWadUp(totalShares).divWadUp(totalAssets);
        }
        // assets * totalShares / totalAssets
        return assets.mulWadDown(totalShares).divWadDown(totalAssets);
    }

    /// @notice Convert shares to assets
    function _convertToAssets(uint256 shares, uint256 totalAssets, uint256 totalShares, bool roundUp)
        internal
        pure
        returns (uint256)
    {
        if (totalShares == 0) {
            return shares; // 1:1 initially
        }
        if (roundUp) {
            // shares * totalAssets / totalShares
            return shares.mulWadUp(totalAssets).divWadUp(totalShares);
        }
        // shares * totalAssets / totalShares
        return shares.mulWadDown(totalAssets).divWadDown(totalShares);
    }

    /// @notice Get user's health factor (simulated with current prices)
    function _healthFactor(address user) internal view returns (uint256) {
        Position memory pos = positions[user];
        if (pos.borrowShares == 0) return type(uint256).max;

        return _calculateHealthFactor(pos.collateralAmount, pos.borrowShares);
    }

    /// @notice Calculate health factor for given collateral and borrow shares
    function _calculateHealthFactor(uint256 collateralAmount, uint256 borrowShares) internal view returns (uint256) {
        if (borrowShares == 0) return type(uint256).max;

        // Calculate values in common denomination (18 decimals)
        uint256 collateralValue = _getCollateralValue(collateralAmount);
        uint256 debtValue = _getBorrowValueWithAccrual(borrowShares);

        // healthFactor = (collateralValue * liquidationThreshold) / debtValue
        return collateralValue.mulWadDown(liquidationThreshold).divWadDown(debtValue);
    }

    /// @notice Simulate interest accrual for view functions
    function _simulateAccrual() internal view returns (uint256) {
        uint256 timeElapsed = block.timestamp - lastAccrualTime;
        if (timeElapsed == 0) return borrowIndex;

        uint256 borrowRate = interestRateModel.getBorrowRate(totalSupplyAssets, totalBorrowAssets);

        uint256 interestFactor = WAD + (borrowRate * timeElapsed);
        return borrowIndex.mulWadDown(interestFactor);
    }

    function _getPrice(address token) internal view returns (uint256) {
        return oracleRouter.getPrice(token);
    }

    /// @notice Get collateral value in common denomination (18 decimals)
    function _getCollateralValue(uint256 amount) internal view returns (uint256) {
        uint256 collateralPrice = _getPrice(address(collateralToken));
        return amount * collateralPrice / (10 ** collateralDecimals);
    }

    function _getTokenValue(address token, uint256 amount) internal view returns (uint256) {
        uint256 price = _getPrice(token);
        uint8 decimals = _getDecimals(token);
        return amount * price / (10 ** decimals);
    }

    /// @notice Get decimals for a token
    function _getDecimals(address token) internal view returns (uint8) {
        (bool success, bytes memory data) = token.staticcall(abi.encodeWithSignature("decimals()"));
        if (success && data.length == 32) {
            return abi.decode(data, (uint8));
        }
        return 18; // Default to 18 if call fails
    }

    /*//////////////////////////////////////////////////////////////
                        BORROW HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _repay(address borrower, address payer, uint256 amount) internal returns (uint256) {
        accrueInterest();

        Position storage pos = positions[borrower];
        if (pos.borrowShares == 0) revert Errors.NoDebt();

        // handle max repay
        uint256 currentDebt = _getDebt(pos.borrowShares);
        if (amount == type(uint256).max || amount > currentDebt) {
            amount = currentDebt;
        }

        // Calculate shares to burn
        uint256 shares = _convertToBorrowShares(amount, true);

        // Cap shares at user's shares (handles dust)
        shares = MathLib.min(shares, pos.borrowShares);

        uint256 newBorrowShares = pos.borrowShares - shares;

        // Update state
        pos.borrowShares = uint128(newBorrowShares);
        totalBorrowAssets -= amount;
        totalBorrowShares -= shares;

        // Transfer tokens out
        borrowToken.safeTransferFrom(payer, address(this), amount);

        emit Repay(borrower, payer, amount, shares);

        return shares;
    }

    /// @notice Convert borrow assets to shares
    function _convertToBorrowShares(uint256 assets, bool roundUp) internal view returns (uint256) {
        if (totalBorrowShares == 0) {
            return assets; // 1:1 initially
        }
        if (roundUp) {
            // assets / borrowIndex
            return assets.divWadUp(borrowIndex);
        }
        // assets / borrowIndex
        return assets.divWadDown(borrowIndex);
    }

    /// @notice Convert borrow shares to assets
    function _convertToBorrowAssets(uint256 shares, bool roundUp) internal view returns (uint256) {
        if (roundUp) {
            // shares * borrowIndex
            return shares.mulWadUp(borrowIndex);
        }
        // shares * borrowIndex
        return shares.mulWadDown(borrowIndex);
    }

    /// @notice Get maximum borrow value for given collateral
    function _getMaxBorrowValue(uint256 collateralAmount) internal view returns (uint256) {
        uint256 collateralValue = _getCollateralValue(collateralAmount);
        return collateralValue.mulWadDown(ltv);
    }

    /// @notice Get current borrow value for given shares
    function _getBorrowValue(uint256 borrowShares) internal view returns (uint256) {
        uint256 borrowPrice = _getPrice(address(borrowToken));
        uint256 debtAmount = borrowShares.mulWadUp(borrowIndex);
        return debtAmount * borrowPrice / (10 ** borrowDecimals);
    }

    /// @notice Get borrow value in common denomination (18 decimals) with simulated accrual
    function _getBorrowValueWithAccrual(uint256 borrowShares) internal view returns (uint256) {
        uint256 borrowPrice = _getPrice(address(borrowToken));
        uint256 currentIndex = _simulateAccrual();
        uint256 debtAmount = borrowShares.mulWadUp(currentIndex);
        return debtAmount * borrowPrice / (10 ** borrowDecimals);
    }
}
