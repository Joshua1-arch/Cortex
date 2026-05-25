import hre from "hardhat";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

function logStep(label, value) {
  console.log(`[deploy-cortex] ${label}:`, value);
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log(`Deploying Cortex ecosystem with: ${deployer.address}`);

  const MockToken = await hre.ethers.getContractFactory("MockToken");
  console.log("Deploying Cortex Token (COR)...");
  const corToken = await MockToken.deploy("Cortex Token", "COR");
  await corToken.waitForDeployment();
  const corTokenAddress = await corToken.getAddress();
  console.log(`Cortex Token deployed to: ${corTokenAddress}`);

  const XCupSwapRouter = await hre.ethers.getContractFactory("XCupSwapRouter");
  console.log("Deploying XCupSwapRouter with COR token address...");
  const swapRouter = await XCupSwapRouter.deploy(corTokenAddress);
  await swapRouter.waitForDeployment();
  const swapRouterAddress = await swapRouter.getAddress();
  console.log(`XCupSwapRouter deployed to: ${swapRouterAddress}`);

  const XCupFaucet = await hre.ethers.getContractFactory("XCupFaucet");
  console.log("Deploying XCupFaucet with COR token address...");
  const faucet = await XCupFaucet.deploy(corTokenAddress);
  await faucet.waitForDeployment();
  const faucetAddress = await faucet.getAddress();
  console.log(`XCupFaucet deployed to: ${faucetAddress}`);

  const NFTMarketplace = await hre.ethers.getContractFactory("NFTMarketplace");
  console.log("Deploying admin-managed prediction market...");
  const marketplace = await NFTMarketplace.deploy(corTokenAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log(`Prediction market deployed to: ${marketplaceAddress}`);
  logStep("quoteToken", corTokenAddress);
  logStep("marketplace", marketplaceAddress);

  const SoulboundTrophy = await hre.ethers.getContractFactory("SoulboundTrophy");
  console.log("Deploying founder soulbound trophy...");
  const soulbound = await SoulboundTrophy.deploy("");
  await soulbound.waitForDeployment();
  const soulboundAddress = await soulbound.getAddress();
  console.log(`Soulbound trophy deployed to: ${soulboundAddress}`);

  const mintAmount = hre.ethers.parseUnits("2000000", 18);
  console.log("Minting 2,000,000 COR to deployer...");
  await (await corToken.mint(deployer.address, mintAmount)).wait();
  console.log("Mint confirmed.");

  const faucetFundingAmount = hre.ethers.parseUnits("250000", 18);
  console.log("Funding faucet with 250,000 COR...");
  await (await corToken.transfer(faucetAddress, faucetFundingAmount)).wait();
  console.log("Faucet funding confirmed.");

  const routerFundingAmount = hre.ethers.parseUnits("500000", 18);
  console.log("Funding swap router with 500,000 COR...");
  await (await corToken.transfer(swapRouterAddress, routerFundingAmount)).wait();
  console.log("Router funding confirmed.");

  const rewardPoolAmount = hre.ethers.parseUnits("750000", 18);
  console.log("Funding admin prediction reward pool with 750,000 COR...");
  logStep("rewardPoolAmount", rewardPoolAmount.toString());
  await (await corToken.approve(marketplaceAddress, rewardPoolAmount)).wait();
  await (await marketplace.fundRewardPool(rewardPoolAmount)).wait();
  console.log("Reward pool funding confirmed.");

  const deployment = {
    network: hre.network.name,
    deployer: deployer.address,
    quoteToken: corTokenAddress,
    faucet: faucetAddress,
    marketplace: marketplaceAddress,
    swapRouter: swapRouterAddress,
    soulbound: soulboundAddress,
    faucetFundingAmount: faucetFundingAmount.toString(),
    routerFundingAmount: routerFundingAmount.toString(),
    rewardPoolAmount: rewardPoolAmount.toString(),
  };

  const outputPath = resolve(process.cwd(), "deployments.cortex.json");
  writeFileSync(outputPath, JSON.stringify(deployment, null, 2));
  console.log(`Deployment summary written to: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
