// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {DeploymentHelper} from "../DeploymentHelper.sol";
import {IMarketRegistry} from "src/interfaces/IMarketRegistry.sol";
import {ILendingPool} from "src/interfaces/ILendingPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// forge script script/interactions/Interactions.s.sol:getAllMarkets \
// --rpc-url $BASE_SEPOLIA_RPC_URL \
// --account testnet

// this interacts directly with the MarketRegistry contract to get all markets
contract getAllMarkets is DeploymentHelper {
    function run() external view {
        // Load core deployment
        CoreDeployment memory deployment = loadDeployment();

        // Get all markets from the registry
        address[] memory markets = IMarketRegistry(deployment.marketRegistry).getActiveMarkets();

        // Log the markets
        console.log("Active Markets:", markets.length);
        for (uint256 i = 0; i < markets.length; i++) {
            console.log("  -", markets[i]);
        }
    }
}

// forge script script/interactions/Interactions.s.sol:supplySpecificMarket \
// --sig "run(address)" $MARKET \
// --rpc-url $BASE_SEPOLIA_RPC_URL \
// --account testnet \
// --broadcast

// this interacts directly with a specific market to supply borrow tokens (earn interest)
contract supplySpecificMarket is Script {
    function run(address market) external {
        // Get the market
        ILendingPool marketContract = ILendingPool(market);

        // Get the borrow token from the market
        IERC20 borrowToken = marketContract.borrowToken();

        // Amount to supply (10 USDC assuming 6 decimals)
        uint256 supplyAmount = 10e6;

        console.log("========== Supply to Market ==========");
        console.log("Market:", market);
        console.log("Borrow Token:", address(borrowToken));
        console.log("Supply Amount:", supplyAmount);
        console.log("=====================================\n");

        vm.startBroadcast();

        // Step 1: Approve the market to spend borrow tokens
        console.log("Step 1: Approving borrow token...");
        borrowToken.approve(market, supplyAmount);
        console.log("Approved:", supplyAmount);

        // Step 2: Deposit borrow tokens to earn interest
        console.log("\nStep 2: Depositing to market...");
        uint256 shares = marketContract.deposit(supplyAmount);
        console.log("Shares received:", shares);

        vm.stopBroadcast();

        console.log("\nSuccessfully supplied", supplyAmount, "tokens to market");
        console.log("Received", shares, "pool token shares");
    }
}

contract depositCollateral is Script {
    function run(address market, uint256 amount) external {
        // Get the market
        ILendingPool marketContract = ILendingPool(market);

        // Get the collateral token from the market
        IERC20 collateralToken = marketContract.collateralToken();

        console.log("========== Deposit Collateral ==========");
        console.log("Market:", market);
        console.log("Collateral Token:", address(collateralToken));
        console.log("Deposit Amount:", amount);
        console.log("=====================================\n");

        vm.startBroadcast();

        // Step 1: Approve the market to spend collateral tokens
        console.log("Step 1: Approving collateral token...");
        collateralToken.approve(market, amount);
        console.log("Approved:", amount);

        // Step 2: Deposit collateral tokens
        console.log("\nStep 2: Depositing to market...");
        marketContract.depositCollateral(amount);
        // TODO: get shares
        // uint shares = marketContract.
        // console.log("Shares received:", shares);

        vm.stopBroadcast();

        console.log("\nSuccessfully deposited", amount, "collateral to market");
        // console.log("Received", shares, "pool token shares");
    }
}

contract checkAllowanceMarketBorrowToken is Script {
    function run(address market) external view {
        // Get the market
        ILendingPool marketContract = ILendingPool(market);

        // Get the borrow token from the market
        IERC20 borrowToken = marketContract.borrowToken();

        // Check the allowance
        uint256 allowance = borrowToken.allowance(msg.sender, market);

        console.log("Allowance:", allowance);
    }
}

// forge script script/interactions/Interactions.s.sol:checkDepositedCollateral \
// sig "run(address)" 0x2a5b1e18aFBB63ba63B16EdC783814bDC728255A \
// --rpc-url $BASE_SEPOLIA_RPC_URL \
// --account testnet

// check deposited collateral in a market
contract checkDepositedCollateral is Script {
    function run(address market) external view {
        // Get the market
        ILendingPool marketContract = ILendingPool(market);

        // Get user position in the market
        ILendingPool.Position memory position = marketContract.getPosition(0x6E0056fe681E087160BB40dB0Ae3419Ee6C2ECE4);

        // get collateral from position
        uint256 collateral = position.collateralAmount;

        console.log("Collateral Deposited:", collateral);
    }
}

// forge script script/interactions/Interactions.s.sol:borrowFromMarket \
// --rpc-url $BASE_SEPOLIA_RPC_URL \
// --account testnet \
// --broadcast \
// --sig "run(address,uint256)" $MARKET 5000000

// Borrow from a market (requires collateral to be deposited first)
contract borrowFromMarket is Script {
    function run(address market, uint256 borrowAmount) external {
        // Get the market
        ILendingPool marketContract = ILendingPool(market);

        // Get the borrow token from the market
        IERC20 borrowToken = marketContract.borrowToken();

        console.log("========== Borrow from Market ==========");
        console.log("Market:", market);
        console.log("Borrow Token:", address(borrowToken));
        console.log("Borrow Amount:", borrowAmount);

        // Check user's position before borrowing
        ILendingPool.Position memory positionBefore = marketContract.getPosition(msg.sender);
        uint256 maxBorrow = marketContract.getMaxBorrow(msg.sender);
        uint256 currentDebt = marketContract.getUserDebt(msg.sender);
        uint256 healthFactorBefore = marketContract.healthFactor(msg.sender);

        console.log("\n--- Position Before Borrow ---");
        console.log("Collateral Deposited:", positionBefore.collateralAmount);
        console.log("Current Debt:", currentDebt);
        console.log("Max Borrow Available:", maxBorrow);
        console.log("Health Factor:", healthFactorBefore);
        console.log("=====================================\n");

        // Safety check
        require(positionBefore.collateralAmount > 0, "No collateral deposited");
        require(borrowAmount <= maxBorrow, "Borrow amount exceeds max borrow");

        vm.startBroadcast();

        // Borrow tokens (no approval needed - tokens are sent TO you)
        console.log("Borrowing", borrowAmount, "tokens...");
        uint256 shares = marketContract.borrow(borrowAmount);
        console.log("Borrow shares received:", shares);

        vm.stopBroadcast();

        // Check position after borrowing
        uint256 newDebt = marketContract.getUserDebt(msg.sender);
        uint256 healthFactorAfter = marketContract.healthFactor(msg.sender);

        console.log("\n--- Position After Borrow ---");
        console.log("New Debt:", newDebt);
        console.log("Health Factor:", healthFactorAfter);
        console.log("=====================================\n");

        console.log("Successfully borrowed", borrowAmount, "tokens");
        console.log("WARNING: Remember to repay your debt to avoid liquidation!");
    }
}

// forge script script/interactions/Interactions.s.sol:checkBorrowingCapacity \
// sig "run(address,address)" 0x2a5b1e18aFBB63ba63B16EdC783814bDC728255A 0x6E0056fe681E087160BB40dB0Ae3419Ee6C2ECE4 \
// --rpc-url $BASE_SEPOLIA_RPC_URL

// Check how much you can borrow from a market
contract checkBorrowingCapacity is Script {
    function run(address market, address user) external view {
        // Get the market
        ILendingPool marketContract = ILendingPool(market);

        // Get tokens
        IERC20 collateralToken = marketContract.collateralToken();
        IERC20 borrowToken = marketContract.borrowToken();

        // Get user's position
        ILendingPool.Position memory position = marketContract.getPosition(user);
        uint256 maxBorrow = marketContract.getMaxBorrow(user);
        uint256 currentDebt = marketContract.getUserDebt(user);
        uint256 healthFactor = position.borrowShares > 0 ? marketContract.healthFactor(user) : type(uint256).max;

        console.log("========== Borrowing Capacity ==========");
        console.log("Market:", market);
        console.log("User:", user);
        console.log("Collateral Token:", address(collateralToken));
        console.log("Borrow Token:", address(borrowToken));
        console.log("\n--- Current Position ---");
        console.log("Collateral Deposited:", position.collateralAmount);
        console.log("Borrow Shares:", position.borrowShares);
        console.log("Current Debt:", currentDebt);
        console.log("\n--- Borrowing Limits ---");
        console.log("Max Borrow Available:", maxBorrow);
        console.log("Health Factor:", healthFactor);
        console.log("=====================================");

        if (position.collateralAmount == 0) {
            console.log("\nWARNING: No collateral deposited. Deposit collateral first!");
        } else if (maxBorrow == 0) {
            console.log("\nWARNING: Already at max borrow capacity!");
        } else {
            console.log("\nYou can borrow up to:", maxBorrow, "tokens");
        }
    }
}
