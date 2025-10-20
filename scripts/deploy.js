const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const name = process.env.TOKEN_NAME || "Trusted Token";
  const symbol = process.env.TOKEN_SYMBOL || "TTK";
  const owner = process.env.TOKEN_OWNER || deployer.address;

  const Token = await ethers.getContractFactory("TrustedToken");
  const token = await Token.deploy(name, symbol, owner);
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("TrustedToken deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


