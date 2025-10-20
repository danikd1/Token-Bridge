const { ethers } = require("hardhat");

async function main() {
  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  const relayer = process.env.RELAYER_ADDRESS;
  const allowed = (process.env.RELAYER_ALLOWED || "true").toLowerCase() === "true";
  if (!bridgeAddress || !relayer) throw new Error("Set BRIDGE_ADDRESS and RELAYER_ADDRESS env vars");

  const bridge = await ethers.getContractAt("SimpleBridge", bridgeAddress);
  const tx = await bridge.setRelayer(relayer, allowed);
  await tx.wait();
  console.log(`setRelayer(${relayer}, ${allowed}) done`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


