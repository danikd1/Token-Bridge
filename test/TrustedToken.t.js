const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TrustedToken", function () {
  async function deploy() {
    const [owner, trusted, user, stranger] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("TrustedToken");
    const token = await Token.deploy("Trusted Token", "TTK", owner.address);
    await token.waitForDeployment();
    return { token, owner, trusted, user, stranger };
  }

  it("owner can set trusted", async function () {
    const { token, owner, trusted } = await deploy();
    await expect(token.connect(owner).setTrusted(trusted.address, true)).to.not.be.reverted;
    expect(await token.isTrusted(trusted.address)).to.equal(true);
  });

  it("non-owner cannot set trusted", async function () {
    const { token, stranger, trusted } = await deploy();
    await expect(token.connect(stranger).setTrusted(trusted.address, true)).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
  });

  it("trusted can mint and burn", async function () {
    const { token, owner, trusted, user } = await deploy();
    await token.connect(owner).setTrusted(trusted.address, true);

    await expect(token.connect(trusted).trustedMint(user.address, 1000n)).to.not.be.reverted;
    expect(await token.balanceOf(user.address)).to.equal(1000n);

    await expect(token.connect(trusted).trustedBurn(user.address, 400n)).to.not.be.reverted;
    expect(await token.balanceOf(user.address)).to.equal(600n);
  });

  it("untrusted cannot mint or burn", async function () {
    const { token, stranger, user } = await deploy();
    await expect(token.connect(stranger).trustedMint(user.address, 1)).to.be.revertedWith("NotTrusted");
    await expect(token.connect(stranger).trustedBurn(user.address, 1)).to.be.revertedWith("NotTrusted");
  });

  it("burn more than balance reverts", async function () {
    const { token, owner, trusted, user } = await deploy();
    await token.connect(owner).setTrusted(trusted.address, true);
    await token.connect(trusted).trustedMint(user.address, 1000n);
    await expect(token.connect(trusted).trustedBurn(user.address, 2000n)).to.be.reverted;
  });
});


