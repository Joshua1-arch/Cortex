const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const DEFAULT_CHAIN_ID = 1952 as const;
const XLAYER_CHAIN_ID = 1952 as const;
const SEPOLIA_CHAIN_ID = 11155111 as const;

type SupportedChainId = typeof XLAYER_CHAIN_ID | typeof SEPOLIA_CHAIN_ID;

export type ChainContracts = {
  chainId: SupportedChainId;
  chainName: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  marketplaceAddress: `0x${string}`;
  quoteTokenAddress: `0x${string}`;
  nftCollectionAddress: `0x${string}`;
  swapRouterAddress: `0x${string}`;
  faucetAddress: `0x${string}`;
  soulboundAddress: `0x${string}`;
  defaultRecipientAddress: `0x${string}`;
};

export type ContractsByChainId = Record<SupportedChainId, ChainContracts>;

function readStringEnv(name: string, fallback: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function readAddressEnv(name: string, fallback: `0x${string}`) {
  const value = process.env[name];

  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.startsWith("0x") && normalized.length === 42
    ? (normalized as `0x${string}`)
    : fallback;
}

export const contractsByChainId: ContractsByChainId = {
  [XLAYER_CHAIN_ID]: {
    chainId: XLAYER_CHAIN_ID,
    chainName: readStringEnv("NEXT_PUBLIC_XLAYER_CHAIN_NAME", "X Layer Testnet"),
    rpcUrl: readStringEnv("NEXT_PUBLIC_XLAYER_RPC_URL", "https://testrpc.xlayer.tech"),
    blockExplorerUrl: readStringEnv(
      "NEXT_PUBLIC_XLAYER_BLOCK_EXPLORER_URL",
      "https://www.oklink.com/xlayer-test",
    ),
    marketplaceAddress: readAddressEnv("NEXT_PUBLIC_XLAYER_MARKETPLACE_ADDRESS", ZERO_ADDRESS),
    quoteTokenAddress: readAddressEnv(
      "NEXT_PUBLIC_XLAYER_QUOTE_TOKEN_ADDRESS",
      ZERO_ADDRESS as `0x${string}`,
    ),
    nftCollectionAddress: readAddressEnv("NEXT_PUBLIC_XLAYER_NFT_COLLECTION_ADDRESS", ZERO_ADDRESS),
    swapRouterAddress: readAddressEnv("NEXT_PUBLIC_XLAYER_SWAP_ROUTER_ADDRESS", ZERO_ADDRESS),
    faucetAddress: readAddressEnv("NEXT_PUBLIC_XLAYER_FAUCET_ADDRESS", ZERO_ADDRESS),
    soulboundAddress: readAddressEnv("NEXT_PUBLIC_XLAYER_SOULBOUND_ADDRESS", ZERO_ADDRESS),
    defaultRecipientAddress: readAddressEnv("NEXT_PUBLIC_XLAYER_RECIPIENT_ADDRESS", ZERO_ADDRESS),
  },
  [SEPOLIA_CHAIN_ID]: {
    chainId: SEPOLIA_CHAIN_ID,
    chainName: readStringEnv("NEXT_PUBLIC_SEPOLIA_CHAIN_NAME", "Ethereum Sepolia"),
    rpcUrl: readStringEnv("NEXT_PUBLIC_SEPOLIA_RPC_URL", "https://ethereum-sepolia-rpc.publicnode.com"),
    blockExplorerUrl: readStringEnv(
      "NEXT_PUBLIC_SEPOLIA_BLOCK_EXPLORER_URL",
      "https://sepolia.etherscan.io",
    ),
    marketplaceAddress: readAddressEnv("NEXT_PUBLIC_SEPOLIA_MARKETPLACE_ADDRESS", ZERO_ADDRESS),
    quoteTokenAddress: readAddressEnv("NEXT_PUBLIC_SEPOLIA_QUOTE_TOKEN_ADDRESS", ZERO_ADDRESS),
    nftCollectionAddress: readAddressEnv("NEXT_PUBLIC_SEPOLIA_NFT_COLLECTION_ADDRESS", ZERO_ADDRESS),
    swapRouterAddress: readAddressEnv("NEXT_PUBLIC_SEPOLIA_SWAP_ROUTER_ADDRESS", ZERO_ADDRESS),
    faucetAddress: readAddressEnv("NEXT_PUBLIC_SEPOLIA_FAUCET_ADDRESS", ZERO_ADDRESS),
    soulboundAddress: readAddressEnv("NEXT_PUBLIC_SEPOLIA_SOULBOUND_ADDRESS", ZERO_ADDRESS),
    defaultRecipientAddress: readAddressEnv("NEXT_PUBLIC_SEPOLIA_RECIPIENT_ADDRESS", ZERO_ADDRESS),
  },
};

export function getContractsForChain(chainId: number) {
  if (chainId === XLAYER_CHAIN_ID) {
    return contractsByChainId[XLAYER_CHAIN_ID];
  }

  if (chainId === SEPOLIA_CHAIN_ID) {
    return contractsByChainId[SEPOLIA_CHAIN_ID];
  }

  return contractsByChainId[DEFAULT_CHAIN_ID];
}

export function hasConfiguredAddress(address: string) {
  return address !== ZERO_ADDRESS;
}
