"use client";

import { Bot, Loader2 } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { BaseError, type Hex, parseAbi } from "viem";
import {
  useAccount,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

type IntentType = "SWAP_TOKENS" | "BUY_NFT" | "UNKNOWN";

type AgentTransactionDetails = {
  contractAddress: Hex;
  functionName: "buyItem" | "swapNativeForExactTokens" | "swapTokensForNative";
  args: unknown[];
  value: string;
  requiresApproval?: boolean;
  approval?: {
    tokenAddress: Hex;
    spenderAddress: Hex;
    amount: string;
  };
};
type IntentResponse = {
  status: "success" | "error";
  type: IntentType;
  transactionDetails?: AgentTransactionDetails;
  humanReadableSummary: string;
};

type AgentMessageTone = "success" | "error" | "idle";

const MARKETPLACE_ABI = [
  {
    type: "function",
    name: "buyItem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const SWAP_ROUTER_ABI = parseAbi([
  "function swapNativeForExactTokens(uint256 amountOut) external payable",
]);

const APPROVE_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
]);

const SWAP_TOKENS_FOR_NATIVE_ABI = parseAbi([
  "function swapTokensForNative(uint256 amountIn) external",
  "error InsufficientNativeLiquidity()",
  "error TransferFailed()",
]);

function getReceiptErrorMessage(error: unknown) {
  if (error instanceof BaseError) {
    return error.shortMessage || error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown transaction error.";
}

export function AIIntentBox() {
  const [prompt, setPrompt] = useState("Swap 0.1 OKB for xUSDT...");
  const [isProcessing, setIsProcessing] = useState(false);
  const [agentMessage, setAgentMessage] = useState("");
  const [agentMessageTone, setAgentMessageTone] = useState<AgentMessageTone>("idle");
  const [submittedHash, setSubmittedHash] = useState<Hex | undefined>();
  const { chainId } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const {
    isLoading: isReceiptPending,
    isSuccess: isReceiptSuccess,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: submittedHash,
  });

  const isDisabled = isProcessing || prompt.trim().length === 0 || isReceiptPending;
  const activeChainId = chainId ?? 1952;

  const derivedAgentFeedback = useMemo(() => {
    if (!submittedHash) {
      return null;
    }

    if (isReceiptPending) {
      return {
        message: "Waiting for blockchain confirmation...",
        tone: "idle" as const,
      };
    }

    if (isReceiptSuccess) {
      return {
        message: "Transaction Confirmed Successfully!",
        tone: "success" as const,
      };
    }

    if (isReceiptError) {
      return {
        message: `Transaction Failed: ${getReceiptErrorMessage(receiptError)}`,
        tone: "error" as const,
      };
    }

    return null;
  }, [isReceiptError, isReceiptPending, isReceiptSuccess, receiptError, submittedHash]);

  const displayedAgentMessage = derivedAgentFeedback?.message ?? agentMessage;
  const displayedAgentTone = derivedAgentFeedback?.tone ?? agentMessageTone;

  const alertClassName = useMemo(() => {
    if (displayedAgentTone === "success") {
      return "border-emerald-200 bg-emerald-50 text-emerald-600";
    }

    if (displayedAgentTone === "error") {
      return "border-rose-200 bg-rose-50 text-rose-600";
    }

    return "border-zinc-200 bg-zinc-100 text-zinc-600";
  }, [displayedAgentTone]);

  async function handleExecute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (prompt.trim().length === 0) {
      setAgentMessage("Please enter an instruction for the AI agent.");
      setAgentMessageTone("error");
      return;
    }

    setIsProcessing(true);
    setSubmittedHash(undefined);
    setAgentMessage("");
    setAgentMessageTone("idle");

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, chainId: activeChainId }),
      });

      const result = (await response.json()) as IntentResponse;

      if (!response.ok || result.status === "error") {
        setAgentMessage(
          result.humanReadableSummary || "The AI agent could not process this request.",
        );
        setAgentMessageTone("error");
        return;
      }

      if (!result.transactionDetails) {
        setAgentMessage("The AI agent response did not include transaction details.");
        setAgentMessageTone("error");
        return;
      }

      let transactionHash: Hex;

      if (result.transactionDetails.functionName === "buyItem") {
        const buyArgs = result.transactionDetails.args as [Hex, number | string | bigint];

        transactionHash = await writeContractAsync({
          address: result.transactionDetails.contractAddress,
          abi: MARKETPLACE_ABI,
          functionName: "buyItem",
          args: [buyArgs[0], BigInt(buyArgs[1])],
        });
      } else if (result.transactionDetails.functionName === "swapNativeForExactTokens") {
        const swapArgs = result.transactionDetails.args.map((arg) =>
          typeof arg === "string" ? BigInt(arg) : arg,
        ) as [bigint];
        const swapValue = result.transactionDetails.value
          ? BigInt(result.transactionDetails.value)
          : undefined;

        transactionHash = await writeContractAsync({
          address: result.transactionDetails.contractAddress,
          abi: SWAP_ROUTER_ABI,
          functionName: "swapNativeForExactTokens",
          args: swapArgs,
          value: swapValue,
        });
      } else {
        const swapArgs = result.transactionDetails.args.map((arg) =>
          typeof arg === "string" ? BigInt(arg) : arg,
        ) as [bigint];

        if (result.transactionDetails.requiresApproval && result.transactionDetails.approval) {
          const approvalHash = await writeContractAsync({
            address: result.transactionDetails.approval.tokenAddress,
            abi: APPROVE_ABI,
            functionName: "approve",
            args: [
              result.transactionDetails.approval.spenderAddress,
              BigInt(result.transactionDetails.approval.amount),
            ],
          });

          setSubmittedHash(approvalHash);
          setAgentMessage("Waiting for approval confirmation...");
          setAgentMessageTone("idle");
          await publicClient?.waitForTransactionReceipt({ hash: approvalHash });
        }

        transactionHash = await writeContractAsync({
          address: result.transactionDetails.contractAddress,
          abi: SWAP_TOKENS_FOR_NATIVE_ABI,
          functionName: "swapTokensForNative",
          args: swapArgs,
        });
      }

      setSubmittedHash(transactionHash);
      setAgentMessage("Waiting for blockchain confirmation...");
      setAgentMessageTone("idle");
    } catch (error) {
      const errorMessage = getReceiptErrorMessage(error);
      setAgentMessage(`Transaction Failed: ${errorMessage}`);
      setAgentMessageTone("error");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <section className="rounded-[34px] border border-[#1f2c20] bg-[linear-gradient(180deg,#161918_0%,#121514_100%)] px-5 py-5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] sm:px-7 sm:py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-full border border-[#2d7d4a] bg-[#173321] text-[#61f49a] shadow-[0_0_16px_rgba(97,244,154,0.12)]">
            <Bot className="size-5 stroke-[2.1]" />
          </div>
          <h2 className="text-xl font-semibold tracking-[-0.04em] text-[#f3f6f0] sm:text-[20px]">
            AI Agent Intent
          </h2>
        </div>
        <span className="rounded-full border border-[#243126] bg-[#111713] px-3 py-1.5 text-xs font-medium text-[#a9b2a6]">
          v1.2-beta
        </span>
      </div>

      <form
        onSubmit={handleExecute}
        className="rounded-[28px] border border-[#1e2820] bg-[linear-gradient(180deg,#171a18_0%,#101211_100%)] p-4 sm:p-5"
      >
        <textarea
          rows={5}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Swap 0.1 OKB for xUSDT..."
          className="min-h-[104px] w-full resize-none rounded-[24px] border border-[#1f2720] bg-[#070909] px-5 py-5 font-mono text-[20px] leading-8 text-[#6f786d] outline-none placeholder:text-[#4a5148]"
        />

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-full border border-[#33373a] bg-[#23252a] px-5 py-3 text-sm text-[#d0d4cf]"
          >
            {`"Sell all my NFTs"`}
          </button>
          <button
            type="button"
            className="rounded-full border border-[#33373a] bg-[#23252a] px-5 py-3 text-sm text-[#d0d4cf]"
          >
            {`"Buy $XC with 10% portfolio"`}
          </button>
          <button
            type="button"
            className="rounded-full border border-[#33373a] bg-[#23252a] px-5 py-3 text-sm text-[#d0d4cf]"
          >
            {`"Rebalance to USDC"`}
          </button>
        </div>

        <div className="mt-5 flex justify-end border-t border-[#1b231d] pt-6">
          <button
            type="submit"
            disabled={isDisabled}
            className="inline-flex items-center gap-3 rounded-[18px] bg-[#67f58f] px-6 py-4 text-base font-semibold text-[#081108] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:px-10"
          >
            {isProcessing || isReceiptPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {isReceiptPending ? "Confirming..." : "Processing..."}
              </>
            ) : (
              <>
                Submit to AI Agent
                <span className="text-lg">➜</span>
              </>
            )}
          </button>
        </div>

        {displayedAgentMessage ? (
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${alertClassName}`}>
            {displayedAgentMessage}
          </div>
        ) : null}
      </form>
    </section>
  );
}
