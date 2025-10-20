const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleBridge", function () {
  async function deployAll() {
    const [owner, relayer, user, dstRecipient] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("TrustedToken");
    const token = await Token.deploy("Trusted Token", "TTK", owner.address);
    await token.waitForDeployment();

    const Bridge = await ethers.getContractFactory("SimpleBridge");
    const bridge = await Bridge.deploy(await token.getAddress(), owner.address);
    await bridge.waitForDeployment();

    // Настраиваем роли: токен доверяет мосту, мост доверяет релэеру
    await token.connect(owner).setTrusted(await bridge.getAddress(), true);
    await bridge.connect(owner).setRelayer(relayer.address, true);
    // Для удобства тестов: владелец тоже доверен (чтобы напрямую mint'ить в токене)
    await token.connect(owner).setTrusted(owner.address, true);

    return { token, bridge, owner, relayer, user, dstRecipient };
  }

  it("deposit burns and emits event", async function () {
    const { token, bridge, user } = await deployAll();
    // выделим пользователю токены (в тестах владелец доверен)
    await token.trustedMint(user.address, 1000n);

    const depositId = ethers.id("dep1");
    await expect(bridge.connect(user).deposit(user.address, 400n, 999, depositId))
      .to.emit(bridge, "Deposited");
    expect(await token.balanceOf(user.address)).to.equal(600n);
  });

  it("fulfill mints once and prevents replay", async function () {
    const { token, bridge, relayer, dstRecipient } = await deployAll();
    const depositId = ethers.id("dep2");
    await expect(bridge.connect(relayer).fulfill(dstRecipient.address, 500n, depositId))
      .to.emit(bridge, "Fulfilled");
    expect(await token.balanceOf(dstRecipient.address)).to.equal(500n);

    await expect(bridge.connect(relayer).fulfill(dstRecipient.address, 1n, depositId)).to.be.revertedWith("AlreadyProcessed");
  });

  it("only relayer can fulfill", async function () {
    const { bridge, user } = await deployAll();
    await expect(bridge.connect(user).fulfill(user.address, 1, ethers.id("x"))).to.be.revertedWith("NotRelayer");
  });

  it("deposit emits correct event with all parameters", async function () {
    const { token, bridge, user } = await deployAll();
    await token.trustedMint(user.address, 1000n);

    const depositId = ethers.id("test-deposit");
    const dstChainId = 1000;
    const amount = 500n;
    const to = user.address;

    await expect(bridge.connect(user).deposit(to, amount, dstChainId, depositId))
      .to.emit(bridge, "Deposited")
      .withArgs(user.address, to, amount, dstChainId, depositId);
  });

  it("fulfill emits correct event and prevents replay", async function () {
    const { bridge, relayer, dstRecipient } = await deployAll();
    const depositId = ethers.id("test-fulfill");
    const amount = 300n;

    await expect(bridge.connect(relayer).fulfill(dstRecipient.address, amount, depositId))
      .to.emit(bridge, "Fulfilled")
      .withArgs(dstRecipient.address, amount, depositId);

    // повторный fulfill должен ревертиться
    await expect(bridge.connect(relayer).fulfill(dstRecipient.address, 1n, depositId))
      .to.be.revertedWith("AlreadyProcessed");
  });

  it("setRelayer emits RelayerUpdated event", async function () {
    const { bridge, owner, user } = await deployAll();
    await expect(bridge.connect(owner).setRelayer(user.address, true))
      .to.emit(bridge, "RelayerUpdated")
      .withArgs(user.address, true);
  });

  it("only owner can set relayer", async function () {
    const { bridge, user } = await deployAll();
    await expect(bridge.connect(user).setRelayer(user.address, true))
      .to.be.revertedWithCustomError(bridge, "OwnableUnauthorizedAccount");
  });

  it("deposit burns correct amount from sender", async function () {
    const { token, bridge, user } = await deployAll();
    await token.trustedMint(user.address, 1000n);
    const initialBalance = await token.balanceOf(user.address);

    await bridge.connect(user).deposit(user.address, 200n, 999, ethers.id("burn-test"));
    const finalBalance = await token.balanceOf(user.address);

    expect(finalBalance).to.equal(initialBalance - 200n);
  });

  it("fulfill mints correct amount to recipient", async function () {
    const { token, bridge, relayer, dstRecipient } = await deployAll();
    const initialBalance = await token.balanceOf(dstRecipient.address);

    await bridge.connect(relayer).fulfill(dstRecipient.address, 150n, ethers.id("mint-test"));
    const finalBalance = await token.balanceOf(dstRecipient.address);

    expect(finalBalance).to.equal(initialBalance + 150n);
  });

  it("isProcessed correctly tracks processed deposits", async function () {
    const { bridge, relayer } = await deployAll();
    const depositId = ethers.id("process-test");

    expect(await bridge.isProcessed(depositId)).to.be.false;
    await bridge.connect(relayer).fulfill(relayer.address, 1n, depositId);
    expect(await bridge.isProcessed(depositId)).to.be.true;
  });
});


