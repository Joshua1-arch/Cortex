import hre from "hardhat";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const LIVE_XUSDT_ADDRESS = "0x455b612f51d6f87cf1cee0bc0f12922f0e8a3ec8";
const TROPHY_BASE_URI = "ipfs://QmYourSoulboundTrophyMetadataCid/";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log(`Deploying SoulboundTrophy with: ${deployer.address}`);
  console.log(`Using base URI: ${TROPHY_BASE_URI}`);

  const SoulboundTrophy = await hre.ethers.getContractFactory("SoulboundTrophy");
  const soulbound = await SoulboundTrophy.deploy(TROPHY_BASE_URI);
  await soulbound.waitForDeployment();

  const soulboundAddress = await soulbound.getAddress();
  console.log(`SoulboundTrophy deployed to: ${soulboundAddress}`);

  const deployment = {
    network: hre.network.name,
    deployer: deployer.address,
    quoteToken: LIVE_XUSDT_ADDRESS,
    soulboundTrophy: soulboundAddress,
    baseURI: TROPHY_BASE_URI,
  };

  const outputPath = resolve(process.cwd(), "deployments.soulbound.json");
  writeFileSync(outputPath, JSON.stringify(deployment, null, 2));
  console.log(`Deployment summary written to: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
