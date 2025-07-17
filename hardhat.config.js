require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  etherscan: {
  apiKey: {
    polygonAmoy: "BSDXSS6CJ4XVG63X3W1KXV6YAXS1Q6UNBA"
  },
},
  networks: {
    polygon_amoy: {
      url: "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts: [process.env.PRIVATE_KEY]
    }
  }
};
