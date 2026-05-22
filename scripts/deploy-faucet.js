import hre from "hardhat";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const LIVE_XUSDT_ADDRESS = "0x455b612f51d6f87cf1cee0bc0f12922f0e8a3ec8";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log(`Deploying XCupFaucet with: ${deployer.address}`);
  console.log(`Using live xUSDT token: ${LIVE_XUSDT_ADDRESS}`);

  const XCupFaucet = await hre.ethers.getContractFactory("XCupFaucet");
  const faucet = await XCupFaucet.deploy(LIVE_XUSDT_ADDRESS);
  await faucet.waitForDeployment();

  const faucetAddress = await faucet.getAddress();
  console.log(`XCupFaucet deployed to: ${faucetAddress}`);

  const deployment = {
    network: hre.network.name,
    deployer: deployer.address,
    quoteToken: LIVE_XUSDT_ADDRESS,
    faucet: faucetAddress,
  };

  const outputPath = resolve(process.cwd(), "deployments.faucet.json");
  writeFileSync(outputPath, JSON.stringify(deployment, null, 2));
  console.log(`Deployment summary written to: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
