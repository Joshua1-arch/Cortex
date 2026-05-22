import hre from "hardhat";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const TOKEN_ADDRESS = "0xEc290b02308137341bfe1E268B1C32F75971e2E4";
const FAUCET_ADDRESS = "0x2C379629c667103e6F4D9c486b9B8C424ed9B1E8";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log(`Redeploying coherent stack with deployer: ${deployer.address}`);
  console.log(`Using quote token: ${TOKEN_ADDRESS}`);
  console.log(`Using faucet: ${FAUCET_ADDRESS}`);

  const MockNFT = await hre.ethers.getContractFactory("MockNFT");
  const mockNft = await MockNFT.deploy();
  await mockNft.waitForDeployment();
  const nftCollectionAddress = await mockNft.getAddress();
  console.log(`MockNFT deployed to: ${nftCollectionAddress}`);

  const NFTMarketplace = await hre.ethers.getContractFactory("NFTMarketplace");
  const marketplace = await NFTMarketplace.deploy(TOKEN_ADDRESS);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log(`NFTMarketplace deployed to: ${marketplaceAddress}`);

  const XCupSwapRouter = await hre.ethers.getContractFactory("XCupSwapRouter");
  const swapRouter = await XCupSwapRouter.deploy(TOKEN_ADDRESS);
  await swapRouter.waitForDeployment();
  const swapRouterAddress = await swapRouter.getAddress();
  console.log(`XCupSwapRouter deployed to: ${swapRouterAddress}`);

  const token = await hre.ethers.getContractAt("MockToken", TOKEN_ADDRESS, deployer);
  const fundingAmount = hre.ethers.parseUnits("500000", 18);
  console.log(`Funding swap router with ${hre.ethers.formatUnits(fundingAmount, 18)} xUSDT...`);
  const fundRouterTx = await token.transfer(swapRouterAddress, fundingAmount);
  await fundRouterTx.wait();
  console.log(`Swap router funding confirmed: ${fundRouterTx.hash}`);

  const mintedTokenIds = [];
  for (let index = 0; index < 3; index += 1) {
    const mintTx = await mockNft.mintTo(deployer.address);
    await mintTx.wait();
    mintedTokenIds.push(index + 1);
  }
  console.log(`Minted NFT token IDs: ${mintedTokenIds.join(", ")}`);

  const deployment = {
    network: hre.network.name,
    deployer: deployer.address,
    quoteToken: TOKEN_ADDRESS,
    faucet: FAUCET_ADDRESS,
    nftCollection: nftCollectionAddress,
    marketplace: marketplaceAddress,
    swapRouter: swapRouterAddress,
    mintedTokenIds,
  };

  const outputPath = resolve(process.cwd(), "deployments.json");
  writeFileSync(outputPath, JSON.stringify(deployment, null, 2));
  console.log(`Deployment summary written to: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
