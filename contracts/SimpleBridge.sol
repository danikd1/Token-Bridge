// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TrustedToken} from "./TrustedToken.sol";

contract SimpleBridge is Ownable {
    TrustedToken public immutable token;

    // allowlist оффчейн-ретрансляторов (релэеров), которые могут вызывать fulfill
    mapping(address => bool) public isRelayer;
    // nonce обработанные в целевой сети
    mapping(bytes32 => bool) public isProcessed;

    event RelayerUpdated(address indexed relayer, bool allowed);
    event Deposited(address indexed from, address indexed to, uint256 amount, uint256 dstChainId, bytes32 depositId);
    event Fulfilled(address indexed to, uint256 amount, bytes32 depositId);

    constructor(address tokenAddress, address initialOwner) Ownable(initialOwner) {
        require(tokenAddress != address(0), "TokenZero");
        token = TrustedToken(tokenAddress);
    }

    function setRelayer(address relayer, bool allowed) external onlyOwner {
        isRelayer[relayer] = allowed;
        emit RelayerUpdated(relayer, allowed);
    }

    // В исходной сети: пользователь кладёт токены, мы их сжигаем и эмитим событие
    function deposit(address to, uint256 amount, uint256 dstChainId, bytes32 depositId) external {
        // сжигаем у отправителя (мост ДОЛЖЕН быть доверенным в токене)
        token.trustedBurn(msg.sender, amount);
        emit Deposited(msg.sender, to, amount, dstChainId, depositId);
    }

    // В целевой сети: релэер подтверждает депозит и выпускает токены
    function fulfill(address to, uint256 amount, bytes32 depositId) external {
        require(isRelayer[msg.sender], "NotRelayer");
        require(!isProcessed[depositId], "AlreadyProcessed");
        isProcessed[depositId] = true;
        token.trustedMint(to, amount);
        emit Fulfilled(to, amount, depositId);
    }
}


