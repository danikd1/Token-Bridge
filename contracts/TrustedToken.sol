// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TrustedToken is ERC20, Ownable {
    mapping(address => bool) public isTrusted;

    event TrustedUpdated(address indexed account, bool trusted);

    constructor(string memory name_, string memory symbol_, address initialOwner) ERC20(name_, symbol_) Ownable(initialOwner) {}

    modifier onlyTrusted() {
        require(isTrusted[msg.sender], "NotTrusted");
        _;
    }

    function setTrusted(address account, bool trusted) external onlyOwner {
        isTrusted[account] = trusted;
        emit TrustedUpdated(account, trusted);
    }

    function trustedMint(address to, uint256 amount) external onlyTrusted {
        _mint(to, amount);
    }

    function trustedBurn(address from, uint256 amount) external onlyTrusted {
        _burn(from, amount);
    }
}


