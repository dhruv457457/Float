import { ethers } from "hardhat";

// ── Update this with the ACTUAL yoVaultUSD token address from BaseScan ──
// Check: https://basescan.org/tx/0x497df5fcceee32ff9cc13a77dbe154d695e87c77059d626b55e616c660369462
// Look at "ERC-20 Tokens Transferred" row that went to your wallet
const YOUSD_VAULT = "0x0000000f2eB9f69274678c76222B35eEc7588a65"; // ← replace if different

const OPTIMIZER_ADDRESS = "0x35d10847494AC42d1Bd5b20966B0De8dE90A772C";
const USDC_ADDRESS      = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const VAULT_ABI = [
  "function balanceOf(address) external view returns (uint256)",
  "function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets)",
  "function previewRedeem(uint256 shares) external view returns (uint256)",
  "function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares)",
  "function maxRedeem(address owner) external view returns (uint256)",
  "function maxWithdraw(address owner) external view returns (uint256)",
  "function convertToAssets(uint256 shares) external view returns (uint256)",
  "function asset() external view returns (address)",
  "function totalAssets() external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

const USDC_ABI = [
  "function balanceOf(address) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  const vault = new ethers.Contract(YOUSD_VAULT, VAULT_ABI, signer);
  const usdc  = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
  const uDec  = await usdc.decimals();

  console.log("Wallet:", signer.address);
  console.log("Vault: ", YOUSD_VAULT);

  // ── Check what wallet holds ────────────────────────────────────
  const walletShares = await vault.balanceOf(signer.address);
  const maxR         = await vault.maxRedeem(signer.address);
  const maxW         = await vault.maxWithdraw(signer.address);
  const usdcBal      = await usdc.balanceOf(signer.address);

  console.log(`\n  walletShares:  ${walletShares}`);
  console.log(`  maxRedeem:     ${maxR}`);
  console.log(`  maxWithdraw:   ${maxW}`);
  console.log(`  USDC before:   ${ethers.formatUnits(usdcBal, uDec)}`);

  // Also check optimizer still holds anything
  const contractShares = await vault.balanceOf(OPTIMIZER_ADDRESS);
  console.log(`  contract holds: ${contractShares} shares`);

  if (walletShares === 0n && contractShares === 0n) {
    console.log("\n⚠️  No shares found in wallet or contract.");
    console.log("   Check BaseScan for the rescue tx to find the real token address:");
    console.log("   https://basescan.org/tx/0x497df5fcceee32ff9cc13a77dbe154d695e87c77059d626b55e616c660369462");
    console.log("\n   Also check your wallet on BaseScan:");
    console.log(`   https://basescan.org/address/${signer.address}#tokentxns`);
    return;
  }

  const sharesToRedeem = walletShares > 0n ? walletShares : 0n;
  if (sharesToRedeem === 0n) {
    console.log("\n  No shares in wallet to redeem.");
    return;
  }

  const preview = await vault.convertToAssets(sharesToRedeem);
  console.log(`\n  Shares to redeem: ${sharesToRedeem}`);
  console.log(`  Expected USDC:    ~${ethers.formatUnits(preview, uDec)}`);

  // Try redeem
  console.log("\n⏳ Redeeming from vault...");
  try {
    const tx = await vault.redeem(sharesToRedeem, signer.address, signer.address);
    console.log(`  Tx: ${tx.hash}`);
    await tx.wait();
    const usdcAfter = await usdc.balanceOf(signer.address);
    console.log(`\n  ✅ USDC after:    ${ethers.formatUnits(usdcAfter, uDec)}`);
    console.log(`  Received:        +${ethers.formatUnits(usdcAfter - usdcBal, uDec)}`);
  } catch (e: any) {
    console.log(`\n  redeem() failed: ${e.message}`);
    console.log("  Trying withdraw() instead...");
    try {
      const tx = await vault.withdraw(maxW, signer.address, signer.address);
      console.log(`  Tx: ${tx.hash}`);
      await tx.wait();
      const usdcAfter = await usdc.balanceOf(signer.address);
      console.log(`  ✅ USDC after: ${ethers.formatUnits(usdcAfter, uDec)}`);
    } catch (e2: any) {
      console.log(`  withdraw() also failed: ${e2.message}`);
      console.log("\n  ── Manual steps ────────────────────────────");
      console.log("  1. Go to BaseScan → your wallet → Token Txns");
      console.log(`     https://basescan.org/address/${signer.address}#tokentxns`);
      console.log("  2. Find yoVaultUSD token → click contract address");
      console.log("  3. Write Contract → redeem(your_shares, your_wallet, your_wallet)");
    }
  }
}

main().catch(console.error);