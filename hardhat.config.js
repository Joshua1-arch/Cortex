import "dotenv/config";
import "@nomicfoundation/hardhat-ethers";


const PRIVATE_KEY = process.env.PRIVATE_KEY;
const X_LAYER_RPC_URL = process.env.X_LAYER_RPC_URL ?? "https://testrpc.xlayer.tech";

/** @type {import("hardhat/config").HardhatUserConfig} */
const config = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {},
    xlayerTestnet: {
      url: X_LAYER_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
};

export default config;
