const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const MockModule = buildModule("MockModule", (m) => {
    const deployer = m.getAccount(0); // Deploy as initialOwner

    const mockUSDC = m.contract("MockUSDC", [deployer]);
    const mockETH = m.contract("MockETH", [deployer]);

    return { mockUSDC, mockETH };
});

module.exports = MockModule;