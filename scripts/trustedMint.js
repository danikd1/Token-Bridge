const { ethers } = require("hardhat");

async function main() {
  const address = process.env.TOKEN_ADDRESS;
  const to = process.env.TO_ADDRESS;
  const amount = process.env.AMOUNT;
  if (!address || !to || !amount) throw new Error("Set TOKEN_ADDRESS, TO_ADDRESS, AMOUNT env vars");

  const token = await ethers.getContractAt("TrustedToken", address);
  const tx = await token.trustedMint(to, amount);
  await tx.wait();
  console.log(`trustedMint(${to}, ${amount}) done`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


