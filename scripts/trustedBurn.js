const { ethers } = require("hardhat");

async function main() {
  const address = process.env.TOKEN_ADDRESS;
  const from = process.env.FROM_ADDRESS;
  const amount = process.env.AMOUNT;
  if (!address || !from || !amount) throw new Error("Set TOKEN_ADDRESS, FROM_ADDRESS, AMOUNT env vars");

  const token = await ethers.getContractAt("TrustedToken", address);
  const tx = await token.trustedBurn(from, amount);
  await tx.wait();
  console.log(`trustedBurn(${from}, ${amount}) done`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


