// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Errors} from "src/libraries/Errors.sol";

library Validator {
    function ensureCollateralTokenIsNotZero(address token) internal pure {
        if (token == address(0)) revert Errors.InvalidCollateralToken();
    }

    function ensureBorrowTokenIsNotZero(address token) internal pure {
        if (token == address(0)) revert Errors.InvalidBorrowToken();
    }

    function ensureTokenIsNotSame(address tokenA, address tokenB) internal pure {
        if (tokenA == tokenB) revert Errors.SameToken();
    }

    function ensureAddressIsNotZeroAddress(address _addr) internal pure {
        if (_addr == address(0)) {
            revert Errors.ZeroAddress();
        }
    }

    function ensureTokenIsNotZeroAddress(address token) internal pure {
        if (token == address(0)) {
            revert Errors.InvalidToken();
        }
    }

    function ensureValueIsNotZero(uint256 _value) internal pure {
        if (_value == 0) {
            revert Errors.ZeroAmount();
        }
    }

    function ensureInputIsNotEmpty(string memory _stringOpt) internal pure {
        if (bytes(_stringOpt).length == 0) {
            revert Errors.EmptyString();
        }
    }
}
