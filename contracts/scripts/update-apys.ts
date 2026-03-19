import { ethers } from "hardhat";

// ── Paste your deployed address here ─────────────────────────────
const OPTIMIZER_ADDRESS = process.env.OPTIMIZER_ADDRESS ?? "";

// ── Live APYs from YO SDK (update these before running) ──────────
// Format: basis points — 318 = 3.18%
const APY_YO_USD = 318;
const APY_YO_ETH = 542;
const APY_YO_BTC = 192;

async function main() {
  if (!OPTIMIZER_ADDRESS) {
    throw new Error("Set OPTIMIZER_ADDRESS in .env or as env var");
  }

  const [signer] = await ethers.getSigners();
  console.log(`Updating APYs on FloatOptimizer: ${OPTIMIZER_ADDRESS}`);
  console.log(`Signer: ${signer.address}`);

  const optimizer = await ethers.getContractAt("FloatOptimizer", OPTIMIZER_ADDRESS);

  // Check current APYs
  const currentUSD = await optimizer.apyYoUSD();
  const currentETH = await optimizer.apyYoETH();
  const currentBTC = await optimizer.apyYoBTC();

  console.log("\nCurrent APYs on-chain:");
  console.log(`  yoUSD: ${Number(currentUSD) / 100}%`);
  console.log(`  yoETH: ${Number(currentETH) / 100}%`);
  console.log(`  yoBTC: ${Number(currentBTC) / 100}%`);

  console.log("\nNew APYs:");
  console.log(`  yoUSD: ${APY_YO_USD / 100}%`);
  console.log(`  yoETH: ${APY_YO_ETH / 100}%`);
  console.log(`  yoBTC: ${APY_YO_BTC / 100}%`);

  // Only update if changed
  if (
    BigInt(APY_YO_USD) === currentUSD &&
    BigInt(APY_YO_ETH) === currentETH &&
    BigInt(APY_YO_BTC) === currentBTC
  ) {
    console.log("\n✅ APYs unchanged — no update needed");
    return;
  }

  const tx = await optimizer.updateAPYs(APY_YO_USD, APY_YO_ETH, APY_YO_BTC);
  console.log(`\n⏳ Tx sent: ${tx.hash}`);
  await tx.wait();
  console.log("✅ APYs updated on-chain");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});