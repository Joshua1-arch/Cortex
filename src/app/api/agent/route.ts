import { parseEther } from "viem";
import { NextResponse } from "next/server";
import { getContractsForChain, hasConfiguredAddress } from "@/lib/contracts";

type IntentType = "SWAP_TOKENS" | "BUY_NFT" | "UNKNOWN";

type IntentRequestBody = {
  prompt: string;
  chainId: number;
};

type IntentResponse = {
  status: "success" | "error";
  type: IntentType;
  transactionDetails?: {
    contractAddress: string;
    functionName: "buyItem" | "swapNativeForExactTokens" | "swapTokensForNative";
    args: unknown[];
    value: string;
    requiresApproval?: boolean;
    approval?: {
      tokenAddress: string;
      spenderAddress: string;
      amount: string;
    };
  };
  humanReadableSummary: string;
};

type ParsedAmount = {
  raw: string;
  normalized: string;
};

const DEFAULT_CHAIN_ID = 1952;
const NFT_KEYWORDS = ["nft", "brazil", "france", "argentina", "germany", "croatia"];
const SWAP_KEYWORDS = ["swap", "exchange", "convert", "trade token"];
const REVERSE_SWAP_KEYWORDS = ["to okb", "to native", "xusdt to okb", "convert xusdt to native", "swap xusdt to okb"];
const XL_TOKEN_ADDRESS = "0x7777777777777777777777777777777777777777";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json<IntentResponse>(
      {
        status: "error",
        type: "UNKNOWN",
        humanReadableSummary: "Invalid JSON body. Please provide a valid prompt string.",
      },
      { status: 400 },
    );
  }

  const intentRequest = getIntentRequestFromBody(body);

  if (!intentRequest) {
    return NextResponse.json<IntentResponse>(
      {
        status: "error",
        type: "UNKNOWN",
        humanReadableSummary:
          "Missing or invalid request body. Please provide a non-empty prompt string and numeric chainId.",
      },
      { status: 400 },
    );
  }

  const parsedIntent = parseIntent(intentRequest.prompt, intentRequest.chainId);
  return NextResponse.json<IntentResponse>(parsedIntent);
}

function getIntentRequestFromBody(body: unknown): IntentRequestBody | null {
  if (typeof body !== "object" || body === null || !("prompt" in body)) {
    return null;
  }

  const prompt = body.prompt;
  const chainId = "chainId" in body ? body.chainId : DEFAULT_CHAIN_ID;

  if (typeof prompt !== "string") {
    return null;
  }

  const trimmedPrompt = prompt.trim();

  if (trimmedPrompt.length === 0) {
    return null;
  }

  if (typeof chainId !== "number" || !Number.isFinite(chainId)) {
    return null;
  }

  return {
    prompt: trimmedPrompt,
    chainId,
  };
}

export function parseIntent(prompt: string, chainId: number): IntentResponse {
  const normalizedPrompt = prompt.toLowerCase();
  const activeContracts = getContractsForChain(chainId);

  if (looksLikeBuyNftIntent(normalizedPrompt)) {
    if (
      !hasConfiguredAddress(activeContracts.marketplaceAddress)
      || !hasConfiguredAddress(activeContracts.nftCollectionAddress)
    ) {
      return {
        status: "error",
        type: "BUY_NFT",
        humanReadableSummary:
          `NFT marketplace contracts are not configured for chain ${chainId}. Deploy the contracts and set the corresponding NEXT_PUBLIC_* marketplace variables.`,
      };
    }

    const amount = extractAmount(prompt);
    const tokenId = extractTokenId(prompt) ?? 1;
    const paymentAmount = amount?.normalized ?? "50";

    return {
      status: "success",
      type: "BUY_NFT",
      transactionDetails: {
        contractAddress: activeContracts.marketplaceAddress,
        functionName: "buyItem",
        args: [activeContracts.nftCollectionAddress, tokenId],
        value: "0",
      },
      humanReadableSummary: `Preparing transaction to buy NFT #${tokenId} for ${paymentAmount} USDT using the configured marketplace contract on chain ${chainId}.`,
    };
  }

  if (looksLikeSwapIntent(normalizedPrompt)) {
    if (!hasConfiguredAddress(activeContracts.swapRouterAddress)) {
      return {
        status: "error",
        type: "SWAP_TOKENS",
        humanReadableSummary:
          `Swap router is not configured for chain ${chainId}. Set the corresponding NEXT_PUBLIC_* router variables or disable swap execution until a router is available.`,
      };
    }

    const amount = extractAmount(prompt);
    const isReverseSwap = looksLikeReverseSwapIntent(normalizedPrompt);
    const fromToken = isReverseSwap ? "xUSDT" : (extractToken(prompt, ["USDT", "OKB", "XL"]) ?? "USDT");
    const toToken = isReverseSwap
      ? "OKB"
      : (extractDestinationToken(prompt, ["USDT", "OKB", "XL"]) ?? (fromToken === "USDT" ? "OKB" : "USDT"));
    const parsedAmount = parseEther(String(amount?.normalized ?? "100"));

    return {
      status: "success",
      type: "SWAP_TOKENS",
      transactionDetails: isReverseSwap
        ? {
            contractAddress: activeContracts.swapRouterAddress,
            functionName: "swapTokensForNative",
            args: [parsedAmount.toString()],
            value: "0",
            requiresApproval: true,
            approval: {
              tokenAddress: activeContracts.quoteTokenAddress,
              spenderAddress: activeContracts.swapRouterAddress,
              amount: parsedAmount.toString(),
            },
          }
        : {
            contractAddress: activeContracts.swapRouterAddress,
            functionName: "swapNativeForExactTokens",
            args: [parsedAmount.toString()],
            value: parsedAmount.toString(),
          },
      humanReadableSummary: `Preparing transaction to swap ${amount?.normalized ?? "100"} ${fromToken} for ${toToken} through the configured router contract on chain ${chainId}.`,
    };
  }

  return {
    status: "error",
    type: "UNKNOWN",
    humanReadableSummary:
      "Could not classify the prompt into a supported on-chain action. Try a swap or NFT purchase instruction.",
  };
}

function looksLikeBuyNftIntent(prompt: string) {
  return prompt.includes("buy") && NFT_KEYWORDS.some((keyword) => prompt.includes(keyword));
}

function looksLikeSwapIntent(prompt: string) {
  return SWAP_KEYWORDS.some((keyword) => prompt.includes(keyword));
}

function looksLikeReverseSwapIntent(prompt: string) {
  return REVERSE_SWAP_KEYWORDS.some((keyword) => prompt.includes(keyword));
}

function extractAmount(prompt: string): ParsedAmount | null {
  const match = prompt.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }

  return {
    raw: match[1],
    normalized: match[1],
  };
}

function extractTokenId(prompt: string): number | null {
  const match = prompt.match(/#(\d+)/);
  return match ? Number(match[1]) : null;
}

function extractToken(prompt: string, supportedTokens: string[]): string | null {
  const upperPrompt = prompt.toUpperCase();
  return supportedTokens.find((token) => upperPrompt.includes(token)) ?? null;
}

function extractDestinationToken(prompt: string, supportedTokens: string[]): string | null {
  const upperPrompt = prompt.toUpperCase();
  const pairMatch = upperPrompt.match(/(?:FOR|TO)\s+([A-Z]{2,10})/);

  if (pairMatch && supportedTokens.includes(pairMatch[1])) {
    return pairMatch[1];
  }

  const mentionedTokens = supportedTokens.filter((token) => upperPrompt.includes(token));
  return mentionedTokens.length > 1 ? mentionedTokens[1] : null;
}

function resolveTokenAddress(
  token: string,
  quoteTokenAddress: string,
  defaultRecipientAddress: string,
): string {
  switch (token) {
    case "USDT":
      return quoteTokenAddress;
    case "OKB":
      return defaultRecipientAddress;
    case "XL":
      return XL_TOKEN_ADDRESS;
    default:
      return quoteTokenAddress;
  }
}
