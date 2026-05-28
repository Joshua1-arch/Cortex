"use client";

import { Bot, CheckCircle2, ExternalLink, ShieldAlert, Sparkles } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { BaseError, type Hex, parseAbi, parseEther } from "viem";
import {
  useAccount,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { Button } from "@/components/ui/button";

type IntentAction = "MINT_TROPHY" | "CLAIM_FAUCET" | "SWAP_TOKENS" | "MINT_PREDICTION" | "UNKNOWN";
type IntentGoal =
  | "MINT_TROPHY"
  | "CLAIM_COR"
  | "SWAP_OKB_TO_COR"
  | "SWAP_COR_TO_OKB"
  | "EARN_AND_MINT"
  | "MINT_MATCH_PREDICTION"
  | "UNKNOWN";
type PlannerStepKind = "transaction" | "approval" | "guidance";
type PlannerStepStatus = "ready" | "blocked" | "advisory";
type PlannerPrerequisiteStatus = "satisfied" | "required" | "warning";
type PlannerSeverity = "info" | "warning" | "error";

type ExecutionParameters = {
  amount?: string;
  amountWei?: string;
  tokenIn?: string;
  tokenOut?: string;
  contractAddress?: Hex;
  functionName?: string;
  value?: string;
  requiresApproval?: boolean;
  matchId?: string;
  matchTitle?: string;
  selectedOption?: string;
  selectedOptionIndex?: number;
  approval?: {
    tokenAddress: Hex;
    spenderAddress: Hex;
    amount: string;
  };
};

type PlannerPrerequisite = {
  id: string;
  label: string;
  status: PlannerPrerequisiteStatus;
  description: string;
};

type PlannerStep = {
  id: string;
  title: string;
  kind: PlannerStepKind;
  status: PlannerStepStatus;
  description: string;
  ctaLabel?: string;
  action: IntentAction;
  parameters?: ExecutionParameters;
  blockers?: string[];
};

type RecoveryTip = {
  title: string;
  description: string;
  severity: PlannerSeverity;
};

type IntentResponse = {
  status: "success" | "error";
  action: IntentAction;
  goal: IntentGoal;
  parameters?: ExecutionParameters;
  humanReadableSummary: string;
  planner?: {
    goal: IntentGoal;
    chainId: number;
    chainName: string;
    prompt: string;
    summary: string;
    prerequisites: PlannerPrerequisite[];
    steps: PlannerStep[];
    recovery: RecoveryTip[];
  };
};

type ExecutedStepState = Record<string, { hash: Hex; label: string }>;
type CompletedActionState = Partial<Record<IntentAction | "APPROVAL", boolean>>;

type AgentMessageTone = "success" | "error" | "idle";

const SOULBOUND_ABI = parseAbi(["function mint() external payable"]);
const FAUCET_ABI = parseAbi(["function requestTokens() external"]);
const SWAP_ROUTER_ABI = parseAbi([
  "function swapNativeForExactTokens(uint256 amountOut) external payable",
  "function swapTokensForNative(uint256 amountIn) external",
]);
const APPROVE_ABI = parseAbi(["function approve(address spender, uint256 amount) external returns (bool)"]);
const SAMPLE_PROMPTS = [
  "Claim 1,000 COR from the faucet",
  "Swap 0.1 OKB for COR",
  "Swap 10000 COR to OKB",
  "Get COR and mint the founder trophy",
  "Predict Nigeria vs Ghana for Nigeria",
];

function getReceiptErrorMessage(error: unknown) {
  if (error instanceof BaseError) {
    return error.shortMessage || error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown transaction error.";
}

function formatGoalLabel(goal: IntentGoal) {
  switch (goal) {
    case "CLAIM_COR":
      return "Claim COR";
    case "SWAP_OKB_TO_COR":
      return "Swap OKB → COR";
    case "SWAP_COR_TO_OKB":
      return "Swap COR → OKB";
    case "MINT_TROPHY":
      return "Mint Trophy";
    case "EARN_AND_MINT":
      return "Earn + Mint Journey";
    case "MINT_MATCH_PREDICTION":
      return "Mint Match Prediction";
    default:
      return "Unsupported Goal";
  }
}

function formatStepStatusLabel(status: PlannerStepStatus) {
  if (status === "ready") {
    return "Ready";
  }

  if (status === "blocked") {
    return "Blocked";
  }

  return "Advisory";
}

function getStepBadgeClassName(status: PlannerStepStatus) {
  if (status === "ready") {
    return "border-[#285833] bg-[#132817] text-[#83ef9c]";
  }

  if (status === "blocked") {
    return "border-[#4f2a2a] bg-[#241313] text-[#ff9c9c]";
  }

  return "border-[#38403a] bg-[#171c18] text-[#bfc8ba]";
}

function getPrerequisiteBadgeClassName(status: PlannerPrerequisiteStatus) {
  if (status === "satisfied") {
    return "border-[#285833] bg-[#132817] text-[#83ef9c]";
  }

  if (status === "required") {
    return "border-[#4f2a2a] bg-[#241313] text-[#ff9c9c]";
  }

  return "border-[#554d22] bg-[#24200f] text-[#f5df7b]";
}

function getRecoveryToneClassName(severity: PlannerSeverity) {
  if (severity === "error") {
    return "border-[#4f2a2a] bg-[#1f1010] text-[#ffc2c2]";
  }

  if (severity === "warning") {
    return "border-[#5d5322] bg-[#1f1b0c] text-[#f4e39d]";
  }

  return "border-[#21372a] bg-[#0f1812] text-[#bfdfc9]";
}

export function AIIntentBox() {
  const [prompt, setPrompt] = useState("Get COR and mint the founder trophy");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExecutingIntent, setIsExecutingIntent] = useState(false);
  const [agentMessage, setAgentMessage] = useState("");
  const [agentMessageTone, setAgentMessageTone] = useState<AgentMessageTone>("idle");
  const [submittedHash, setSubmittedHash] = useState<Hex | undefined>();
  const [executedSteps, setExecutedSteps] = useState<ExecutedStepState>({});
  const [executingStepId, setExecutingStepId] = useState<string | null>(null);
  const [completedActions, setCompletedActions] = useState<CompletedActionState>({});
  const [isStepConfirming, setIsStepConfirming] = useState(false);
  const [plannerResult, setPlannerResult] = useState<IntentResponse["planner"] | null>(null);
  const [debugState, setDebugState] = useState<string | null>(null);
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

  const isDisabled = isProcessing || prompt.trim().length === 0 || isExecutingIntent || isStepConfirming;
  const activeChainId = chainId ?? 1952;

  const derivedAgentFeedback = useMemo(() => {
    if (!submittedHash) {
      return null;
    }

    if (isReceiptPending && isStepConfirming) {
      return {
        message: "Waiting for blockchain confirmation...",
        tone: "idle" as const,
      };
    }

    if (isReceiptSuccess) {
      return {
        message: "Transaction confirmed successfully.",
        tone: "success" as const,
      };
    }

    if (isReceiptError) {
      return {
        message: `Transaction failed: ${getReceiptErrorMessage(receiptError)}`,
        tone: "error" as const,
      };
    }

    return null;
  }, [isReceiptError, isReceiptPending, isReceiptSuccess, receiptError, submittedHash]);

  const displayedAgentMessage = derivedAgentFeedback?.message ?? agentMessage;
  const displayedAgentTone = derivedAgentFeedback?.tone ?? agentMessageTone;

  const alertClassName = useMemo(() => {
    if (displayedAgentTone === "success") {
      return "border-[#285833] bg-[#101a12] text-[#9ce7ac]";
    }

    if (displayedAgentTone === "error") {
      return "border-[#4f2a2a] bg-[#1c1010] text-[#ffb4b4]";
    }

    return "border-[#243126] bg-[#111713] text-[#bdc7b9]";
  }, [displayedAgentTone]);

  const readyStepCount = plannerResult?.steps.filter((step) => step.status === "ready").length ?? 0;

  async function handleExecute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (prompt.trim().length === 0) {
      setAgentMessage("Please enter an instruction for the Cortex agent.");
      setAgentMessageTone("error");
      return;
    }

    setIsProcessing(true);
    setSubmittedHash(undefined);
    setAgentMessage("");
    setAgentMessageTone("idle");
    setPlannerResult(null);
    setExecutedSteps({});
    setExecutingStepId(null);
    setCompletedActions({});
    setIsStepConfirming(false);
    setDebugState(null);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, chainId: activeChainId }),
      });

      const result = (await response.json()) as IntentResponse;
      setPlannerResult(result.planner ?? null);

      if (!response.ok || result.status === "error") {
        setAgentMessage(result.humanReadableSummary || "The Cortex agent could not process this request.");
        setAgentMessageTone("error");
        return;
      }

      setAgentMessage(result.humanReadableSummary);
      setAgentMessageTone("success");
    } catch (error) {
      const errorMessage = getReceiptErrorMessage(error);
      setAgentMessage(`Planner request failed: ${errorMessage}`);
      setAgentMessageTone("error");
    } finally {
      setIsProcessing(false);
    }
  }

  async function executeStep(step: PlannerStep) {
    if (!step.parameters || step.status !== "ready") {
      return;
    }

    if (!chainId) {
      setAgentMessage("Connect your wallet first so the planner can read the active network.");
      setAgentMessageTone("error");
      return;
    }

    setSubmittedHash(undefined);
    setAgentMessageTone("idle");
    setIsExecutingIntent(true);
    setIsStepConfirming(false);
    setExecutingStepId(step.id);
    setDebugState(`Starting step ${step.id} on chain ${chainId}.`);

    try {
      let transactionHash: Hex | undefined;

      if (step.kind === "approval") {
        if (!step.parameters.approval) {
          throw new Error("Approval metadata is missing for this step.");
        }

        transactionHash = await writeContractAsync({
          address: step.parameters.approval.tokenAddress,
          abi: APPROVE_ABI,
          functionName: "approve",
          args: [step.parameters.approval.spenderAddress, BigInt(step.parameters.approval.amount)],
        });
      } else if (step.action === "MINT_TROPHY") {
        transactionHash = await writeContractAsync({
          address: step.parameters.contractAddress as Hex,
          abi: SOULBOUND_ABI,
          functionName: "mint",
          value: BigInt(step.parameters.value ?? parseEther("0.001").toString()),
        });
      } else if (step.action === "CLAIM_FAUCET") {
        transactionHash = await writeContractAsync({
          address: step.parameters.contractAddress as Hex,
          abi: FAUCET_ABI,
          functionName: "requestTokens",
        });
      } else if (step.action === "SWAP_TOKENS") {
        const amountWei = BigInt(step.parameters.amountWei ?? step.parameters.value ?? "0");

        if (step.parameters.functionName === "swapTokensForNative") {
          transactionHash = await writeContractAsync({
            address: step.parameters.contractAddress as Hex,
            abi: SWAP_ROUTER_ABI,
            functionName: "swapTokensForNative",
            args: [amountWei],
          });
        } else if (step.parameters.functionName === "swapNativeForExactTokens") {
          transactionHash = await writeContractAsync({
            address: step.parameters.contractAddress as Hex,
            abi: SWAP_ROUTER_ABI,
            functionName: "swapNativeForExactTokens",
            args: [amountWei],
            value: BigInt(step.parameters.value ?? "0"),
          });
        } else if (step.parameters.functionName === "approve" && step.parameters.approval) {
          transactionHash = await writeContractAsync({
            address: step.parameters.approval.tokenAddress,
            abi: APPROVE_ABI,
            functionName: "approve",
            args: [step.parameters.approval.spenderAddress, BigInt(step.parameters.approval.amount)],
          });
        }
      }

      if (transactionHash) {
        setSubmittedHash(transactionHash);
        setExecutedSteps((current) => ({
          ...current,
          [step.id]: {
            hash: transactionHash as Hex,
            label: step.title,
          },
        }));
        setAgentMessage(`${step.title} submitted. Waiting for blockchain confirmation...`);
        setAgentMessageTone("idle");
        setIsStepConfirming(true);
        setDebugState(
          `Submitted ${step.id} with hash ${transactionHash}. Waiting for receipt via public client on chain ${chainId}.`,
        );
        await publicClient?.waitForTransactionReceipt({ hash: transactionHash });
        setCompletedActions((current) => ({
          ...current,
          [step.kind === "approval" ? "APPROVAL" : step.action]: true,
        }));
        setAgentMessage(`${step.title} confirmed successfully.`);
        setAgentMessageTone("success");
        setDebugState(`Receipt confirmed for ${step.id} with hash ${transactionHash}. Approval gate released.`);
        setIsStepConfirming(false);
      }
    } catch (error) {
      setAgentMessage(`Transaction failed: ${getReceiptErrorMessage(error)}`);
      setAgentMessageTone("error");
      setDebugState(`Step ${step.id} failed while awaiting receipt: ${getReceiptErrorMessage(error)}`);
    } finally {
      setIsExecutingIntent(false);
      setExecutingStepId(null);
      setIsStepConfirming(false);
    }
  }

  return (
    <section className="rounded-[34px] border border-[#1f2c20] bg-[linear-gradient(180deg,#161918_0%,#121514_100%)] px-5 py-5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] sm:px-7 sm:py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-full border border-[#2d7d4a] bg-[#173321] text-[#61f49a] shadow-[0_0_16px_rgba(97,244,154,0.12)]">
            <Bot className="size-5 stroke-[2.1]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.04em] text-[#f3f6f0] sm:text-[20px]">
              Cortex Agent Planner
            </h2>
            <p className="mt-1 text-xs text-[#8f9b8c] sm:text-sm">
              Turn one plain-English goal into guided wallet-safe execution steps.
            </p>
          </div>
        </div>
        <span className="rounded-full border border-[#243126] bg-[#111713] px-3 py-1.5 text-xs font-medium text-[#a9b2a6]">
          v2 planner
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
          placeholder="Get COR and mint the founder trophy, or predict an exact match like Nigeria vs Ghana for Nigeria"
          className="min-h-[120px] w-full resize-none rounded-[24px] border border-[#1f2720] bg-[#070909] px-5 py-5 font-mono text-base leading-7 text-[#dce6d8] outline-none placeholder:text-[#4a5148] sm:text-lg"
        />

        <div className="mt-5 flex flex-wrap gap-3">
          {SAMPLE_PROMPTS.map((samplePrompt) => (
            <button
              key={samplePrompt}
              type="button"
              onClick={() => setPrompt(samplePrompt)}
              className="rounded-full border border-[#33373a] bg-[#23252a] px-4 py-2.5 text-sm text-[#d0d4cf] transition hover:border-[#4a5c4f] hover:bg-[#2a2d32] hover:text-white"
            >
              {`“${samplePrompt}”`}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-[#1b231d] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-[#90a08d]">
            <Sparkles className="size-4 text-[#74f09a]" />
            The planner suggests the path, but every onchain step still requires explicit confirmation.
          </div>
          <Button
            type="submit"
            disabled={isDisabled}
            isLoading={isProcessing}
            loadingText="Analyzing goal..."
            className="px-6 py-4 text-base sm:px-10"
          >
            <>
              Build Execution Plan
              <span className="text-lg">➜</span>
            </>
          </Button>
        </div>

        {plannerResult ? (
          <div className="mt-6 space-y-5">
            <div className="rounded-[24px] border border-[#203021] bg-[#132016] px-5 py-5 text-[#eaf1e4] shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-[#83d896]">Detected Goal</div>
                  <h3 className="mt-2 text-lg font-semibold text-[#f3f7f0]">{formatGoalLabel(plannerResult.goal)}</h3>
                  <p className="mt-2 max-w-3xl text-sm text-[#b7c0b2]">{plannerResult.summary}</p>
                  <p className="mt-3 max-w-3xl text-xs leading-5 text-[#8ea08d]">
                    The planner only enables steps that are execution-safe. Wallet connection, chain context, and any
                    explicit blockers are surfaced before the user signs.
                  </p>
                </div>
                <div className="rounded-full border border-[#243126] bg-[#0e1510] px-3 py-1.5 text-xs text-[#b8c2b5]">
                  {readyStepCount} executable step{readyStepCount === 1 ? "" : "s"}
                </div>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <div className="rounded-[24px] border border-[#1d291f] bg-[#0f1411] p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#eaf2e8]">
                    <CheckCircle2 className="size-4 text-[#7ef3a1]" />
                    Execution Steps
                  </div>
                  <div className="space-y-3">
                    {plannerResult.steps.map((step, index) => {
                      const isExecutingThisStep = executingStepId === step.id;
                      const isExecuted = Boolean(executedSteps[step.id]);
                      const hasBlockers = Boolean(step.blockers && step.blockers.length > 0);
                      const requiresCompletedApproval =
                        step.kind === "transaction"
                        && step.parameters?.requiresApproval
                        && !completedActions.APPROVAL;
                      const hasUnmetSequenceRequirement =
                        step.kind === "transaction"
                        && step.parameters?.requiresApproval
                        && !completedActions.APPROVAL;
                      const isActionable =
                        step.status === "ready"
                        && !hasBlockers
                        && (step.kind === "transaction" || step.kind === "approval");

                      return (
                        <article
                          key={step.id}
                          className="rounded-[22px] border border-[#223025] bg-[linear-gradient(180deg,#121713_0%,#0b100d_100%)] p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-[#2b3a2d] bg-[#101713] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-[#96a494]">
                                  Step {index + 1}
                                </span>
                                <span
                                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${getStepBadgeClassName(step.status)}`}
                                >
                                  {formatStepStatusLabel(step.status)}
                                </span>
                                <span className="rounded-full border border-[#2d352f] bg-[#131915] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#b3beb0]">
                                  {step.kind}
                                </span>
                              </div>
                              <h4 className="mt-3 text-base font-semibold text-[#f3f7f0]">{step.title}</h4>
                              <p className="mt-2 text-sm leading-6 text-[#afbaac]">{step.description}</p>

                              {step.parameters?.tokenIn && step.parameters?.tokenOut ? (
                                <div className="mt-3 rounded-2xl border border-[#202a22] bg-[#0a0f0b] px-3 py-2 text-xs text-[#90a08d]">
                                  Path: {step.parameters.tokenIn} → {step.parameters.tokenOut}
                                  {step.parameters.amount ? ` • Amount: ${step.parameters.amount}` : ""}
                                </div>
                              ) : null}

                              {step.parameters?.matchTitle || step.parameters?.selectedOption ? (
                                <div className="mt-3 rounded-2xl border border-[#202a22] bg-[#0a0f0b] px-3 py-3 text-xs text-[#90a08d]">
                                  {step.parameters.matchTitle ? <div>Match: {step.parameters.matchTitle}</div> : null}
                                  {step.parameters.selectedOption ? <div className="mt-1">Selection: {step.parameters.selectedOption}</div> : null}
                                  {step.parameters.matchId ? <div className="mt-1">Match ID: {step.parameters.matchId}</div> : null}
                                </div>
                              ) : null}

                              {step.blockers && step.blockers.length > 0 ? (
                                <div className="mt-3 rounded-2xl border border-[#3a2222] bg-[#170f0f] px-3 py-3 text-sm text-[#f0b2b2]">
                                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ffb4b4]">
                                    Execution blockers
                                  </div>
                                  <ul className="mt-2 space-y-2">
                                    {step.blockers.map((blocker) => (
                                      <li key={blocker}>• {blocker}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}

                              {hasUnmetSequenceRequirement ? (
                                <div className="mt-3 rounded-2xl border border-[#5d5322] bg-[#1f1b0c] px-3 py-3 text-sm text-[#f4e39d]">
                                  Complete the approval step successfully before minting.
                                </div>
                              ) : null}

                              {isExecuted ? (
                                <div className="mt-3 rounded-2xl border border-[#22442a] bg-[#0f1812] px-3 py-3 text-sm text-[#9fe3b0]">
                                  Submitted: {executedSteps[step.id]?.label}
                                </div>
                              ) : null}
                            </div>

                            {isActionable ? (
                              <Button
                                type="button"
                                disabled={isExecutingIntent || isStepConfirming || hasBlockers || hasUnmetSequenceRequirement}
                                isLoading={isExecutingThisStep || (isStepConfirming && Boolean(submittedHash))}
                                loadingText={isExecutingThisStep ? "Opening wallet..." : "Confirming..."}
                                onClick={() => void executeStep(step)}
                                className="w-full px-4 py-3 text-sm sm:w-auto"
                              >
                                {hasUnmetSequenceRequirement ? "Complete approval first" : step.ctaLabel ?? "Execute Step"}
                              </Button>
                            ) : step.kind === "guidance" ? (
                              <span className="inline-flex items-center gap-2 rounded-full border border-[#2a342b] bg-[#131916] px-3 py-2 text-xs text-[#afbaac]">
                                Advisory only
                                <ExternalLink className="size-3.5" />
                              </span>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[24px] border border-[#1d291f] bg-[#0f1411] p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#eaf2e8]">
                    <ShieldAlert className="size-4 text-[#f0dc7a]" />
                    Preconditions
                  </div>
                  <div className="space-y-3">
                    {plannerResult.prerequisites.map((prerequisite) => {
                      const isWalletAwarePrerequisite = prerequisite.id === "wallet" || prerequisite.id === "gas";

                      return (
                        <div key={prerequisite.id} className="rounded-[20px] border border-[#202a22] bg-[#0a0f0b] p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${getPrerequisiteBadgeClassName(prerequisite.status)}`}
                            >
                              {prerequisite.status}
                            </span>
                            <span className="text-sm font-medium text-[#edf4ea]">{prerequisite.label}</span>
                            {isWalletAwarePrerequisite ? (
                              <span className="rounded-full border border-[#27402e] bg-[#101913] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[#8ee4a3]">
                                Wallet-aware
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[#aebbab]">{prerequisite.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {plannerResult.recovery.length > 0 ? (
                  <div className="rounded-[24px] border border-[#1d291f] bg-[#0f1411] p-4 sm:p-5">
                    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#eaf2e8]">
                      <Sparkles className="size-4 text-[#74f09a]" />
                      Recovery Guidance
                    </div>
                    <div className="space-y-3">
                      {plannerResult.recovery.map((tip) => (
                        <div
                          key={`${tip.title}-${tip.description}`}
                          className={`rounded-[20px] border p-3 ${getRecoveryToneClassName(tip.severity)}`}
                        >
                          <div className="text-sm font-semibold">{tip.title}</div>
                          <p className="mt-2 text-sm leading-6 opacity-90">{tip.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {displayedAgentMessage ? (
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${alertClassName}`}>
            {displayedAgentMessage}
          </div>
        ) : null}

        {debugState ? (
          <div className="mt-4 rounded-2xl border border-[#2a342b] bg-[#0c120d] px-4 py-3 font-mono text-xs text-[#9fb39f]">
            {debugState}
          </div>
        ) : null}
      </form>
    </section>
  );
}

