import { ethers } from "hardhat";

const OPTIMIZER_ADDRESS = "0xABcD707afA9548AAEa0eA3f909bE08c793C64214";
const YOUSD_ADDRESS     = "0x0000000f2eB9f69274678c76222B35eEc7588a65";
const USDC_ADDRESS      = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const DEPOSIT_USDC      = "0.5"; // small test amount

const OPTIMIZER_ABI = [
  "function deposit(uint256 usdcAmount, uint256 matureAt, string calldata label) external returns (uint256 positionId)",
  "function redeem(uint256 positionId) external returns (uint256 totalUSDC)",
  "function getPosition(uint256 positionId) external view returns (tuple(uint256 sharesYoUSD, uint256 sharesYoETH, uint256 sharesYoBTC, uint256 depositedUSDC, uint256 depositedAt, uint256 matureAt, string label))",
  "function getUserPositions(address user) external view returns (uint256[])",
  "function apyYoUSD() external view returns (uint256)",
  "function splitBest() external view returns (uint256)",
];

const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

const YOUSD_ABI = [
  "function balanceOf(address) external view returns (uint256)",
  "function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  const optimizer = new ethers.Contract(OPTIMIZER_ADDRESS, OPTIMIZER_ABI, signer);
  const usdc      = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
  const yoUSD     = new ethers.Contract(YOUSD_ADDRESS, YOUSD_ABI, signer);
  const dec       = await usdc.decimals();

  console.log("═══════════════════════════════════════════");
  console.log("  FloatOptimizer v2 — Full E2E Test");
  console.log("═══════════════════════════════════════════");
  console.log(`  Contract: ${OPTIMIZER_ADDRESS}`);
  console.log(`  Wallet:   ${signer.address}`);

  // Verify setup
  const apy       = await optimizer.apyYoUSD();
  const splitBest = await optimizer.splitBest();
  console.log(`\n  apyYoUSD:   ${Number(apy) / 100}%`);
  console.log(`  splitBest:  ${splitBest} bps (${Number(splitBest) / 100}%)`);

  if (splitBest !== 10000n) {
    console.log("\n  ⚠️  Run fix-split-weights.ts first!");
    return;
  }

  const depositAmt = ethers.parseUnits(DEPOSIT_USDC, dec);
  const usdcBal    = await usdc.balanceOf(signer.address);
  console.log(`\n  USDC balance: ${ethers.formatUnits(usdcBal, dec)}`);

  if (usdcBal < depositAmt) {
    console.log(`  ❌ Need at least ${DEPOSIT_USDC} USDC`);
    return;
  }

  // ── APPROVE ───────────────────────────────────────────────────
  console.log("\n── Approve ─────────────────────────────────");
  const allowance = await usdc.allowance(signer.address, OPTIMIZER_ADDRESS);
  if (allowance < depositAmt) {
    const tx = await usdc.approve(OPTIMIZER_ADDRESS, depositAmt);
    await tx.wait();
    console.log("  ✅ Approved");
  } else {
    console.log("  ✅ Already approved");
  }

  // ── DEPOSIT ───────────────────────────────────────────────────
  console.log("\n── Deposit ─────────────────────────────────");
  const matureAt = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);
  const depositTx = await optimizer.deposit(depositAmt, matureAt, "E2E test float");
  console.log(`  Tx: ${depositTx.hash}`);
  const receipt = await depositTx.wait();

  // Get positionId from event
  let positionId = 0n;
  const iface = new ethers.Interface([
    "event Deposited(address indexed user, uint256 indexed positionId, uint256 usdcAmount, uint256 sharesYoUSD, uint256 sharesYoETH, uint256 sharesYoBTC, uint256 matureAt)"
  ]);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "Deposited") {
        positionId = parsed.args.positionId;
        console.log(`  ✅ Position ID: ${positionId}`);
        console.log(`  Shares yoUSD:  ${parsed.args.sharesYoUSD}`);
      }
    } catch {}
  }

  // ── READ POSITION ─────────────────────────────────────────────
  console.log("\n── Read position ───────────────────────────");
  const pos = await optimizer.getPosition(positionId);
  console.log(`  sharesYoUSD:   ${pos.sharesYoUSD}`);
  console.log(`  depositedUSDC: ${ethers.formatUnits(pos.depositedUSDC, dec)}`);
  console.log(`  label:         "${pos.label}"`);

  // ── REDEEM (gets yoUSD tokens back) ───────────────────────────
  console.log("\n── Redeem (new contract sends yoUSD tokens) ");
  const usdcBefore   = await usdc.balanceOf(signer.address);
  const yoUSDBefore  = await yoUSD.balanceOf(signer.address);
  console.log(`  USDC before:   ${ethers.formatUnits(usdcBefore, dec)}`);
  console.log(`  yoUSD before:  ${yoUSDBefore}`);

  const redeemTx = await optimizer.redeem(positionId);
  console.log(`  Tx: ${redeemTx.hash}`);
  await redeemTx.wait();

  const yoUSDAfter = await yoUSD.balanceOf(signer.address);
  console.log(`  yoUSD after:   ${yoUSDAfter} ← received yoTokens`);

  if (yoUSDAfter > yoUSDBefore) {
    console.log(`\n  ✅ Got ${yoUSDAfter - yoUSDBefore} yoUSD shares`);
    console.log("  Now redeeming yoUSD shares directly from vault...");

    // ── REDEEM FROM VAULT ──────────────────────────────────────
    const usdcBefore2 = await usdc.balanceOf(signer.address);
    const redeemFromVault = await yoUSD.redeem(yoUSDAfter, signer.address, signer.address);
    console.log(`  Tx: ${redeemFromVault.hash}`);
    await redeemFromVault.wait();

    const usdcAfter = await usdc.balanceOf(signer.address);
    console.log(`\n  USDC received: +${ethers.formatUnits(usdcAfter - usdcBefore2, dec)}`);
    console.log(`  USDC final:    ${ethers.formatUnits(usdcAfter, dec)}`);
    console.log("\n  ✅ FULL CYCLE COMPLETE — deposit → hold → redeem works!");
  } else {
    console.log("  ⚠️  No yoUSD tokens received — check contract");
  }

  console.log("\n═══════════════════════════════════════════\n");
}

main().catch((e) => {
  console.error("\n❌ FAILED:", e.message);
  process.exit(1);
});