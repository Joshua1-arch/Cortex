import hre from "hardhat";

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

  const mintAmount = hre.ethers.parseUnits("1000000", 18);
  console.log("Minting 1,000,000 COR to deployer...");
  const mintTx = await corToken.mint(deployer.address, mintAmount);
  await mintTx.wait();
  console.log("Mint confirmed.");

  const faucetFundingAmount = hre.ethers.parseUnits("500000", 18);
  console.log("Funding faucet with 500,000 COR...");
  const fundingTx = await corToken.transfer(faucetAddress, faucetFundingAmount);
  await fundingTx.wait();
  console.log("Faucet funding confirmed.");

  console.log("Deployment pipeline complete.");
  console.log(`COR token: ${corTokenAddress}`);
  console.log(`Router: ${swapRouterAddress}`);
  console.log(`Faucet: ${faucetAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
