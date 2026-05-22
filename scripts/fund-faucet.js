import hre from "hardhat";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const LIVE_FAUCET_ADDRESS = "0x2C379629c667103e6F4D9c486b9B8C424ed9B1E8";
const LIVE_XUSDT_ADDRESS = "0x455b612f51d6f87cf1cee0bc0f12922f0e8a3ec8";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log(`Deploying funding script with: ${deployer.address}`);
  console.log(`Using xUSDT token: ${LIVE_XUSDT_ADDRESS}`);
  console.log(`Using faucet address: ${LIVE_FAUCET_ADDRESS}`);

  const mockToken = await hre.ethers.getContractAt("MockToken", LIVE_XUSDT_ADDRESS, deployer);

  const mintAmount = hre.ethers.parseUnits("1000000", 18);
  console.log(`Minting 1,000,000 xUSDT to deployer ${deployer.address}...`);
  const mintTx = await mockToken.mint(deployer.address, mintAmount);
  await mintTx.wait();
  console.log(`Minting confirmed: ${mintTx.hash}`);

  const fundingAmount = hre.ethers.parseUnits("500000", 18);
  console.log(`Funding faucet with 500,000 xUSDT...`);
  const fundTx = await mockToken.transfer(LIVE_FAUCET_ADDRESS, fundingAmount);
  await fundTx.wait();
  console.log(`Funding confirmed: ${fundTx.hash}`);

  const summary = {
    network: hre.network.name,
    deployer: deployer.address,
    token: LIVE_XUSDT_ADDRESS,
    faucet: LIVE_FAUCET_ADDRESS,
    mintAmount: mintAmount.toString(),
    fundingAmount: fundingAmount.toString(),
  };

  const outputPath = resolve(process.cwd(), "deployments.faucet.json");
  writeFileSync(outputPath, JSON.stringify(summary, null, 2));
  console.log(`Success! Wrote deployment summary to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
