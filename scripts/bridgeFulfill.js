const { ethers } = require("hardhat");

async function main() {
  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  const to = process.env.TO_ADDRESS;
  const amount = process.env.AMOUNT;
  const depositId = process.env.DEPOSIT_ID;
  if (!bridgeAddress || !to || !amount || !depositId) throw new Error("Set BRIDGE_ADDRESS, TO_ADDRESS, AMOUNT, DEPOSIT_ID");

  const bridge = await ethers.getContractAt("SimpleBridge", bridgeAddress);
  const tx = await bridge.fulfill(to, amount, depositId);
  await tx.wait();
  console.log(`Fulfilled. depositId=${depositId}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


