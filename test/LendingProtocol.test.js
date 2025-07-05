const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MaxUint256 } =require ("ethers");

describe("LendingProtocol", () => {
    let lending, mockUSDC, mockETH, owner, user, amount, liquidator; 

    beforeEach(async () => {
    [owner, user, liquidator] = await ethers.getSigners();

    // 1. Deploy MockUSDC with 'owner' as the initial owner
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDCFactory.connect(owner).deploy(owner.address);
    await mockUSDC.waitForDeployment();
    console.log(" mockUSDC.address:", mockUSDC?.target ?? "undefined");

    // deploy MockETH 
    const MockETHFactory = await ethers.getContractFactory("MockETH");
    mockETH = await MockETHFactory.connect(owner).deploy(owner.address);
    await mockETH.waitForDeployment();
    console.log("mockETH.address:", mockETH?.target ?? "undefined");

    // Chainlink oracle for live updates
    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    const decimals = 8;
    const initialPrice = 100000000;
    MockV3 = await MockV3Aggregator.deploy(decimals, initialPrice);
    await MockV3.waitForDeployment();

    // 2. Mint tokens to user *before* transferring ownership
    amount = ethers.parseUnits("2000", 18);
    await mockETH.connect(owner).mint(user.address, amount);
    await mockUSDC.connect(owner).mint(user.address, amount);
    await mockUSDC.connect(owner).mint(liquidator.address, ethers.parseUnits("1000", 18));


    // 3. Deploy LendingProtocol with mockUSDC address
    const LendingProtocolFactory = await ethers.getContractFactory("LendingProtocol");
    lending = await LendingProtocolFactory.deploy(
        await mockUSDC.getAddress(),
        await mockETH.getAddress(),
        await MockV3.getAddress()
    );
    await lending.waitForDeployment();
    console.log("lending.address:", lending?.target ?? "undefined");
    console.log("mockV3 address:", MockV3.target ?? "undefined");

    // 4. Transfer ownership of MockUSDC to LendingProtocol
    await mockUSDC.connect(owner).transferOwnership(await lending.getAddress());
    await mockETH.connect(owner).mint(liquidator.address, ethers.parseUnits("1000", 18));
    await mockETH.connect(owner).transferOwnership(await lending.getAddress());
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
    await mockETH.connect(user).approve(lendingAddress, depositAmount);

    await depositFromUser(depositAmount);

    const userBalance = await lending.balanceOf(user.address);
    const contractBalance = await mockETH.balanceOf(lendingAddress);

    expect(userBalance).to.equal(depositAmount);
    expect(contractBalance).to.equal(depositAmount);
    });

    it("Amount must be more than 0", async () => {
        await expect(
            lending.connect(user).depositCollateral(0)
        ).to.be.revertedWith("Amount must be more than 0");
    });

    it("should emit CollateralDeposited", async () => {
        const lendingAddress = await lending.getAddress();
        await mockETH.connect(user).approve(lendingAddress, amount);

        await expect(
            lending.connect(user).depositCollateral(amount)
        ).to.emit(lending, "CollateralDeposited").withArgs(user.address, amount);
    });

    it("should allow user to borrow if collateral is sufficent", async () => {
        const depositAmount = ethers.parseUnits("1500", 18); 
        const borrowAmount = ethers.parseUnits("1000", 18);
        const lendingAddress = await lending.getAddress();

        await mockETH.connect(user).approve(lendingAddress, depositAmount);

        await depositFromUser(depositAmount);
        await MockV3.updateAnswer("100000000"); 
        await borrowFromUser(borrowAmount);

        const debt = await lending.debtOf(user.address);
        const userUSDCBalance = await mockUSDC.balanceOf(user.address);
        expect(debt).to.equal(borrowAmount);
        expect(userUSDCBalance).to.equal(amount + borrowAmount);
    });
   
    it("should revert if user tries to borrow without enough collateral", async () => {
        const smallAmount = ethers.parseUnits("100", 18);
        const lendingAddress = await lending.getAddress();

        await MockV3.updateAnswer("100000000");
        await mockETH.connect(user).approve(lendingAddress, smallAmount);
        await depositFromUser(smallAmount); 
        await expect(
           lending.connect(user).borrow(smallAmount)
        ).to.be.revertedWith("Less than required");
    });

    it("should emit Borrowed", async () => {
        const borrowAmount = ethers.parseUnits("1000", 18);
        const lendingAddress = await lending.getAddress();
        await mockETH.connect(user).approve(lendingAddress, amount);
        await depositFromUser(amount);
        await expect(
            lending.connect(user).borrow(borrowAmount)
        ).to.emit(lending, "Borrowed").withArgs(user.address, borrowAmount);
    });

    it("should return max uint256 if debt is 0", async () => {
        const lendingAddress = await lending.getAddress();

        await mockETH.connect(user).approve(lendingAddress, amount);
        await depositFromUser(amount);

        const health = await lending.getAccountHealth(user.address);
        expect(health).to.equal(MaxUint256);
    });

    it("should return collateral/debt ratio if debt > 0", async () => {
        const lendingAddress = await lending.getAddress();

        await mockETH.connect(user).approve(lendingAddress, ethers.parseUnits("1500", 18));
        await depositFromUser(ethers.parseUnits("1500", 18));
        await borrowFromUser(ethers.parseUnits("1000", 18));

        const collateral = 1500n * 10n ** 18n;
        const debt = ethers.parseUnits("1000", 18);
        const expectedhealth = collateral * 100n / debt;
        const health = await lending.getAccountHealth(user.address);

        expect(health).to.equal(expectedhealth);
    });

    it("Should calculate correct borrowable value", async () => {
        await MockV3.updateAnswer("100000000");
        const lendingAddress = await lending.getAddress();
        
        const rawDeposit = ethers.parseUnits("1500", 18);

        await mockETH.connect(user).approve(lendingAddress, rawDeposit);
        await depositFromUser(rawDeposit);
        const borrowable = await lending.getBorrowableAmount(user.address);
        const expectedBorrowable = rawDeposit * 100n / 150n;

        expect(borrowable).to.equal(expectedBorrowable);
    });

    it("Should correct tuple(collateral, debt, borrowable)", async () => {
        await MockV3.updateAnswer("100000000");
        const lendingAddress = await lending.getAddress();
        await mockETH.connect(user).approve(lendingAddress, ethers.parseUnits("1500", 18));
        await depositFromUser(ethers.parseUnits("1500", 18));
        await borrowFromUser(ethers.parseUnits("1000", 18));

        const [collateral, debt, borrowable] = await lending.getAccountSummary(user.address);
        const depositAmount = ethers.parseUnits("1500", 18);
        const borrowAmount = ethers.parseUnits("1000", 18);
        const expectedBorrowable = depositAmount * 100n / 150n;

        expect(collateral).to.equal(depositAmount);
        expect(debt).to.equal(borrowAmount);
        expect(borrowable).to.equal(expectedBorrowable);
    });

    it("Should revert if pice drop in Chainlink", async () => {
        await MockV3.updateAnswer("100000000");
        const lendingAddress = await lending.getAddress();

        await mockETH.connect(user).approve(lendingAddress, ethers.parseUnits("1500", 18));
        await depositFromUser(ethers.parseUnits("1500", 18));
        await MockV3.updateAnswer("50000000");
        const borrowAmount = ethers.parseUnits("1000", 18);
        
        expect(borrowFromUser(borrowAmount)).to.be.revertedWith("Less than required");
    });

    it("should return true for isLiquidatable when price drops", async () => {
        const lendingAddress = await lending.getAddress();
        
        await mockETH.connect(user).approve(lendingAddress, ethers.parseUnits("1500", 18));
        await depositFromUser(ethers.parseUnits("1500", 18));
        await borrowFromUser(ethers.parseUnits("1000", 18));
        await MockV3.updateAnswer("50000000"); 

        const liquidatable = await lending.isLiquidatable(user.address);
        
        expect(liquidatable).to.be.true;
    });

    it("Should revert if acount is healthy", async () => {
        const lendingAddress = await lending.getAddress();

        await mockETH.connect(user).approve(lendingAddress, ethers.parseUnits("1500", 18));
        await depositFromUser(ethers.parseUnits("1500", 18));
        await borrowFromUser(ethers.parseUnits("1000", 18));
        await mockETH.connect(liquidator).approve(lendingAddress, ethers.parseUnits("1000", 18));
        
        await expect(
        lending.connect(liquidator).liquidate(user.address, ethers.parseUnits("1000", 18))
        ).to.be.revertedWith("Account is not liquidatable");
    });

    it("should allow partial liquidation and update balances correctly", async () => {
        const lendingAddress = await lending.getAddress();

        await mockETH.connect(user).approve(lendingAddress, ethers.parseUnits("1500", 18));
        await depositFromUser(ethers.parseUnits("1500", 18));
        await borrowFromUser(ethers.parseUnits("1000", 18));
        await MockV3.updateAnswer("50000000"); 

        await mockUSDC.connect(liquidator).approve(lendingAddress, (ethers.parseUnits("500", 18)));
        const beforeCollateral = await mockETH.balanceOf(liquidator.address);

        await lending.connect(liquidator).liquidate(user.address, (ethers.parseUnits("500", 18)));
        const afterCollateral = await mockETH.balanceOf(liquidator.address);
        const debtAfter = await lending.debtOf(user.address);
        const collateralAfter = await lending.balanceOf(user.address);
        const expectedReward = (ethers.parseUnits("500", 18)) * 105n / 100n;

        expect(afterCollateral).to.equal(beforeCollateral + expectedReward);
        expect(debtAfter).to.equal((ethers.parseUnits("500", 18))); 
        expect(collateralAfter).to.equal(ethers.parseUnits("1500", 18) - expectedReward);
    });

    it("Should revert if repayAmount exceeds user's debt", async () => {
        const lendingAddress = await lending.getAddress();

        await mockETH.connect(user).approve(lendingAddress, ethers.parseUnits("1500", 18));
        await depositFromUser(ethers.parseUnits("1500", 18));
        await borrowFromUser(ethers.parseUnits("500", 18));
        await MockV3.updateAnswer("50000000"); 
        await mockETH.connect(liquidator).approve(lendingAddress, ethers.parseUnits("600", 18)); 
        
        await expect(
        lending.connect(liquidator).liquidate(user.address, ethers.parseUnits("600", 18))
        ).to.be.revertedWith("Repay amount exceeds user's debt");
    });

    it("Should revert if account is not liquidatable", async () => {
        lendingAddress = await lending.getAddress();
        await mockETH.connect(user).approve(lendingAddress, ethers.parseUnits("1500", 18));
        await depositFromUser(ethers.parseUnits("1500", 18));
        await borrowFromUser(ethers.parseUnits("1000", 18));

        await mockUSDC.connect(liquidator).approve(lendingAddress, ethers.parseUnits("500", 18));

        await expect(
            lending.connect(liquidator).liquidate(user.address, ethers.parseUnits("500", 18))
        ).to.be.revertedWith("Account is not liquidatable");
    });

    it("Should alllow full liquidation and transfer correct reward to liquidator", async () => {
        lendingAddress = await lending.getAddress();

        await mockETH.connect(user).approve(lendingAddress, ethers.parseUnits("1500", 18));
        await depositFromUser(ethers.parseUnits("1500", 18));
        await borrowFromUser(ethers.parseUnits("1000", 18));
        await MockV3.updateAnswer("50000000");
        await mockUSDC.connect(liquidator).approve(lendingAddress, ethers.parseUnits("1000", 18));

        const before = await mockETH.balanceOf(liquidator.address);
        await lending.connect(liquidator).liquidate(user.address, ethers.parseUnits("1000", 18));

        const after = await mockETH.balanceOf(liquidator.address);
        const reward = ethers.parseUnits("1000", 18) * 105n / 100n;

        expect(after - before).to.equal(reward);

        const userDebt = await lending.debtOf(user.address);
        expect(userDebt).to.equal(0);

        const userCollateral = await lending.balanceOf(user.address);
        expect(userCollateral).to.equal(ethers.parseUnits("1500", 18) - reward);
    });

    it("Should emit liquidated event with correct parameters", async () => {
        lendingAddress = await lending.getAddress();

        await mockETH.connect(user).approve(lendingAddress, ethers.parseUnits("1500", 18));
        await depositFromUser(ethers.parseUnits("1500", 18));
        await borrowFromUser(ethers.parseUnits("1000", 18));
        await MockV3.updateAnswer("50000000");
        await mockUSDC.connect(liquidator).approve(lendingAddress, ethers.parseUnits("1000", 18));

        const repayAmount = ethers.parseUnits("1000", 18);
        const expectedReward = repayAmount * 105n / 100n;

        await expect(
            lending.connect(liquidator).liquidate(user.address, repayAmount)
        ).to.emit(lending, "Liquidated").withArgs(
            user.address,
            liquidator.address,
            repayAmount,
            expectedReward
        );
    });

    it("Should prevent liquidation if health factor is above 1", async () => {
        lendingAddress = await lending.getAddress();

        await mockETH.connect(user).approve(lendingAddress, ethers.parseUnits("1500", 18));
        await depositFromUser(ethers.parseUnits("1500", 18));
        await borrowFromUser(ethers.parseUnits("500", 18));
        await MockV3.updateAnswer("50000000");

        await expect(
            lending.connect(liquidator).liquidate(user.address, ethers.parseUnits("500", 18))
        ).to.be.revertedWith("Account is not liquidatable");
    });
});