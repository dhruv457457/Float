import { ethers, network, run } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════");
  console.log("  Deploying FloatZap");
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
  console.log("\n⏳ Deploying FloatZap...");
  const FloatZap = await ethers.getContractFactory("FloatZap");
  const floatZap = await FloatZap.deploy();
  await floatZap.waitForDeployment();

  const address = await floatZap.getAddress();
  console.log(`✅ FloatZap deployed: ${address}`);
  console.log(`   BaseScan: https://basescan.org/address/${address}`);

  // Verify on Basescan
  if (network.name === "base" || network.name === "baseSepolia") {
    console.log("\n⏳ Waiting 30s for Basescan to index...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log("⏳ Verifying on Basescan...");
    try {
      await run("verify:verify", {
        address,
        constructorArguments: [],
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

  // Print summary
  console.log("\n═══════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════");
  console.log(`  FloatZap: ${address}`);
  console.log("\n  Next steps:");
  console.log("  1. Copy address into lib/contracts.ts → FLOAT_ZAP_ADDRESS");
  console.log("  2. Run deploy:optimizer to deploy FloatOptimizer");
  console.log("═══════════════════════════════════════\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});