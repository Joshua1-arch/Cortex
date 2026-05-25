import { NextResponse } from "next/server";
import { getContractsForChain, hasConfiguredAddress } from "@/lib/contracts";

const OKLINK_ENDPOINT = "https://www.oklink.com/api/v5/explorer/address/transaction-list";
const XLAYER_TESTNET_CHAIN_ID = 1952;

type OkLinkTransaction = {
  txId?: string;
  transactionHash?: string;
  hash?: string;
  from?: string;
  to?: string;
  txTime?: string;
  transactionTime?: string;
  timestamp?: string;
  amount?: string;
  value?: string;
  symbol?: string;
  state?: string;
  status?: string;
  txStatus?: string;
  methodId?: string;
  methodName?: string;
  txFee?: string;
};

type OkLinkResponse = {
  code?: string;
  msg?: string;
  data?: Array<{
    transactionLists?: OkLinkTransaction[];
    transactionList?: OkLinkTransaction[];
  }>;
};

type ActivityCategory =
  | "swap"
  | "faucet"
  | "trophy"
  | "approval"
  | "prediction"
  | "claim"
  | "resolution"
  | "transfer"
  | "unknown";

const PREDICTION_MINT_METHODS = ["mintprediction", "creatematch", "openmatch"];
const PREDICTION_CLAIM_METHODS = ["claimreward"];
const PREDICTION_RESOLUTION_METHODS = ["resolvematch", "cancelmatch"];
type ActivityStatus = "success" | "error";

type NormalizedActivity = {
  hash: string;
  hashLabel: string;
  category: ActivityCategory;
  title: string;
  description: string;
  asset: string;
  amount: string;
  unit: string;
  status: ActivityStatus;
  timestamp: string;
  timeLabel: string;
  explorerUrl: string;
  proofLabel: string;
  methodLabel: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        {
          error: "Missing address query parameter",
        },
        { status: 400 },
      );
    }

    const apiKey = process.env.OKLINK_API_KEY || process.env.NEXT_PUBLIC_OKLINK_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "API key missing",
        },
        { status: 500 },
      );
    }

    const upstreamUrl = `${OKLINK_ENDPOINT}?chainShortName=X1_TEST&address=${encodeURIComponent(address)}`;
    const response = await fetch(upstreamUrl, {
      headers: {
        "Ok-Access-Key": apiKey,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();

      return NextResponse.json(
        {
          error: "OKLink API Error",
          details: errorText,
        },
        { status: response.status },
      );
    }

    const data = (await response.json()) as OkLinkResponse;
    const activeContracts = getContractsForChain(XLAYER_TESTNET_CHAIN_ID);
    const transactions =
      data.data?.flatMap((entry) => entry.transactionLists ?? entry.transactionList ?? []) ?? [];

    const activity = transactions.map((transaction) =>
      normalizeTransaction(transaction, activeContracts, address),
    );

    return NextResponse.json({
      address,
      chainId: activeContracts.chainId,
      chainName: activeContracts.chainName,
      proofSource: "OKLink Explorer API",
      totalTransactions: activity.length,
      activity,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

function normalizeTransaction(
  transaction: OkLinkTransaction,
  contracts: ReturnType<typeof getContractsForChain>,
  address: string,
): NormalizedActivity {
  const hash = transaction.txId || transaction.transactionHash || transaction.hash || "unknown";
  const timestamp = transaction.txTime || transaction.transactionTime || transaction.timestamp || "";
  const amount = transaction.amount || transaction.value || "--";
  const unit = transaction.symbol || "";
  const status = getTransactionStatus(transaction);
  const category = detectCategory(transaction, contracts);
  const methodLabel = transaction.methodName || inferMethodLabel(category);
  const title = getCategoryTitle(category, status);
  const description = getCategoryDescription(category, amount, unit, transaction, address);

  return {
    hash,
    hashLabel: truncateHash(hash),
    category,
    title,
    description,
    asset: getAssetLabel(category, amount, unit),
    amount,
    unit,
    status,
    timestamp,
    timeLabel: formatTimestamp(timestamp),
    explorerUrl: `${contracts.blockExplorerUrl.replace(/\/$/, "")}/tx/${hash}`,
    proofLabel: `${contracts.chainName} proof`,
    methodLabel,
  };
}

function detectCategory(
  transaction: OkLinkTransaction,
  contracts: ReturnType<typeof getContractsForChain>,
): ActivityCategory {
  const toAddress = transaction.to?.toLowerCase();
  const fromAddress = transaction.from?.toLowerCase();
  const method = (transaction.methodName || "").toLowerCase();
  const swapRouterAddress = hasConfiguredAddress(contracts.swapRouterAddress)
    ? contracts.swapRouterAddress.toLowerCase()
    : undefined;
  const faucetAddress = hasConfiguredAddress(contracts.faucetAddress)
    ? contracts.faucetAddress.toLowerCase()
    : undefined;
  const soulboundAddress = hasConfiguredAddress(contracts.soulboundAddress)
    ? contracts.soulboundAddress.toLowerCase()
    : undefined;
  const quoteTokenAddress = hasConfiguredAddress(contracts.quoteTokenAddress)
    ? contracts.quoteTokenAddress.toLowerCase()
    : undefined;
  const marketplaceAddress = hasConfiguredAddress(contracts.marketplaceAddress)
    ? contracts.marketplaceAddress.toLowerCase()
    : undefined;

  if (swapRouterAddress && (toAddress === swapRouterAddress || fromAddress === swapRouterAddress)) {
    return "swap";
  }

  if (faucetAddress && (toAddress === faucetAddress || fromAddress === faucetAddress || method.includes("requesttokens"))) {
    return "faucet";
  }

  if (soulboundAddress && (toAddress === soulboundAddress || method === "mint" || method.includes("mintbadge"))) {
    return "trophy";
  }

  if (quoteTokenAddress && method.includes("approve")) {
    return "approval";
  }

  if (
    marketplaceAddress &&
    (toAddress === marketplaceAddress || fromAddress === marketplaceAddress) &&
    PREDICTION_MINT_METHODS.some((methodName) => method.includes(methodName))
  ) {
    return "prediction";
  }

  if (
    marketplaceAddress &&
    (toAddress === marketplaceAddress || fromAddress === marketplaceAddress) &&
    PREDICTION_CLAIM_METHODS.some((methodName) => method.includes(methodName))
  ) {
    return "claim";
  }

  if (
    marketplaceAddress &&
    (toAddress === marketplaceAddress || fromAddress === marketplaceAddress) &&
    PREDICTION_RESOLUTION_METHODS.some((methodName) => method.includes(methodName))
  ) {
    return "resolution";
  }

  if (toAddress || fromAddress) {
    return "transfer";
  }

  return "unknown";
}

function getTransactionStatus(transaction: OkLinkTransaction): ActivityStatus {
  const normalizedStatus = (transaction.txStatus || transaction.status || transaction.state || "").toLowerCase();
  return normalizedStatus.includes("success") || normalizedStatus === "1" ? "success" : "error";
}

function getCategoryTitle(category: ActivityCategory, status: ActivityStatus) {
  if (category === "swap") {
    return status === "success" ? "Reward Swap Executed" : "Reward Swap Failed";
  }

  if (category === "faucet") {
    return status === "success" ? "Faucet Claim Confirmed" : "Faucet Claim Failed";
  }

  if (category === "trophy") {
    return status === "success" ? "Trophy Badge Minted" : "Trophy Mint Failed";
  }

  if (category === "approval") {
    return status === "success" ? "COR Approval Submitted" : "COR Approval Failed";
  }

  if (category === "prediction") {
    return status === "success" ? "Prediction NFT Activity" : "Prediction NFT Transaction Failed";
  }

  if (category === "claim") {
    return status === "success" ? "Prediction Reward Claimed" : "Prediction Reward Claim Failed";
  }

  if (category === "resolution") {
    return status === "success" ? "Match Resolution Confirmed" : "Match Resolution Failed";
  }

  if (category === "transfer") {
    return status === "success" ? "Token Transfer Observed" : "Token Transfer Failed";
  }

  return status === "success" ? "Onchain Activity" : "Failed Onchain Activity";
}

function getCategoryDescription(
  category: ActivityCategory,
  amount: string,
  unit: string,
  transaction: OkLinkTransaction,
  address: string,
) {
  const method = transaction.methodName || "unknown method";
  const normalizedAddress = address.toLowerCase();
  const sender = transaction.from?.toLowerCase();
  const direction = sender === normalizedAddress ? "outgoing" : "incoming";

  if (category === "swap") {
    return `Router swap detected via ${method} with ${amount} ${unit || "asset"}.`;
  }

  if (category === "faucet") {
    return `Faucet funding flow detected via ${method}.`;
  }

  if (category === "trophy") {
    return `Soulbound badge activity detected via ${method}.`;
  }

  if (category === "approval") {
    return `COR approval recorded before marketplace minting or reward flow.`;
  }

  if (category === "prediction") {
    return `Marketplace NFT prediction activity detected via ${method}.`;
  }

  if (category === "claim") {
    return `Prediction reward claim detected via ${method}.`;
  }

  if (category === "resolution") {
    return `Admin match resolution activity detected via ${method}.`;
  }

  if (category === "transfer") {
    return `Generic ${direction} transfer observed onchain.`;
  }

  return `Observed ${direction} activity with ${method}.`;
}

function getAssetLabel(category: ActivityCategory, amount: string, unit: string) {
  if (category === "swap") {
    return `Swap ${amount} ${unit || "asset"}`;
  }

  if (category === "faucet") {
    return `Faucet ${amount} ${unit || "asset"}`;
  }

  if (category === "trophy") {
    return "Soulbound badge";
  }

  if (category === "approval") {
    return `Approval ${amount} ${unit || "asset"}`;
  }

  if (category === "prediction") {
    return "Prediction NFT";
  }

  if (category === "claim") {
    return `Reward ${amount} ${unit || "asset"}`;
  }

  if (category === "resolution") {
    return "Match resolution";
  }

  return `${amount} ${unit || "asset"}`.trim();
}

function inferMethodLabel(category: ActivityCategory) {
  if (category === "swap") {
    return "swap";
  }

  if (category === "faucet") {
    return "requestTokens";
  }

  if (category === "trophy") {
    return "mint";
  }

  if (category === "approval") {
    return "approve";
  }

  if (category === "prediction") {
    return "mintPrediction";
  }

  if (category === "claim") {
    return "claimReward";
  }

  if (category === "resolution") {
    return "resolveMatch";
  }

  return "transfer";
}

function formatTimestamp(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "Pending";
  }

  const milliseconds = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(milliseconds));
}

function truncateHash(value: string) {
  if (!value || value.length <= 12) {
    return value || "unknown";
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
