import { ethers, network, run } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════");
  console.log("  Deploying FloatOptimizer");
  console.log("═══════════════════════════════════════");
  console.log(`  Network:   ${network.name} (chainId: ${network.config.chainId})`);
  console.log(`  Deployer:  ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Balance:   ${ethers.formatEther(balance)} ETH`);
  console.log("───────────────────────────────────────");

  if (balance === 0n) {
    throw new Error("Deployer has no ETH — fund it first");
  }

  // Deploy
  console.log("\n⏳ Deploying FloatOptimizer...");
  const FloatOptimizer = await ethers.getContractFactory("FloatOptimizer");
  const FLOAT_ZAP = "0x0BE25e03Bec708aCFb2f74C9f99986453702D27C";
  const optimizer = await FloatOptimizer.deploy(FLOAT_ZAP);
  await optimizer.waitForDeployment();

  const address = await optimizer.getAddress();
  console.log(`✅ FloatOptimizer deployed: ${address}`);
  console.log(`   BaseScan: https://basescan.org/address/${address}`);

  // Read initial state to confirm
  const apyUSD = await optimizer.apyYoUSD();
  const apyETH = await optimizer.apyYoETH();
  const apyBTC = await optimizer.apyYoBTC();
  console.log(`\n  Initial APYs on-chain:`);
  console.log(`    yoUSD: ${Number(apyUSD) / 100}%`);
  console.log(`    yoETH: ${Number(apyETH) / 100}%`);
  console.log(`    yoBTC: ${Number(apyBTC) / 100}%`);

  // Verify on Basescan
  if (network.name === "base" || network.name === "baseSepolia") {
    console.log("\n⏳ Waiting 30s for Basescan to index...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log("⏳ Verifying on Basescan...");
    try {
      await run("verify:verify", {
        address,
        constructorArguments: [FLOAT_ZAP],
      });
      console.log("✅ Verified on Basescan");
    } catch (e: any) {
      if (e.message.includes("Already Verified")) {
        console.log("✅ Already verified");
      } else {
        console.log("⚠️  Verification failed:", e.message);
        console.log("   Run manually: npx hardhat verify --network base", address);
      }
    }
  }

  console.log("\n═══════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════");
  console.log(`  FloatOptimizer: ${address}`);
  console.log("\n  Next steps:");
  console.log("  1. Copy address into lib/contracts.ts → FLOAT_OPTIMIZER_ADDRESS");
  console.log("  2. Call updateAPYs() when vault APYs change");
  console.log("     npx hardhat run scripts/update-apys.ts --network base");
  console.log("═══════════════════════════════════════\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});