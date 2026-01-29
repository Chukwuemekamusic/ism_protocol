// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IPoolToken} from "src/interfaces/IPoolToken.sol";
import {IOracleRouter} from "src/interfaces/IOracleRouter.sol";
import {IInterestRateModel} from "src/interfaces/IInterestRateModel.sol";
import {MathLib} from "src/libraries/MathLib.sol";
import {Validator} from "src/libraries/Validator.sol";
import {Errors} from "src/libraries/Errors.sol";

contract LendingPool is ReentrancyGuard {
    using MathLib for uint256;
    using SafeERC20 for IERC20;

    error ZeroAmount();
    error WouldBeUndercollateralized();

    struct Position {
        uint128 collateralAmount; // Native decimals
        uint128 borrowShares; // 18 decimals
    }

    uint256 public constant WAD = 1e18;

    IERC20 public immutable collateralToken;
    IERC20 public immutable borrowToken;
    IInterestRateModel public immutable interestRateModel;
    IOracleRouter public immutable oracleRouter;
    IPoolToken public immutable poolToken;

    uint8 public immutable collateralDecimals;
    uint8 public immutable borrowDecimals;
    uint256 public immutable borrowScalar; // Used to scale assets to 18 decimals

    uint64 public immutable ltv;
    uint64 public immutable liquidationThreshold;
    uint64 public immutable reserveFactor;

    mapping(address => Position) public positions;
    uint256 public totalCollateral;
    uint256 public totalBorrowAssets; // Native decimals
    uint256 public totalBorrowShares; // 18 decimals
    uint256 public borrowIndex; // 18 decimals
    uint256 public lastAccrualTime;
    uint256 public totalReserves; // Native decimals
    uint256 public totalSupplyAssets; // Native decimals
    uint256 public totalSupplyShares; // 18 decimals

    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, uint256 assets, uint256 shares);
    event InterestAccrued(uint256 newBorrowIndex, uint256 totalBorrows, uint256 reserves);
    event Borrow(address indexed user, uint256 assets, uint256 shares);
    event Repay(address indexed user, address indexed payer, uint256 assets, uint256 shares);

    constructor(
        address _collateralToken,
        address _borrowToken,
        address _interestRateModel,
        address _oracleRouter,
        address _poolToken,
        uint64 _ltv,
        uint64 _liquidationThreshold,
        uint64 _liquidationPenalty,
        uint64 _reserveFactor
    ) {
        collateralToken = IERC20(_collateralToken);
        borrowToken = IERC20(_borrowToken);
        interestRateModel = IInterestRateModel(_interestRateModel);
        oracleRouter = IOracleRouter(_oracleRouter);
        poolToken = IPoolToken(_poolToken);

        collateralDecimals = _getDecimals(_collateralToken);
        borrowDecimals = _getDecimals(_borrowToken);
        // If USDC (6 decimals), scalar is 10^12. If WETH (18), scalar is 1.
        borrowScalar = 10 ** (18 - borrowDecimals);

        ltv = _ltv;
        liquidationThreshold = _liquidationThreshold;
        reserveFactor = _reserveFactor;

        borrowIndex = WAD;
        lastAccrualTime = block.timestamp;
    }

    /*//////////////////////////////////////////////////////////////
                            INTEREST ACCRUAL
    //////////////////////////////////////////////////////////////*/

    function accrueInterest() public {
        uint256 timeElapsed = block.timestamp - lastAccrualTime;
        if (timeElapsed == 0) return;

        uint256 borrowRate = interestRateModel.getBorrowRate(totalSupplyAssets, totalBorrowAssets);
        uint256 interestFactor = WAD + (borrowRate * timeElapsed);

        // Update global debt
        uint256 newBorrowAssets = totalBorrowAssets.mulWadDown(interestFactor);
        uint256 interestAccrued = newBorrowAssets - totalBorrowAssets;

        borrowIndex = borrowIndex.mulWadDown(interestFactor);
        totalBorrowAssets = newBorrowAssets;

        uint256 reserveAmount = interestAccrued.mulWadDown(reserveFactor);
        totalReserves += reserveAmount;
        totalSupplyAssets += (interestAccrued - reserveAmount);

        lastAccrualTime = block.timestamp;
        emit InterestAccrued(borrowIndex, totalBorrowAssets, reserveAmount);
    }

    /*//////////////////////////////////////////////////////////////
                        SUPPLY OPERATIONS
    //////////////////////////////////////////////////////////////*/

    function deposit(uint256 assets) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        accrueInterest();

        shares = _convertToShares(assets, totalSupplyAssets, totalSupplyShares, false);

        totalSupplyAssets += assets;
        totalSupplyShares += shares;

        borrowToken.safeTransferFrom(msg.sender, address(this), assets);
        poolToken.mint(msg.sender, shares);

        emit Deposit(msg.sender, assets, shares);
    }

    function withdraw(uint256 assets) external nonReentrant returns (uint256 shares) {
        accrueInterest();

        shares = _convertToShares(assets, totalSupplyAssets, totalSupplyShares, true);

        if (assets > (totalSupplyAssets - totalBorrowAssets)) revert Errors.InsufficientLiquidity();
        if (poolToken.balanceOf(msg.sender) < shares) revert Errors.InsufficientBalance();

        totalSupplyAssets -= assets;
        totalSupplyShares -= shares;

        poolToken.burn(msg.sender, shares);
        borrowToken.safeTransfer(msg.sender, assets);

        emit Withdraw(msg.sender, assets, shares);
    }

    /*//////////////////////////////////////////////////////////////
                       BORROW OPERATIONS
    //////////////////////////////////////////////////////////////*/

    function borrow(uint256 amount) external nonReentrant returns (uint256 shares) {
        accrueInterest();

        if (amount > (totalSupplyAssets - totalBorrowAssets)) revert Errors.InsufficientLiquidity();

        shares = _convertToBorrowShares(amount, true); // Round up shares for protocol safety
        Position storage pos = positions[msg.sender];

        uint256 newBorrowShares = pos.borrowShares + shares;

        // Health Check
        if (_calculateHealthFactor(pos.collateralAmount, newBorrowShares) < WAD) {
            revert WouldBeUndercollateralized();
        }

        pos.borrowShares = uint128(newBorrowShares);
        totalBorrowAssets += amount;
        totalBorrowShares += shares;

        borrowToken.safeTransfer(msg.sender, amount);
        emit Borrow(msg.sender, amount, shares);
    }

    /*//////////////////////////////////////////////////////////////
                        INTERNAL MATH
    //////////////////////////////////////////////////////////////*/

    function _convertToShares(uint256 assets, uint256 totalAssets, uint256 totalShares, bool roundUp)
        internal
        view
        returns (uint256)
    {
        if (totalShares == 0) return assets * borrowScalar;

        // Using mulDiv to handle the 18-decimal scaling correctly
        return roundUp
            ? assets.mulDivUp(totalShares + 1, totalAssets + 1)
            : assets.mulDivDown(totalShares + 1, totalAssets + 1);
    }

    function _convertToBorrowShares(uint256 assets, bool roundUp) internal view returns (uint256) {
        // assets (native) -> shares (18)
        // Formula: (assets * scalar) / (borrowIndex / WAD)
        // Or simplified: assets * scalar * WAD / borrowIndex
        uint256 scaledAssets = assets * borrowScalar;
        return roundUp ? scaledAssets.divWadUp(borrowIndex) : scaledAssets.divWadDown(borrowIndex);
    }

    function _calculateHealthFactor(uint256 collateralAmount, uint256 borrowShares) internal view returns (uint256) {
        if (borrowShares == 0) return type(uint256).max;

        // 1. Get Collateral Value in WAD
        uint256 collPrice = oracleRouter.getPrice(address(collateralToken));
        uint256 collateralValueWad = (collateralAmount * collPrice) / (10 ** collateralDecimals);

        // 2. Get Debt Value in WAD
        uint256 borrowPrice = oracleRouter.getPrice(address(borrowToken));
        // borrowShares is 18 decimals, borrowIndex is 18 decimals
        uint256 debtAmountWad = borrowShares.mulWadUp(_simulateAccrual());
        // Normalize debt amount (which is currently scaled) back to value
        uint256 debtValueWad = (debtAmountWad * borrowPrice) / (10 ** 18);

        return collateralValueWad.mulWadDown(liquidationThreshold).divWadDown(debtValueWad);
    }

    function _simulateAccrual() internal view returns (uint256) {
        uint256 timeElapsed = block.timestamp - lastAccrualTime;
        if (timeElapsed == 0) return borrowIndex;
        uint256 borrowRate = interestRateModel.getBorrowRate(totalSupplyAssets, totalBorrowAssets);
        return borrowIndex.mulWadDown(WAD + (borrowRate * timeElapsed));
    }

    function _getDecimals(address token) internal view returns (uint8) {
        (bool success, bytes memory data) = token.staticcall(abi.encodeWithSignature("decimals()"));
        return (success && data.length == 32) ? abi.decode(data, (uint8)) : 18;
    }
}
