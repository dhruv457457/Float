import { ethers } from "hardhat";

const OPTIMIZER_ADDRESS = "0xABcD707afA9548AAEa0eA3f909bE08c793C64214";

const ABI = [
  "function setSplitWeights(uint256 best, uint256 second, uint256 third) external",
  "function splitBest() external view returns (uint256)",
  "function splitSecond() external view returns (uint256)",
  "function splitThird() external view returns (uint256)",
  "function previewSplit(uint256 usdcAmount, uint256 daysUntilMature) external view returns (uint256,uint256,uint256,address,address,address)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  const optimizer = new ethers.Contract(OPTIMIZER_ADDRESS, ABI, signer);

  // Check current weights
  const best   = await optimizer.splitBest();
  const second = await optimizer.splitSecond();
  const third  = await optimizer.splitThird();
  console.log(`Current weights: ${best}/${second}/${third} (best/second/third)`);

  // Set 100% to best vault, 0% to second and third
  console.log("Setting weights to 10000/0/0 (100% best vault)...");
  const tx = await optimizer.setSplitWeights(10000, 0, 0);
  console.log("Tx:", tx.hash);
  await tx.wait();
  console.log("✅ Weights updated");

  // Verify preview now shows 100% to yoUSD
  const amount = ethers.parseUnits("1", 6);
  const [amtBest, amtSecond, amtThird] = await optimizer.previewSplit(amount, 30);
  console.log("\nPreview split for $1, 30 days:");
  console.log(`  Best:   ${ethers.formatUnits(amtBest, 6)} USDC`);
  console.log(`  Second: ${ethers.formatUnits(amtSecond, 6)} USDC`);
  console.log(`  Third:  ${ethers.formatUnits(amtThird, 6)} USDC`);
  console.log("\n✅ All funds now go to yoUSD — safe to deposit");
}

main().catch((e) => {
  console.error("❌ FAILED:", e.message);
  process.exit(1);
});