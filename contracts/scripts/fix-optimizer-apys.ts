import { ethers } from "hardhat";

// FloatOptimizer deployed on Base mainnet
const OPTIMIZER_ADDRESS = "0xABcD707afA9548AAEa0eA3f909bE08c793C64214";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const optimizer = await ethers.getContractAt("FloatOptimizer", OPTIMIZER_ADDRESS);

  // Set yoETH and yoBTC to 0 so ALL funds go into yoUSD (USDC-only, safe)
  // yoUSD = 318 basis points = 3.18%
  // yoETH = 0 (disabled — needs WETH which optimizer doesn't have)
  // yoBTC = 0 (disabled — needs cbBTC which optimizer doesn't have)
  console.log("Setting APYs: yoUSD=3.18%, yoETH=0%, yoBTC=0%");
  const tx = await optimizer.updateAPYs(318, 0, 0);
  console.log("Tx sent:", tx.hash);
  await tx.wait();
  console.log("✅ Done — optimizer now routes 100% into yoUSD");

  // Verify
  const usd = await optimizer.apyYoUSD();
  const eth = await optimizer.apyYoETH();
  const btc = await optimizer.apyYoBTC();
  console.log(`On-chain APYs: yoUSD=${usd}, yoETH=${eth}, yoBTC=${btc}`);
}

main().catch(console.error);