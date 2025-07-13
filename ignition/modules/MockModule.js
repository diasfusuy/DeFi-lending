const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const MockModule = buildModule("MockModule", (m) => {
    const deployer = m.getAccount(0); // Deploy as initialOwner

    const mockUSDC = m.contract("MockUSDC", [deployer]);
    const mockETH = m.contract("MockETH", [deployer]);

    const mockOracle = m.contract("MockV3Aggregator", [8, "100000000"]);

    const lendingProtocol = m.contract("LendingProtocol", [
        mockUSDC,
        mockETH,
        mockOracle,
    ]);

    return { mockUSDC, mockETH, mockOracle, lendingProtocol };
});

module.exports = MockModule;