import hre from "hardhat";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const LIVE_XUSDT_ADDRESS = "0x455b612f51d6f87cf1cee0bc0f12922f0e8a3ec8";
const LIVE_FAUCET_ADDRESS = "0x2C379629c667103e6F4D9c486b9B8C424ed9B1E8";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log(`Deploying contracts with: ${deployer.address}`);
  console.log(`Using live xUSDT token: ${LIVE_XUSDT_ADDRESS}`);

  const MockToken = await hre.ethers.getContractFactory("MockToken");
  const mockToken = await MockToken.deploy("xUSDT", "xUSDT");
  await mockToken.waitForDeployment();
  const tokenAddress = await mockToken.getAddress();
  console.log(`MockToken redeployed to: ${tokenAddress}`);

  const tokenMintAmount = hre.ethers.parseUnits("1000000", 18);
  console.log("Minting 1,000,000 xUSDT to deployer...");
  const mintTx = await mockToken.mint(deployer.address, tokenMintAmount);
  await mintTx.wait();
  console.log("Minting confirmed.");

  console.log(`Funding faucet at: ${LIVE_FAUCET_ADDRESS}`);
  const faucetFundingAmount = hre.ethers.parseUnits("500000", 18);
  const fundTx = await mockToken.transfer(LIVE_FAUCET_ADDRESS, faucetFundingAmount);
  await fundTx.wait();
  console.log("Funding confirmed.");

  const deployment = {
    network: hre.network.name,
    deployer: deployer.address,
    quoteToken: tokenAddress,
    faucet: LIVE_FAUCET_ADDRESS,
    mintAmount: tokenMintAmount.toString(),
    faucetFundingAmount: faucetFundingAmount.toString(),
  };

  const outputPath = resolve(process.cwd(), "deployments.faucet.json");
  writeFileSync(outputPath, JSON.stringify(deployment, null, 2));
  console.log(`Deployment summary written to: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
