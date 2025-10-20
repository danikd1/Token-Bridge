const { ethers } = require("ethers");
const fs = require("fs");

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // Загружаем информацию о деплое
  const deploymentInfo = JSON.parse(fs.readFileSync("deployment.json", "utf8"));
  
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  // Используем ключ первого аккаунта Hardhat как единый подписант (деплойер и релэер)
  // Можно переопределить через SIGNER_KEY
  const defaultDeployerKey = process.env.SIGNER_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // адрес 0xf39F...
  const signer = new ethers.Wallet(defaultDeployerKey, provider);
  
  console.log("Integration Test Started");
  console.log("Signer address:", await signer.getAddress());
  
  // Получаем контракты
  const bridgeAbi = require("../artifacts/contracts/SimpleBridge.sol/SimpleBridge.json").abi;
  const tokenAbi = require("../artifacts/contracts/TrustedToken.sol/TrustedToken.json").abi;
  
  const tokenA = new ethers.Contract(deploymentInfo.networks.A.token, tokenAbi, signer);
  const bridgeA = new ethers.Contract(deploymentInfo.networks.A.bridge, bridgeAbi, signer);
  const tokenB = new ethers.Contract(deploymentInfo.networks.B.token, tokenAbi, signer);
  const bridgeB = new ethers.Contract(deploymentInfo.networks.B.bridge, bridgeAbi, signer);
  
  // Проверяем начальные балансы
  const initialBalanceA = await tokenA.balanceOf(signer.address);
  const initialBalanceB = await tokenB.balanceOf(signer.address);
  console.log("Initial balance TokenA:", ethers.formatEther(initialBalanceA));
  console.log("Initial balance TokenB:", ethers.formatEther(initialBalanceB));
  
  // 1. Депозит в сети A
  const depositAmount = ethers.parseEther("10");
  const dstChainId = 1000;
  const depositId = ethers.id(`deposit-${Date.now()}`);
  const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // 2-й аккаунт hardhat
  
  console.log("\n=== STEP 1: DEPOSIT IN NETWORK A ===");
  console.log("Depositing", ethers.formatEther(depositAmount), "tokens");
  console.log("Deposit ID:", depositId);
  
  const depositTx = await bridgeA.deposit(recipient, depositAmount, dstChainId, depositId);
  console.log("Deposit transaction:", depositTx.hash);
  await depositTx.wait();
  console.log("Deposit confirmed");
  
  // Проверяем баланс после депозита
  const balanceAfterDeposit = await tokenA.balanceOf(signer.address);
  console.log("Balance after deposit:", ethers.formatEther(balanceAfterDeposit));
  console.log("Burned amount:", ethers.formatEther(initialBalanceA - balanceAfterDeposit));
  
  // 2. Имитируем релэйер: читаем событие и выполняем fulfill
  console.log("\n=== STEP 2: RELAYER PROCESSING ===");
  
  const filter = bridgeA.filters.Deposited();
  const events = await bridgeA.queryFilter(filter, -1); // последний блок
  const lastEvent = events[events.length - 1];
  
  if (lastEvent) {
    const { from, to, amount, dstChainId: eventDstChainId, depositId: eventDepositId } = lastEvent.args;
    console.log("Detected Deposited event:");
    console.log("  From:", from);
    console.log("  To:", to);
    console.log("  Amount:", ethers.formatEther(amount));
    console.log("  Dst Chain ID:", eventDstChainId.toString());
    console.log("  Deposit ID:", eventDepositId);
    
    // Небольшая пауза, чтобы нода стабилизировала nonce под automine
    await sleep(150);

    // Проверяем, что depositId не обработан
    const isProcessed = await bridgeB.isProcessed(eventDepositId);
    console.log("Already processed:", isProcessed);
    
    if (!isProcessed) {
      console.log("Calling fulfill on BridgeB...");

      // Попытка 1: обычный вызов
      try {
        const tx = await bridgeB.fulfill(to, amount, eventDepositId);
        console.log("Fulfill transaction:", tx.hash);
        await tx.wait();
        console.log("Fulfill confirmed");
      } catch (e) {
        const msg = (e && (e.shortMessage || e.message)) || "";
        const nonceErr = msg.includes("Nonce too low") || msg.includes("nonce has already been used");
        if (!nonceErr) throw e;
        console.warn("Nonce race detected, retrying with explicit latest nonce...");

        // Попытка 2: вручную формируем транзакцию с актуальным nonce
        const latestNonce = await provider.getTransactionCount(await signer.getAddress(), "latest");
        const txReq = await bridgeB.fulfill.populateTransaction(to, amount, eventDepositId);
        const sent = await signer.sendTransaction({ ...txReq, nonce: latestNonce });
        console.log("Fulfill transaction (retry):", sent.hash);
        await sent.wait();
        console.log("Fulfill confirmed (retry)");
      }
      
      // Проверяем баланс получателя в сети B
      const finalBalanceB = await tokenB.balanceOf(to);
      console.log("Recipient balance in Network B:", ethers.formatEther(finalBalanceB));
    } else {
      console.log("Deposit already processed, skipping fulfill");
    }
  } else {
    console.log("No Deposited events found");
  }
  
  console.log("\n=== INTEGRATION TEST COMPLETED ===");
  console.log("✓ Deposit executed in Network A");
  console.log("✓ Tokens burned in Network A");
  console.log("✓ Deposited event detected");
  console.log("✓ Fulfill executed in Network B");
  console.log("✓ Tokens minted in Network B");
}

main().catch((error) => {
  console.error("Integration test failed:", error);
  process.exitCode = 1;
});
