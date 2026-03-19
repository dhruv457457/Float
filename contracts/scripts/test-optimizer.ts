import { ethers } from "hardhat";

// ── Deployed addresses ────────────────────────────────────────────
const OPTIMIZER_ADDRESS = "0x35d10847494AC42d1Bd5b20966B0De8dE90A772C";
const USDC_ADDRESS      = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// ── Test config ───────────────────────────────────────────────────
const DEPOSIT_USDC  = "1";      // $1 USDC to deposit
const DAYS_UNTIL    = 30;       // need money back in 30 days
const LABEL         = "Test float via script";

// Minimal ABIs
const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

const OPTIMIZER_ABI = [
  "function deposit(uint256 usdcAmount, uint256 matureAt, string calldata label) external returns (uint256 positionId)",
  "function getPosition(uint256 positionId) external view returns (tuple(uint256 sharesYoUSD, uint256 sharesYoETH, uint256 sharesYoBTC, uint256 depositedUSDC, uint256 depositedAt, uint256 matureAt, string label))",
  "function getUserPositions(address user) external view returns (uint256[])",
  "function getPositionValue(uint256 positionId) external view returns (uint256 totalValue, uint256 valueYoUSD, uint256 valueYoETH, uint256 valueYoBTC)",
  "function apyYoUSD() external view returns (uint256)",
  "function apyYoETH() external view returns (uint256)",
  "function apyYoBTC() external view returns (uint256)",
  "function previewSplit(uint256 usdcAmount, uint256 daysUntilMature) external view returns (uint256 amtBest, uint256 amtSecond, uint256 amtThird, address vBest, address vSecond, address vThird)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("═══════════════════════════════════════════");
  console.log("  FloatOptimizer — Test Script");
  console.log("═══════════════════════════════════════════");
  console.log(`  Wallet:    ${signer.address}`);

  const usdc      = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
  const optimizer = new ethers.Contract(OPTIMIZER_ADDRESS, OPTIMIZER_ABI, signer);

  const decimals   = await usdc.decimals();
  const depositAmt = ethers.parseUnits(DEPOSIT_USDC, decimals);

  // ── Step 1: Check balances ─────────────────────────────────────
  console.log("\n── Step 1: Check balances ──────────────────");
  const usdcBal = await usdc.balanceOf(signer.address);
  const ethBal  = await ethers.provider.getBalance(signer.address);
  console.log(`  USDC balance: ${ethers.formatUnits(usdcBal, decimals)} USDC`);
  console.log(`  ETH balance:  ${ethers.formatEther(ethBal)} ETH`);

  if (usdcBal < depositAmt) {
    throw new Error(`Not enough USDC. Need ${DEPOSIT_USDC}, have ${ethers.formatUnits(usdcBal, decimals)}`);
  }

  // ── Step 2: Check on-chain APYs ────────────────────────────────
  console.log("\n── Step 2: On-chain APYs ───────────────────");
  const apyUSD = await optimizer.apyYoUSD();
  const apyETH = await optimizer.apyYoETH();
  const apyBTC = await optimizer.apyYoBTC();
  console.log(`  yoUSD: ${Number(apyUSD) / 100}%`);
  console.log(`  yoETH: ${Number(apyETH) / 100}%`);
  console.log(`  yoBTC: ${Number(apyBTC) / 100}%`);

  if (apyETH > 0n || apyBTC > 0n) {
    console.log("\n  ⚠️  yoETH/yoBTC APY > 0 — optimizer will try to use WETH/cbBTC");
    console.log("  Run fix-optimizer-apys.ts first, or this will revert.");
    console.log("  Continuing anyway to show the preview...\n");
  }

  // ── Step 3: Preview split ──────────────────────────────────────
  console.log("\n── Step 3: Preview split ───────────────────");
  const [amtBest, amtSecond, amtThird, vBest, vSecond, vThird] =
    await optimizer.previewSplit(depositAmt, DAYS_UNTIL);
  console.log(`  Best vault:   ${vBest}`);
  console.log(`  Second vault: ${vSecond}`);
  console.log(`  Third vault:  ${vThird}`);
  console.log(`  Amount best:   ${ethers.formatUnits(amtBest, decimals)} USDC`);
  console.log(`  Amount second: ${ethers.formatUnits(amtSecond, decimals)} USDC`);
  console.log(`  Amount third:  ${ethers.formatUnits(amtThird, decimals)} USDC`);

  // ── Step 4: Approve USDC ───────────────────────────────────────
  console.log("\n── Step 4: Approve USDC ────────────────────");
  const allowance = await usdc.allowance(signer.address, OPTIMIZER_ADDRESS);
  if (allowance < depositAmt) {
    console.log(`  Approving ${DEPOSIT_USDC} USDC to optimizer...`);
    const approveTx = await usdc.approve(OPTIMIZER_ADDRESS, depositAmt);
    console.log(`  Tx: ${approveTx.hash}`);
    await approveTx.wait();
    console.log("  ✅ Approved");
  } else {
    console.log(`  ✅ Already approved (${ethers.formatUnits(allowance, decimals)} USDC)`);
  }

  // ── Step 5: Deposit ────────────────────────────────────────────
  console.log("\n── Step 5: Deposit into FloatOptimizer ─────");
  const matureAt = BigInt(Math.floor(Date.now() / 1000) + DAYS_UNTIL * 86400);
  console.log(`  Amount:   ${DEPOSIT_USDC} USDC`);
  console.log(`  Matures:  ${new Date(Number(matureAt) * 1000).toLocaleDateString()}`);
  console.log(`  Label:    "${LABEL}"`);

  const depositTx = await optimizer.deposit(depositAmt, matureAt, LABEL);
  console.log(`  Tx: ${depositTx.hash}`);
  console.log(`  BaseScan: https://basescan.org/tx/${depositTx.hash}`);

  const receipt = await depositTx.wait();
  console.log(`  ✅ Confirmed in block ${receipt.blockNumber}`);

  // Parse positionId from event log
  let positionId: bigint | null = null;
  for (const log of receipt.logs) {
    try {
      const iface = new ethers.Interface([
        "event Deposited(address indexed user, uint256 indexed positionId, uint256 usdcAmount, uint256 sharesYoUSD, uint256 sharesYoETH, uint256 sharesYoBTC, uint256 matureAt)"
      ]);
      const parsed = iface.parseLog(log);
      if (parsed?.name === "Deposited") {
        positionId = parsed.args.positionId;
        console.log(`  Position ID: ${positionId}`);
        console.log(`  Shares yoUSD: ${parsed.args.sharesYoUSD}`);
        console.log(`  Shares yoETH: ${parsed.args.sharesYoETH}`);
        console.log(`  Shares yoBTC: ${parsed.args.sharesYoBTC}`);
      }
    } catch {}
  }

  // ── Step 6: Read back position ─────────────────────────────────
  if (positionId !== null) {
    console.log("\n── Step 6: Read position on-chain ──────────");
    const pos = await optimizer.getPosition(positionId);
    console.log(`  depositedUSDC: ${ethers.formatUnits(pos.depositedUSDC, decimals)} USDC`);
    console.log(`  sharesYoUSD:   ${pos.sharesYoUSD}`);
    console.log(`  sharesYoETH:   ${pos.sharesYoETH}`);
    console.log(`  sharesYoBTC:   ${pos.sharesYoBTC}`);
    console.log(`  matureAt:      ${new Date(Number(pos.matureAt) * 1000).toLocaleDateString()}`);
    console.log(`  label:         "${pos.label}"`);

    const [totalVal, valUSD] = await optimizer.getPositionValue(positionId);
    console.log(`  Current value (yoUSD): ${ethers.formatUnits(valUSD, decimals)} USDC`);
  }

  // ── Step 7: All user positions ─────────────────────────────────
  console.log("\n── Step 7: All your positions ──────────────");
  const allIds = await optimizer.getUserPositions(signer.address);
  console.log(`  Total positions: ${allIds.length}`);
  for (const id of allIds) {
    const p = await optimizer.getPosition(id);
    console.log(`  [${id}] "${p.label}" — ${ethers.formatUnits(p.depositedUSDC, decimals)} USDC`);
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("  TEST COMPLETE ✅");
  console.log("═══════════════════════════════════════════\n");
}

main().catch((e) => {
  console.error("\n❌ FAILED:", e.message);
  process.exit(1);
});