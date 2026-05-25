import hre from "hardhat";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const TROPHY_BASE_URI = "ipfs://QmYourSoulboundTrophyMetadataCid/";
const DEFAULT_CAMPAIGN = {
  slug: "wc-2026-opening-match",
  homeTeam: "Brazil",
  awayTeam: "Argentina",
  startsAt: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
  closesAt: Math.floor(Date.now() / 1000) + 60 * 60 * 48,
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log(`Deploying SoulboundTrophy with: ${deployer.address}`);
  console.log(`Using base URI: ${TROPHY_BASE_URI}`);

  const SoulboundTrophy = await hre.ethers.getContractFactory("SoulboundTrophy");
  const soulbound = await SoulboundTrophy.deploy(TROPHY_BASE_URI);
  await soulbound.waitForDeployment();

  const soulboundAddress = await soulbound.getAddress();
  console.log(`SoulboundTrophy deployed to: ${soulboundAddress}`);

  console.log(
    `Creating default campaign: ${DEFAULT_CAMPAIGN.homeTeam} vs ${DEFAULT_CAMPAIGN.awayTeam} (${DEFAULT_CAMPAIGN.slug})`,
  );
  const createCampaignTx = await soulbound.createMatchCampaign(
    DEFAULT_CAMPAIGN.slug,
    DEFAULT_CAMPAIGN.homeTeam,
    DEFAULT_CAMPAIGN.awayTeam,
    DEFAULT_CAMPAIGN.startsAt,
    DEFAULT_CAMPAIGN.closesAt,
  );
  await createCampaignTx.wait();
  console.log(`Default campaign created in tx: ${createCampaignTx.hash}`);

  const deployment = {
    network: hre.network.name,
    deployer: deployer.address,
    soulboundTrophy: soulboundAddress,
    baseURI: TROPHY_BASE_URI,
    defaultCampaign: {
      id: 1,
      ...DEFAULT_CAMPAIGN,
      createTransactionHash: createCampaignTx.hash,
    },
    metadata: {
      name: "Cortex Supporter Passport",
      symbol: "COR-PASS",
      mintPriceEth: "0.001",
      reputationModel: {
        starterReputation: 100,
        faucetReward: 40,
        swapReward: 60,
        predictionReward: 120,
        winReward: 180,
      },
    },
  };

  const outputPath = resolve(process.cwd(), "deployments.soulbound.json");
  writeFileSync(outputPath, JSON.stringify(deployment, null, 2));
  console.log(`Deployment summary written to: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
