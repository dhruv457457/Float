import { ethers } from "hardhat";

const OPTIMIZER_ADDRESS = "0xABcD707afA9548AAEa0eA3f909bE08c793C64214";

const ABI = [
  "function updateAPYs(uint256 _apyYoUSD, uint256 _apyYoETH, uint256 _apyYoBTC) external",
  "function setSplitWeights(uint256 best, uint256 second, uint256 third) external",
  "function apyYoUSD() external view returns (uint256)",
  "function apyYoETH() external view returns (uint256)",
  "function apyYoBTC() external view returns (uint256)",
  "function splitBest() external view returns (uint256)",
  "function splitSecond() external view returns (uint256)",
  "function splitThird() external view returns (uint256)",
  "function previewSplit(uint256 usdcAmount, uint256 daysUntilMature) external view returns (uint256,uint256,uint256,address,address,address)",
];

const YO_VAULTS: Record<string, string> = {
  "0x0000000f2eb9f69274678c76222b35eec7588a65": "yoUSD",
  "0x3a43aec53490cb9fa922847385d82fe25d0e9de7": "yoETH",
  "0xbcbc8cb4d1e8ed048a6276a5e94a3e952660bcbc": "yoBTC",
};

async function main() {
  const [signer] = await ethers.getSigners();
  const opt = new ethers.Contract(OPTIMIZER_ADDRESS, ABI, signer);

  console.log("═══════════════════════════════════════════");
  console.log("  FloatOptimizer v3 — Full Setup");
  console.log("═══════════════════════════════════════════");

  // ── Current state ──────────────────────────────────────────────
  console.log("\n── Current state ───────────────────────────");
  console.log(`  apyYoUSD:   ${Number(await opt.apyYoUSD()) / 100}%`);
  console.log(`  apyYoETH:   ${Number(await opt.apyYoETH()) / 100}%`);
  console.log(`  apyYoBTC:   ${Number(await opt.apyYoBTC()) / 100}%`);
  console.log(`  splitBest:  ${await opt.splitBest()}`);
  console.log(`  splitSecond:${await opt.splitSecond()}`);
  console.log(`  splitThird: ${await opt.splitThird()}`);

  // ── Step 1: Set real APYs (enable all 3 vaults) ────────────────
  console.log("\n── Step 1: Set APYs ────────────────────────");
  console.log("  yoUSD = 3.18%, yoETH = 5.42%, yoBTC = 1.92%");
  const tx1 = await opt.updateAPYs(318, 542, 192);
  console.log(`  Tx: ${tx1.hash}`);
  await tx1.wait();
  console.log("  ✅ APYs updated");

  // ── Step 2: Set real split weights (60/30/10) ──────────────────
  console.log("\n── Step 2: Set split weights 60/30/10 ──────");
  console.log("  Best vault: 60%, Second: 30%, Third: 10%");
  const tx2 = await opt.setSplitWeights(6000, 3000, 1000);
  console.log(`  Tx: ${tx2.hash}`);
  await tx2.wait();
  console.log("  ✅ Weights updated");

  // Wait a moment for RPC to index
  await new Promise(r => setTimeout(r, 3000));

  // ── Verify ─────────────────────────────────────────────────────
  console.log("\n── Verify ──────────────────────────────────");
  const apyU = await opt.apyYoUSD();
  const apyE = await opt.apyYoETH();
  const apyB = await opt.apyYoBTC();
  const best  = await opt.splitBest();
  console.log(`  apyYoUSD:   ${Number(apyU) / 100}%`);
  console.log(`  apyYoETH:   ${Number(apyE) / 100}%`);
  console.log(`  apyYoBTC:   ${Number(apyB) / 100}%`);
  console.log(`  splitBest:  ${best} (${Number(best)/100}%)`);

  // ── Preview split for $10 over 30 days ────────────────────────
  console.log("\n── Preview: $10 deposit, 30 days ───────────");
  const amount = ethers.parseUnits("10", 6);
  const [amtBest, amtSecond, amtThird, vBest, vSecond, vThird] =
    await opt.previewSplit(amount, 30);

  const fmtV = (addr: string) => YO_VAULTS[addr.toLowerCase()] ?? addr.slice(0, 10);

  console.log(`  ${fmtV(vBest)}:   $${ethers.formatUnits(amtBest, 6)} (${Math.round(Number(amtBest) / Number(amount) * 100)}%)`);
  console.log(`  ${fmtV(vSecond)}: $${ethers.formatUnits(amtSecond, 6)} (${Math.round(Number(amtSecond) / Number(amount) * 100)}%)`);
  console.log(`  ${fmtV(vThird)}:  $${ethers.formatUnits(amtThird, 6)} (${Math.round(Number(amtThird) / Number(amount) * 100)}%)`);

  if (fmtV(vBest) === "yoETH") {
    console.log("\n  ✅ yoETH is best vault (5.42% APY) — 60% routed via FloatZap");
    console.log("  ✅ Real multi-vault split working!");
  } else {
    console.log(`\n  Best vault is ${fmtV(vBest)} — check APY values`);
  }

  console.log("\n═══════════════════════════════════════════\n");
}

main().catch((e) => {
  console.error("❌ FAILED:", e.message);
  process.exit(1);
});