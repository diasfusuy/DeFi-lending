// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockETH
 * @notice Mock ERC20 token representing ETH collateral for local testing and development.
 * @dev
 * - Inherits OpenZeppelin ERC20, ERC20Permit, and Ownable.
 * - Owner-controlled mint function is used to distribute test balances.
 * - Not intended for production use.
 *
 * Token Details:
 * - Name: MockETH
 * - Symbol: METH
 */
contract MockETH is ERC20, Ownable, ERC20Permit {

/**
 * @notice Creates the MockETH token and sets the initial owner.
 * @dev The owner has permission to mint tokens via {mint}.
 *
 * @param initialOwner Address that will be assigned as the contract owner.
 */
    constructor(address initialOwner) 
    ERC20("MockETH", "METH") 
    ERC20Permit("MockETH") 
    Ownable(initialOwner)
    {}

/**
 * @notice Mints new MockETH tokens to a specified address.
 * @dev Restricted to the contract owner.
 *
 * @param to Recipient address that will receive the minted tokens.
 * @param amount Amount of tokens to mint (in token base units).
 */
    function mint(address to, uint256 amount) public onlyOwner {
    _mint(to, amount);
    }
}