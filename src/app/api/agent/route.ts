import { NextResponse } from "next/server";
import { parseEther } from "viem";
import { getContractsForChain, hasConfiguredAddress } from "@/lib/contracts";

type IntentAction = "MINT_TROPHY" | "CLAIM_FAUCET" | "SWAP_TOKENS" | "UNKNOWN";

type IntentRequestBody = {
  prompt: string;
  chainId: number;
};

type IntentResponse = {
  status: "success" | "error";
  action: IntentAction;
  parameters?: {
    amount?: string;
    amountWei?: string;
    tokenIn?: string;
    tokenOut?: string;
    contractAddress?: string;
    functionName?: string;
    value?: string;
    requiresApproval?: boolean;
    approval?: {
      tokenAddress: string;
      spenderAddress: string;
      amount: string;
    };
  };
  humanReadableSummary: string;
};

const DEFAULT_CHAIN_ID = 1952;
const ACTION_KEYWORDS = {
  mintTrophy: ["mint", "trophy", "founder trophy", "soulbound"],
  claimFaucet: ["claim faucet", "faucet", "request tokens", "drip"],
  swapTokens: ["swap", "exchange", "convert", "trade"],
} as const;
const SUPPORTED_SWAP_TOKENS = ["COR", "OKB", "XL"] as const;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json<IntentResponse>(
      {
        status: "error",
        action: "UNKNOWN",
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
        action: "UNKNOWN",
        humanReadableSummary:
          "Missing or invalid request body. Please provide a non-empty prompt string and numeric chainId.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json<IntentResponse>(parseIntent(intentRequest.prompt, intentRequest.chainId));
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

  return { prompt: trimmedPrompt, chainId };
}

export function parseIntent(prompt: string, chainId: number): IntentResponse {
  const normalizedPrompt = prompt.toLowerCase();
  const activeContracts = getContractsForChain(chainId);

  if (looksLikeMintTrophyIntent(normalizedPrompt)) {
    if (!hasConfiguredAddress(activeContracts.soulboundAddress)) {
      return {
        status: "error",
        action: "MINT_TROPHY",
        humanReadableSummary:
          `Soulbound trophy address is not configured for chain ${chainId}. Set the corresponding NEXT_PUBLIC_*_SOULBOUND_ADDRESS variable before executing this intent.`,
      };
    }

    return {
      status: "success",
      action: "MINT_TROPHY",
      parameters: {
        contractAddress: activeContracts.soulboundAddress,
        functionName: "mint",
        value: parseEther("0.001").toString(),
      },
      humanReadableSummary: `Preparing transaction to mint the founder trophy on chain ${chainId}.`,
    };
  }

  if (looksLikeClaimFaucetIntent(normalizedPrompt)) {
    if (!hasConfiguredAddress(activeContracts.faucetAddress)) {
      return {
        status: "error",
        action: "CLAIM_FAUCET",
        humanReadableSummary:
          `Faucet contract is not configured for chain ${chainId}. Set NEXT_PUBLIC_XLAYER_FAUCET_ADDRESS or the chain-specific faucet variable.`,
      };
    }

    return {
      status: "success",
      action: "CLAIM_FAUCET",
      parameters: {
        contractAddress: activeContracts.faucetAddress,
        functionName: "requestTokens",
      },
      humanReadableSummary: `Preparing transaction to claim faucet tokens on chain ${chainId}.`,
    };
  }

  if (looksLikeSwapIntent(normalizedPrompt)) {
    if (!hasConfiguredAddress(activeContracts.swapRouterAddress) || !hasConfiguredAddress(activeContracts.quoteTokenAddress)) {
      return {
        status: "error",
        action: "SWAP_TOKENS",
        humanReadableSummary:
          `Swap infrastructure is not configured for chain ${chainId}. Set the corresponding router and quote token variables before executing this intent.`,
      };
    }

    const amount = extractAmount(prompt) ?? "0.01";
    const isReverseSwap = looksLikeReverseSwapIntent(normalizedPrompt);
    const tokenIn = isReverseSwap ? "COR" : extractToken(prompt, SUPPORTED_SWAP_TOKENS) ?? "OKB";
    const tokenOut = isReverseSwap ? "OKB" : extractDestinationToken(prompt, SUPPORTED_SWAP_TOKENS) ?? "COR";
    const parsedAmount = parseEther(amount);

    return {
      status: "success",
      action: "SWAP_TOKENS",
      parameters: {
        amount,
        amountWei: parsedAmount.toString(),
        tokenIn,
        tokenOut,
        contractAddress: activeContracts.swapRouterAddress,
        functionName: isReverseSwap ? "swapTokensForNative" : "swapNativeForExactTokens",
        value: isReverseSwap ? "0" : parsedAmount.toString(),
        requiresApproval: isReverseSwap,
        approval: isReverseSwap
          ? {
              tokenAddress: activeContracts.quoteTokenAddress,
              spenderAddress: activeContracts.swapRouterAddress,
              amount: parsedAmount.toString(),
            }
          : undefined,
      },
      humanReadableSummary: `Preparing transaction to swap ${amount} ${tokenIn} for ${tokenOut} on chain ${chainId}.`,
    };
  }

  return {
    status: "error",
    action: "UNKNOWN",
    humanReadableSummary:
      "Could not classify the prompt into a supported on-chain action. Try minting a trophy, claiming the faucet, or swapping tokens.",
  };
}

function looksLikeMintTrophyIntent(prompt: string) {
  return ACTION_KEYWORDS.mintTrophy.some((keyword) => prompt.includes(keyword));
}

function looksLikeClaimFaucetIntent(prompt: string) {
  return ACTION_KEYWORDS.claimFaucet.some((keyword) => prompt.includes(keyword));
}

function looksLikeSwapIntent(prompt: string) {
  return ACTION_KEYWORDS.swapTokens.some((keyword) => prompt.includes(keyword));
}

function looksLikeReverseSwapIntent(prompt: string) {
  return prompt.includes("cor to okb") || prompt.includes("swap cor") || prompt.includes("convert cor");
}

function extractAmount(prompt: string): string | null {
  const match = prompt.match(/(\d+(?:\.\d+)?)/);
  return match ? match[1] : null;
}

function extractToken(prompt: string, supportedTokens: readonly string[]): string | null {
  const upperPrompt = prompt.toUpperCase();
  return supportedTokens.find((token) => upperPrompt.includes(token)) ?? null;
}

function extractDestinationToken(prompt: string, supportedTokens: readonly string[]): string | null {
  const upperPrompt = prompt.toUpperCase();
  const pairMatch = upperPrompt.match(/(?:FOR|TO)\s+([A-Z]{2,10})/);

  if (pairMatch && supportedTokens.includes(pairMatch[1] as (typeof supportedTokens)[number])) {
    return pairMatch[1];
  }

  const mentionedTokens = supportedTokens.filter((token) => upperPrompt.includes(token));
  return mentionedTokens.length > 1 ? mentionedTokens[1] : null;
}
