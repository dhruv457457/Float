import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY ?? "";
const ALCHEMY_BASE_KEY = process.env.ALCHEMY_BASE_KEY ?? "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },

  networks: {
    // ── Base mainnet ──────────────────────────────────────────────
    base: {
      url: ALCHEMY_BASE_KEY
        ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_BASE_KEY}`
        : "https://mainnet.base.org",
      chainId: 8453,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      gasPrice: "auto",
    },

    // ── Base Sepolia testnet (for testing) ────────────────────────
    baseSepolia: {
      url: ALCHEMY_BASE_KEY
        ? `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_BASE_KEY}`
        : "https://sepolia.base.org",
      chainId: 84532,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },

    // ── Local hardhat ─────────────────────────────────────────────
    hardhat: {
      forking: {
        // Fork Base mainnet for local testing
        url: ALCHEMY_BASE_KEY
          ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_BASE_KEY}`
          : "https://mainnet.base.org",
        enabled: process.env.FORK === "true",
      },
    },
  },

  etherscan: {
    apiKey: {
      base: BASESCAN_API_KEY,
      baseSepolia: BASESCAN_API_KEY,
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
    ],
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};

export default config;