const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!tokenAddress) throw new Error("Set TOKEN_ADDRESS to existing TrustedToken");
  const owner = process.env.BRIDGE_OWNER || deployer.address;

  const Bridge = await ethers.getContractFactory("SimpleBridge");
  const bridge = await Bridge.deploy(tokenAddress, owner);
  await bridge.waitForDeployment();
  const address = await bridge.getAddress();
  console.log("SimpleBridge deployed to:", address);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


