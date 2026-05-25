import hre from "hardhat";

async function main() {
  const txHash = process.env.TX_HASH;

  if (!txHash) {
    throw new Error("Usage: TX_HASH=<txHash> npx hardhat run scripts/inspect-tx.js --network xlayerTestnet");
  }

  const tx = await hre.network.provider.request({
    method: "eth_getTransactionByHash",
    params: [txHash],
  });
  const receipt = await hre.network.provider.request({
    method: "eth_getTransactionReceipt",
    params: [txHash],
  });

  console.log("txHash:", txHash);
  console.log("from:", tx?.from ?? null);
  console.log("to:", tx?.to ?? null);
  console.log("nonce:", tx?.nonce ?? null);
  console.log("data:", tx?.input ?? null);
  console.log("status:", receipt?.status ?? null);
  console.log("gasUsed:", receipt?.gasUsed ?? null);
  console.log("blockNumber:", receipt?.blockNumber ?? null);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
