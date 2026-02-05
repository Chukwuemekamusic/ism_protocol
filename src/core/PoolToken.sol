// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IPoolToken} from "../interfaces/IPoolToken.sol";

/// @title PoolToken
/// @notice ERC20 receipt token representing shares in a lending pool
/// @dev Only the associated LendingPool can mint/burn
contract PoolToken is ERC20, IPoolToken {
    /// @notice The lending pool that controls this token
    address public immutable pool;

    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyPool() {
        if (msg.sender != pool) revert OnlyPool();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                             CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @notice Deploy a new pool token
    /// @param _pool The lending pool address
    /// @param _name Token name (e.g., "Isolated Pool WETH/USDC Supply")
    /// @param _symbol Token symbol (e.g., "ipWETH-USDC")
    constructor(address _pool, string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        if (_pool == address(0)) revert InvalidPool();
        pool = _pool;
    }

    /*//////////////////////////////////////////////////////////////
                          POOL-ONLY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IPoolToken
    function mint(address to, uint256 amount) external onlyPool {
        _mint(to, amount);
    }

    /// @inheritdoc IPoolToken
    function burn(address from, uint256 amount) external onlyPool {
        _burn(from, amount);
    }
}
