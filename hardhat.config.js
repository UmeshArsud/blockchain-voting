require("@nomicfoundation/hardhat-toolbox");

// Optional: for a public testnet, set SEPOLIA_RPC and PRIVATE_KEY env variables.
const { SEPOLIA_RPC, PRIVATE_KEY } = process.env;

module.exports = {
  solidity: "0.8.24",
  networks: {
    localhost: { url: "http://127.0.0.1:8545" },
    ...(SEPOLIA_RPC && PRIVATE_KEY
      ? { sepolia: { url: SEPOLIA_RPC, accounts: [PRIVATE_KEY] } }
      : {}),
  },
};
