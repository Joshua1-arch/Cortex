import hre from "hardhat";

const ROUTER_ADDRESS = "0xDAe32aA0504811CA49503E812DE9D9b6a146E0C5";
const COR_TOKEN_ADDRESS = "0xBE1bC8e22F8246f90C877BfEBc1831AAb150Af69";
const COR_LIQUIDITY_AMOUNT = "0";
const NATIVE_LIQUIDITY_AMOUNT = "0.09";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const corToken = await hre.ethers.getContractAt(ERC20_ABI, COR_TOKEN_ADDRESS);

  const corAmount = hre.ethers.parseUnits(COR_LIQUIDITY_AMOUNT, 18);
  const nativeAmount = hre.ethers.parseEther(NATIVE_LIQUIDITY_AMOUNT);

  console.log(`Funding Cortex router with deployer: ${deployer.address}`);
  console.log(`Router: ${ROUTER_ADDRESS}`);
  console.log(`COR token: ${COR_TOKEN_ADDRESS}`);

  const deployerNativeBefore = await hre.ethers.provider.getBalance(deployer.address);
  const routerNativeBefore = await hre.ethers.provider.getBalance(ROUTER_ADDRESS);
  const deployerCorBefore = await corToken.balanceOf(deployer.address);
  const routerCorBefore = await corToken.balanceOf(ROUTER_ADDRESS);

  console.log(`Deployer native before: ${hre.ethers.formatEther(deployerNativeBefore)} OKB`);
  console.log(`Router native before: ${hre.ethers.formatEther(routerNativeBefore)} OKB`);
  console.log(`Deployer COR before: ${hre.ethers.formatUnits(deployerCorBefore, 18)} COR`);
  console.log(`Router COR before: ${hre.ethers.formatUnits(routerCorBefore, 18)} COR`);

  console.log(`Transferring ${COR_LIQUIDITY_AMOUNT} COR to router...`);
  const corTx = await corToken.transfer(ROUTER_ADDRESS, corAmount);
  await corTx.wait();
  console.log(`COR funding confirmed: ${corTx.hash}`);

  console.log(`Transferring ${NATIVE_LIQUIDITY_AMOUNT} OKB to router...`);
  const nativeTx = await deployer.sendTransaction({
    to: ROUTER_ADDRESS,
    value: nativeAmount,
  });
  await nativeTx.wait();
  console.log(`Native funding confirmed: ${nativeTx.hash}`);

  const routerNativeAfter = await hre.ethers.provider.getBalance(ROUTER_ADDRESS);
  const routerCorAfter = await corToken.balanceOf(ROUTER_ADDRESS);

  console.log(`Router native after: ${hre.ethers.formatEther(routerNativeAfter)} OKB`);
  console.log(`Router COR after: ${hre.ethers.formatUnits(routerCorAfter, 18)} COR`);
  console.log("Router funding complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
