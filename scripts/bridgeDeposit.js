const { ethers } = require("hardhat");

async function main() {
  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  const to = process.env.DST_TO_ADDRESS;
  const amount = process.env.AMOUNT;
  const dstChainId = process.env.DST_CHAIN_ID || "1000";
  const depositId = process.env.DEPOSIT_ID || ethers.id(Date.now().toString());
  if (!bridgeAddress || !to || !amount) throw new Error("Set BRIDGE_ADDRESS, DST_TO_ADDRESS, AMOUNT");

  const bridge = await ethers.getContractAt("SimpleBridge", bridgeAddress);
  const tx = await bridge.deposit(to, amount, dstChainId, depositId);
  await tx.wait();
  console.log(`Deposited. depositId=${depositId}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


