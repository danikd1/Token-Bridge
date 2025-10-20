const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Деплой токенов для двух сетей
  const Token = await ethers.getContractFactory("TrustedToken");
  
  // Токен для сети A (исходная)
  const tokenA = await Token.deploy("TokenA", "TKA", deployer.address);
  await tokenA.waitForDeployment();
  const tokenAAddress = await tokenA.getAddress();
  console.log("TokenA deployed to:", tokenAAddress);

  // Токен для сети B (целевая)
  const tokenB = await Token.deploy("TokenB", "TKB", deployer.address);
  await tokenB.waitForDeployment();
  const tokenBAddress = await tokenB.getAddress();
  console.log("TokenB deployed to:", tokenBAddress);

  // Деплой мостов
  const Bridge = await ethers.getContractFactory("SimpleBridge");
  
  // Мост в сети A
  const bridgeA = await Bridge.deploy(tokenAAddress, deployer.address);
  await bridgeA.waitForDeployment();
  const bridgeAAddress = await bridgeA.getAddress();
  console.log("BridgeA deployed to:", bridgeAAddress);

  // Мост в сети B
  const bridgeB = await Bridge.deploy(tokenBAddress, deployer.address);
  await bridgeB.waitForDeployment();
  const bridgeBAddress = await bridgeB.getAddress();
  console.log("BridgeB deployed to:", bridgeBAddress);

  // Настройка прав: мосты должны быть доверенными в своих токенах
  console.log("Setting up permissions...");
  
  // Мост A доверенный в токене A
  await tokenA.setTrusted(bridgeAAddress, true);
  console.log("BridgeA is now trusted in TokenA");

  // Мост B доверенный в токене B
  await tokenB.setTrusted(bridgeBAddress, true);
  console.log("BridgeB is now trusted in TokenB");

  // Настройка релэера (деплойер будет релэером)
  await bridgeA.setRelayer(deployer.address, true);
  console.log("Deployer is relayer for BridgeA");

  await bridgeB.setRelayer(deployer.address, true);
  console.log("Deployer is relayer for BridgeB");

  // Доверим деплойера для локального тестового mint
  await tokenA.setTrusted(deployer.address, true);
  await tokenB.setTrusted(deployer.address, true);

  // Начислим токены деплойеру для тестирования
  await tokenA.trustedMint(deployer.address, ethers.parseEther("1000"));
  await tokenB.trustedMint(deployer.address, ethers.parseEther("1000"));
  console.log("Minted 1000 tokens to deployer in both networks");

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("Network A (Source):");
  console.log("  TokenA:", tokenAAddress);
  console.log("  BridgeA:", bridgeAAddress);
  console.log("Network B (Destination):");
  console.log("  TokenB:", tokenBAddress);
  console.log("  BridgeB:", bridgeBAddress);
  console.log("Relayer:", deployer.address);

  // Сохраняем адреса в файл для использования в других скриптах
  const deploymentInfo = {
    networks: {
      A: {
        token: tokenAAddress,
        bridge: bridgeAAddress
      },
      B: {
        token: tokenBAddress,
        bridge: bridgeBAddress
      }
    },
    relayer: deployer.address,
    deployer: deployer.address
  };

  const fs = require("fs");
  fs.writeFileSync("deployment.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("\nDeployment info saved to deployment.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
