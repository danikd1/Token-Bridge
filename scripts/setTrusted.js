const { ethers } = require("hardhat");

async function main() {
  const address = process.env.TOKEN_ADDRESS;
  const target = process.env.TRUSTED_ADDRESS;
  const trusted = (process.env.TRUSTED_FLAG || "true").toLowerCase() === "true";
  if (!address || !target) throw new Error("Set TOKEN_ADDRESS and TRUSTED_ADDRESS env vars");

  const token = await ethers.getContractAt("TrustedToken", address);
  const tx = await token.setTrusted(target, trusted);
  await tx.wait();
  console.log(`setTrusted(${target}, ${trusted}) done`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


