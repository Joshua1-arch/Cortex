import hre from "hardhat";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

function nowPlus(secondsFromNow) {
  return Math.floor(Date.now() / 1000) + secondsFromNow;
}

function buildMatchMetadata({ title, description, image }) {
  return `data:application/json;base64,${Buffer.from(
    JSON.stringify({
      name: title,
      description,
      image,
    }),
  ).toString("base64")}`;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log(`Redeploying coherent stack with deployer: ${deployer.address}`);

  const MockToken = await hre.ethers.getContractFactory("MockToken");
  const corToken = await MockToken.deploy("Cortex Token", "COR");
  await corToken.waitForDeployment();
  const quoteTokenAddress = await corToken.getAddress();
  console.log(`COR token deployed to: ${quoteTokenAddress}`);

  const XCupFaucet = await hre.ethers.getContractFactory("XCupFaucet");
  const faucet = await XCupFaucet.deploy(quoteTokenAddress);
  await faucet.waitForDeployment();
  const faucetAddress = await faucet.getAddress();
  console.log(`Faucet deployed to: ${faucetAddress}`);

  const NFTMarketplace = await hre.ethers.getContractFactory("NFTMarketplace");
  const marketplace = await NFTMarketplace.deploy(quoteTokenAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log(`Prediction marketplace deployed to: ${marketplaceAddress}`);

  const XCupSwapRouter = await hre.ethers.getContractFactory("XCupSwapRouter");
  const swapRouter = await XCupSwapRouter.deploy(quoteTokenAddress);
  await swapRouter.waitForDeployment();
  const swapRouterAddress = await swapRouter.getAddress();
  console.log(`Swap router deployed to: ${swapRouterAddress}`);

  const SoulboundTrophy = await hre.ethers.getContractFactory("SoulboundTrophy");
  const soulbound = await SoulboundTrophy.deploy("");
  await soulbound.waitForDeployment();
  const soulboundAddress = await soulbound.getAddress();
  console.log(`Soulbound trophy deployed to: ${soulboundAddress}`);

  const mintAmount = hre.ethers.parseUnits("2000000", 18);
  const rewardPoolAmount = hre.ethers.parseUnits("750000", 18);
  const routerFundingAmount = hre.ethers.parseUnits("500000", 18);
  const faucetFundingAmount = hre.ethers.parseUnits("250000", 18);

  await (await corToken.mint(deployer.address, mintAmount)).wait();
  console.log(`Minted ${hre.ethers.formatUnits(mintAmount, 18)} COR to deployer`);

  await (await corToken.transfer(faucetAddress, faucetFundingAmount)).wait();
  console.log(`Funded faucet with ${hre.ethers.formatUnits(faucetFundingAmount, 18)} COR`);

  await (await corToken.transfer(swapRouterAddress, routerFundingAmount)).wait();
  console.log(`Funded swap router with ${hre.ethers.formatUnits(routerFundingAmount, 18)} COR`);

  await (await corToken.approve(marketplaceAddress, rewardPoolAmount)).wait();
  await (await marketplace.fundRewardPool(rewardPoolAmount)).wait();
  console.log(`Funded prediction reward pool with ${hre.ethers.formatUnits(rewardPoolAmount, 18)} COR`);

  const seededMatches = [
    {
      slug: "brazil-vs-france-semi",
      title: "Brazil vs France — Semifinal Winner",
      description: "Admin-created winner market for the semifinal.",
      image: "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1200&q=80",
      rewardAssetSymbol: "COR",
      options: ["Brazil", "France"],
      entryPrice: hre.ethers.parseUnits("10", 18),
      rewardAmount: hre.ethers.parseUnits("18", 18),
      opensAt: nowPlus(-300),
      closesAt: nowPlus(86400),
      openImmediately: true,
    },
    {
      slug: "argentina-vs-spain-final",
      title: "Argentina vs Spain — Final Winner",
      description: "Admin-created winner market for the final.",
      image: "https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=1200&q=80",
      rewardAssetSymbol: "COR",
      options: ["Argentina", "Spain"],
      entryPrice: hre.ethers.parseUnits("12", 18),
      rewardAmount: hre.ethers.parseUnits("22", 18),
      opensAt: nowPlus(-300),
      closesAt: nowPlus(172800),
      openImmediately: true,
    },
  ];

  const createdMatchIds = [];

  for (const matchConfig of seededMatches) {
    const metadataUri = buildMatchMetadata({
      title: matchConfig.title,
      description: matchConfig.description,
      image: matchConfig.image,
    });

    const tx = await marketplace.createMatch(
      matchConfig.slug,
      matchConfig.title,
      matchConfig.description,
      matchConfig.image,
      matchConfig.rewardAssetSymbol,
      metadataUri,
      matchConfig.options,
      matchConfig.entryPrice,
      matchConfig.rewardAmount,
      matchConfig.opensAt,
      matchConfig.closesAt,
      matchConfig.openImmediately,
    );
    const receipt = await tx.wait();
    const log = receipt.logs.find((entry) => entry.fragment?.name === "MatchCreated");
    const matchId = log?.args?.matchId?.toString() ?? createdMatchIds.length + 1;
    createdMatchIds.push(Number(matchId));
    console.log(`Created seeded match #${matchId}: ${matchConfig.title}`);
  }

  const deployment = {
    network: hre.network.name,
    deployer: deployer.address,
    quoteToken: quoteTokenAddress,
    faucet: faucetAddress,
    marketplace: marketplaceAddress,
    swapRouter: swapRouterAddress,
    soulbound: soulboundAddress,
    fundedRewardPool: rewardPoolAmount.toString(),
    routerFundingAmount: routerFundingAmount.toString(),
    faucetFundingAmount: faucetFundingAmount.toString(),
    createdMatchIds,
    seededMatches: seededMatches.map((matchConfig, index) => ({
      matchId: createdMatchIds[index],
      slug: matchConfig.slug,
      title: matchConfig.title,
      options: matchConfig.options,
      entryPrice: matchConfig.entryPrice.toString(),
      rewardAmount: matchConfig.rewardAmount.toString(),
      opensAt: matchConfig.opensAt,
      closesAt: matchConfig.closesAt,
    })),
  };

  const outputPath = resolve(process.cwd(), "deployments.json");
  writeFileSync(outputPath, JSON.stringify(deployment, null, 2));
  console.log(`Deployment summary written to: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
