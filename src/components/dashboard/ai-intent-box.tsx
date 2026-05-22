"use client";

import { Bot } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { BaseError, type Hex, parseAbi, parseEther } from "viem";
import {
  useAccount,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { Button } from "@/components/ui/button";

type IntentAction = "MINT_TROPHY" | "CLAIM_FAUCET" | "SWAP_TOKENS" | "UNKNOWN";

type IntentResponse = {
  status: "success" | "error";
  action: IntentAction;
  parameters?: {
    amount?: string;
    amountWei?: string;
    tokenIn?: string;
    tokenOut?: string;
    contractAddress?: Hex;
    functionName?: string;
    value?: string;
    requiresApproval?: boolean;
    approval?: {
      tokenAddress: Hex;
      spenderAddress: Hex;
      amount: string;
    };
  };
  humanReadableSummary: string;
};

type ExecutionCardState = {
  action: IntentAction;
  parameters: NonNullable<IntentResponse["parameters"]>;
};

type AgentMessageTone = "success" | "error" | "idle";

const SOULBOUND_ABI = parseAbi(["function mint() external payable"]);
const FAUCET_ABI = parseAbi(["function requestTokens() external"]);
const SWAP_ROUTER_ABI = parseAbi([
  "function swapNativeForExactTokens(uint256 amountOut) external payable",
  "function swapTokensForNative(uint256 amountIn) external",
]);
const APPROVE_ABI = parseAbi(["function approve(address spender, uint256 amount) external returns (bool)"]);

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
  const [prompt, setPrompt] = useState("Swap 0.1 OKB for COR...");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExecutingIntent, setIsExecutingIntent] = useState(false);
  const [agentMessage, setAgentMessage] = useState("");
  const [agentMessageTone, setAgentMessageTone] = useState<AgentMessageTone>("idle");
  const [submittedHash, setSubmittedHash] = useState<Hex | undefined>();
  const [executionCard, setExecutionCard] = useState<ExecutionCardState | null>(null);
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

  const isDisabled = isProcessing || isExecutingIntent || prompt.trim().length === 0 || isReceiptPending;
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
    setExecutionCard(null);

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
        setAgentMessage(result.humanReadableSummary || "The AI agent could not process this request.");
        setAgentMessageTone("error");
        return;
      }

      if (!result.parameters?.contractAddress || !result.parameters.functionName) {
        setAgentMessage("The AI agent response did not include execution details.");
        setAgentMessageTone("error");
        return;
      }

      setExecutionCard({
        action: result.action,
        parameters: result.parameters,
      });
      setAgentMessage(result.humanReadableSummary);
      setAgentMessageTone("success");
    } catch (error) {
      const errorMessage = getReceiptErrorMessage(error);
      setAgentMessage(`Transaction Failed: ${errorMessage}`);
      setAgentMessageTone("error");
    } finally {
      setIsProcessing(false);
    }
  }

  async function executeIntent() {
    if (!executionCard) {
      return;
    }

    const { action, parameters } = executionCard;
    setSubmittedHash(undefined);
    setAgentMessageTone("idle");
    setIsExecutingIntent(true);

    try {
      let transactionHash: Hex | undefined;

      if (action === "MINT_TROPHY") {
        transactionHash = await writeContractAsync({
          address: parameters.contractAddress as Hex,
          abi: SOULBOUND_ABI,
          functionName: "mint",
          value: parseEther("0.001"),
        });
      } else if (action === "CLAIM_FAUCET") {
        transactionHash = await writeContractAsync({
          address: parameters.contractAddress as Hex,
          abi: FAUCET_ABI,
          functionName: "requestTokens",
        });
      } else if (action === "SWAP_TOKENS") {
        if (parameters.requiresApproval && parameters.approval) {
          const approvalHash = await writeContractAsync({
            address: parameters.approval.tokenAddress,
            abi: APPROVE_ABI,
            functionName: "approve",
            args: [parameters.approval.spenderAddress, BigInt(parameters.approval.amount)],
          });

          setSubmittedHash(approvalHash);
          setAgentMessage("Waiting for approval confirmation...");
          setAgentMessageTone("idle");
          await publicClient?.waitForTransactionReceipt({ hash: approvalHash });
        }

        const amountWei = BigInt(parameters.amountWei ?? parameters.value ?? "0");

        if (parameters.functionName === "swapTokensForNative") {
          transactionHash = await writeContractAsync({
            address: parameters.contractAddress as Hex,
            abi: SWAP_ROUTER_ABI,
            functionName: "swapTokensForNative",
            args: [amountWei],
          });
        } else {
          transactionHash = await writeContractAsync({
            address: parameters.contractAddress as Hex,
            abi: SWAP_ROUTER_ABI,
            functionName: "swapNativeForExactTokens",
            args: [amountWei],
            value: BigInt(parameters.value ?? "0"),
          });
        }
      }

      if (transactionHash) {
        setSubmittedHash(transactionHash);
        setAgentMessage("Waiting for blockchain confirmation...");
        setAgentMessageTone("idle");
      }
    } catch (error) {
      setAgentMessage(`Transaction Failed: ${getReceiptErrorMessage(error)}`);
      setAgentMessageTone("error");
    } finally {
      setIsExecutingIntent(false);
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
          placeholder="Swap 0.1 OKB for COR..."
          className="min-h-[104px] w-full resize-none rounded-[24px] border border-[#1f2720] bg-[#070909] px-5 py-5 font-mono text-[20px] leading-8 text-[#6f786d] outline-none placeholder:text-[#4a5148]"
        />

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-full border border-[#33373a] bg-[#23252a] px-5 py-3 text-sm text-[#d0d4cf] transition hover:border-[#4a5c4f] hover:bg-[#2a2d32] hover:text-white"
          >
            {`"Claim 1,000 COR from the faucet"`}
          </button>
          <button
            type="button"
            className="rounded-full border border-[#33373a] bg-[#23252a] px-5 py-3 text-sm text-[#d0d4cf] transition hover:border-[#4a5c4f] hover:bg-[#2a2d32] hover:text-white"
          >
            {`"Swap 0.1 OKB for COR"`}
          </button>
          <button
            type="button"
            className="rounded-full border border-[#33373a] bg-[#23252a] px-5 py-3 text-sm text-[#d0d4cf] transition hover:border-[#4a5c4f] hover:bg-[#2a2d32] hover:text-white"
          >
            {`"Mint the founder trophy"`}
          </button>
        </div>

        <div className="mt-5 flex justify-end border-t border-[#1b231d] pt-6">
          <Button
            type="submit"
            disabled={isDisabled}
            isLoading={isProcessing || isReceiptPending}
            className="px-6 py-4 text-base sm:px-10"
          >
            <>
              Submit to AI Agent
              <span className="text-lg">➜</span>
            </>
          </Button>
        </div>

        {executionCard ? (
          <div className="mt-4 rounded-[24px] border border-[#203021] bg-[#132016] px-5 py-4 text-[#eaf1e4] shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
            <div className="text-sm uppercase tracking-[0.24em] text-[#83d896]">Intent Recognized: {executionCard.action}</div>
            <div className="mt-2 text-sm text-[#b7c0b2]">
              {executionCard.action === "SWAP_TOKENS"
                ? `Swap ${executionCard.parameters.amount} ${executionCard.parameters.tokenIn} for ${executionCard.parameters.tokenOut} at 1 OKB = 100,000 COR`
                : executionCard.action === "CLAIM_FAUCET"
                  ? "Claim faucet tokens"
                  : "Mint the founder trophy"}
            </div>
            <Button
              type="button"
              disabled={isExecutingIntent || isReceiptPending}
              isLoading={isExecutingIntent || isReceiptPending}
              onClick={() => void executeIntent()}
              className="mt-4 w-full px-5 py-4 text-base"
            >
              Execute Transaction
            </Button>
          </div>
        ) : null}

        {displayedAgentMessage ? (
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${alertClassName}`}>
            {displayedAgentMessage}
          </div>
        ) : null}
      </form>
    </section>
  );
}
