const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LendingProtocol", () => {
    let lending, mockUSDC, owner, user, amount; 

    beforeEach(async () => {
        [owner, user] = await ethers.getSigners();
        const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
        mockUSDC = await MockUSDCFactory.deploy(owner.address);
        // await mockUSDC.waitForDeployment();

        const LendingProtocolFactory = await ethers.getContractFactory("LendingProtocol");
        console.log("MockUSDC deployed at:", mockUSDC.address);
        lending = await LendingProtocolFactory.deploy(mockUSDC.address);
        // await lending.waitForDeployment();

        amount = ethers.utils.parseUnits("1000", 6);
        await mockUSDC.mint(user.address, amount);

        await mockUSDC.connect(user).approve(lending.address, amount);
    });

    // Helper function for deposit
    async function depositFromUser(amount) {
        await lending.connect(user).depositCollateral(amount)
    };

    // Helper function for borrow
    async function borrowFromUser(amount) {
        await lending.connect(user).borrow(amount)
    };

    it("should allow user to deposit", async () => {
        await depositFromUser(amount);
        const userBalance = await lending.balanceOf(user.address);
        const contractBalance = await mockUSDC.balanceOf(lending.address);
        expect(userBalance).to.equal(amount);
        expect(contractBalance).to.equal(amount);
    });

    it("Amount must be more than 0", async () => {
        await expect(
            lending.connect(user).depositCollateral(0)
        ).to.be.revertedWith("Amount must be more than 0");
    });

    it("should emit CollateralDeposited", async () => {
        await expect(
            lending.connect(user).depositCollateral(amount)
        ).to.emit(lending, "CollateralDeposited").withArgs(user.address, amount);
    });

    it("should allow user to borrow if collateral is sufficent", async () => {
        await borrowFromUser(amount);
        const debt = await lending.debtOf(user.address);
        const userUSDCBalance = await mockUSDC.balanceOf(user.address);
        expect(debt).to.equal(amount);
        expect(userUSDCBalance).to.equal(amount);
    });

    it("should revert if user tries to borrow without enough collateral", async () => {
        const smallAmount = ethers.utils.parseUnits("100", 6);
        await depositFromUser(smallAmount); 
        await expect(
           lending.connect(user).borrow(smallAmount)
        ).to.be.revertedWith("Less than required");
    });

    it("should emit Borrowed", async () => {
        await expect(
            lending.connect(user).borrow(amount)
        ).to.emit(lending, "Borrowed").withArgs(user.address, amount);
    });

    it("should return max uint256 if debt is 0", async () => {
        await depositFromUser(amount);

        const health = await lending.getAccountHealth(user.address);
        expect(health).to.equal(ethers.constants.MaxUint256);
    });

    it("should return collateral/debt ratio if debt > 0", async () => {
        await depositFromUser(ethers.utils.parseUnits("1500", 6));
        await borrowFromUser(ethers.utils.parseUnits("1000", 6));

        const collateral = ethers.utils.parseUnits("1500", 6);
        const debt = ethers.utils.parseUnits("1000", 6);
        const expectedhealth = collateral.mul(100).div(debt);
        const health = await lending.getAccountHealth(user.address);

        expect(health).to.equal(expectedhealth);
    });
});