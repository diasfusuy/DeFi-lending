const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MaxUint256 } =require ("ethers");

describe("LendingProtocol", () => {
    let lending, mockUSDC, owner, user, amount; 

    beforeEach(async () => {
    [owner, user] = await ethers.getSigners();

    // 1. Deploy MockUSDC with 'owner' as the initial owner
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDCFactory.connect(owner).deploy(owner.address);
    await mockUSDC.waitForDeployment();
    console.log(" mockUSDC.address:", mockUSDC?.target ?? "undefined");

    // 2. Mint tokens to user *before* transferring ownership
    amount = ethers.parseUnits("2000", 18);
    await mockUSDC.connect(owner).mint(user.address, amount);

    // 3. Deploy LendingProtocol with mockUSDC address
    const LendingProtocolFactory = await ethers.getContractFactory("LendingProtocol");
    lending = await LendingProtocolFactory.deploy(await mockUSDC.getAddress());
    await lending.waitForDeployment();
    console.log("lending.address:", lending?.target ?? "undefined");

    // 4. Transfer ownership of MockUSDC to LendingProtocol
    await mockUSDC.connect(owner).transferOwnership(await lending.getAddress());

    // 5. Approve LendingProtocol to spend user's USDC
    await mockUSDC.connect(user).approve(await lending.getAddress(), amount);
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
    const depositAmount = ethers.parseUnits("1000", 18);
    const lendingAddress = await lending.getAddress();

    // Approve before deposit
    await mockUSDC.connect(user).approve(lendingAddress, depositAmount);

    await depositFromUser(depositAmount);

    const userBalance = await lending.balanceOf(user.address);
    const contractBalance = await mockUSDC.balanceOf(lendingAddress);

    expect(userBalance).to.equal(depositAmount);
    expect(contractBalance).to.equal(depositAmount);
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

    // Chainlink oracle will be added
    it("should allow user to borrow if collateral is sufficent", async () => {
        const depositAmount = ethers.parseUnits("1500", 18); 
        const borrowAmount = ethers.parseUnits("1000", 18);

        await depositFromUser(depositAmount);
        await borrowFromUser(borrowAmount);

        const debt = await lending.debtOf(user.address);
        const userUSDCBalance = await mockUSDC.balanceOf(user.address);
        expect(debt).to.equal(borrowAmount);
        expect(userUSDCBalance).to.equal(depositAmount);
    });
   
    it("should revert if user tries to borrow without enough collateral", async () => {
        const smallAmount = ethers.parseUnits("100", 18);
        await depositFromUser(smallAmount); 
        await expect(
           lending.connect(user).borrow(smallAmount)
        ).to.be.revertedWith("Less than required");
    });

    it("should emit Borrowed", async () => {
        const borrowAmount = ethers.parseUnits("1000", 18);
        await depositFromUser(amount);
        await expect(
            lending.connect(user).borrow(borrowAmount)
        ).to.emit(lending, "Borrowed").withArgs(user.address, borrowAmount);
    });

    it("should return max uint256 if debt is 0", async () => {
        await depositFromUser(amount);

        const health = await lending.getAccountHealth(user.address);
        expect(health).to.equal(MaxUint256);
    });

    it("should return collateral/debt ratio if debt > 0", async () => {
        const lendingAddress = await lending.getAddress();

        await mockUSDC.connect(user).approve(lendingAddress, ethers.parseUnits("1500", 18));
        await depositFromUser(ethers.parseUnits("1500", 18));
        await borrowFromUser(ethers.parseUnits("1000", 18));

        const collateral = 1500n * 10n ** 18n;
        const debt = ethers.parseUnits("1000", 18);
        const expectedhealth = collateral * 100n / debt;
        const health = await lending.getAccountHealth(user.address);

        expect(health).to.equal(expectedhealth);
    });
});