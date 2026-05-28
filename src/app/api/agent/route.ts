import { NextResponse } from "next/server";
import { parseEther } from "viem";
import { getContractsForChain, hasConfiguredAddress } from "@/lib/contracts";

type IntentAction = "MINT_TROPHY" | "CLAIM_FAUCET" | "SWAP_TOKENS" | "MINT_PREDICTION" | "UNKNOWN";
type IntentGoal =
  | "MINT_TROPHY"
  | "CLAIM_COR"
  | "SWAP_OKB_TO_COR"
  | "SWAP_COR_TO_OKB"
  | "EARN_AND_MINT"
  | "MINT_MATCH_PREDICTION"
  | "UNKNOWN";
type PlannerStatus = "success" | "error";
type PlannerStepKind = "transaction" | "approval" | "guidance";
type PlannerSeverity = "info" | "warning" | "error";
type PlannerStepStatus = "ready" | "blocked" | "advisory";
type PlannerPrerequisiteStatus = "satisfied" | "required" | "warning";

type IntentRequestBody = {
  prompt: string;
  chainId: number;
};

type ExecutionParameters = {
  amount?: string;
  amountWei?: string;
  tokenIn?: string;
  tokenOut?: string;
  contractAddress?: string;
  functionName?: string;
  value?: string;
  requiresApproval?: boolean;
  matchId?: string;
  matchTitle?: string;
  selectedOption?: string;
  selectedOptionIndex?: number;
  approval?: {
    tokenAddress: string;
    spenderAddress: string;
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
  status: PlannerStatus;
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

const DEFAULT_CHAIN_ID = 1952;
const ACTION_KEYWORDS = {
  mintTrophy: ["mint", "trophy", "founder trophy", "soulbound"],
  claimFaucet: ["claim faucet", "faucet", "request tokens", "drip"],
  swapTokens: ["swap", "exchange", "convert", "trade"],
  prediction: ["predict", "prediction", "will win", "winning", "choose", "bet on"],
  goalEarnAndMint: ["earn and mint", "get cor and mint", "faucet then mint", "swap then mint", "complete onboarding"],
} as const;
const COR_PER_OKB = 100_000n;
const FAUCET_AMOUNT_COR = "1000";
const TROPHY_MINT_PRICE_OKB = "0.001";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json<IntentResponse>(
      {
        status: "error",
        action: "UNKNOWN",
        goal: "UNKNOWN",
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
        goal: "UNKNOWN",
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
  const goal = inferGoal(normalizedPrompt);

  if (goal === "UNKNOWN") {
    return {
      status: "error",
      action: "UNKNOWN",
      goal,
      humanReadableSummary:
        "Could not classify the prompt into a supported Cortex action. Try claiming COR, swapping between OKB and COR, minting a trophy, asking for a full onboarding flow, or using an exact match prediction prompt.",
      planner: {
        goal,
        chainId,
        chainName: activeContracts.chainName,
        prompt,
        summary: "The agent needs a clearer supported objective before it can build a plan.",
        prerequisites: [
          {
            id: "supported-intent",
            label: "Use a supported Cortex action",
            status: "required",
            description: "Supported actions: faucet claim, OKB/COR swaps, trophy mint, exact-match prediction planning, or a combined onboarding goal.",
          },
        ],
        steps: [
          {
            id: "clarify-intent",
            title: "Rewrite the prompt with a supported goal",
            kind: "guidance",
            status: "advisory",
            description:
              'Examples: "Claim 1,000 COR", "Swap 0.1 OKB for COR", "Get COR and mint the founder trophy", or "Predict Nigeria vs Ghana for Nigeria".',
            action: "UNKNOWN",
          },
        ],
        recovery: [
          {
            title: "Try a more explicit command",
            description:
              "Mention the asset, direction, and outcome you want so the planner can generate executable steps.",
            severity: "info",
          },
        ],
      },
    };
  }

  const planner = buildExecutionPlanner({
    prompt,
    normalizedPrompt,
    chainId,
    goal,
  });

  const primaryExecutableStep = planner.steps.find(
    (step) => (step.kind === "transaction" || step.kind === "approval") && step.parameters?.contractAddress,
  );

  return {
    status: planner.steps.some((step) => step.status === "ready") ? "success" : "error",
    action: primaryExecutableStep?.action ?? mapGoalToPrimaryAction(goal),
    goal,
    parameters: primaryExecutableStep?.parameters,
    humanReadableSummary: planner.summary,
    planner,
  };
}

function buildExecutionPlanner({
  prompt,
  normalizedPrompt,
  chainId,
  goal,
}: {
  prompt: string;
  normalizedPrompt: string;
  chainId: number;
  goal: IntentGoal;
}) {
  const activeContracts = getContractsForChain(chainId);
  const prerequisites: PlannerPrerequisite[] = [];
  const steps: PlannerStep[] = [];
  const recovery: RecoveryTip[] = [];

  prerequisites.push({
    id: "wallet",
    label: "Connected wallet",
    status: "required",
    description: "This planner prepares onchain actions, so the dashboard still requires the user to connect a wallet before execution.",
  });

  prerequisites.push({
    id: "gas",
    label: "Native gas balance",
    status: "warning",
    description: "Keep a small OKB balance available for gas before executing any step.",
  });

  if (goal === "CLAIM_COR") {
    const faucetConfigured = hasConfiguredAddress(activeContracts.faucetAddress);

    prerequisites.push({
      id: "faucet-config",
      label: "COR faucet configured",
      status: faucetConfigured ? "satisfied" : "required",
      description: faucetConfigured
        ? "The COR faucet contract is configured for this chain."
        : `Missing faucet contract for ${activeContracts.chainName}. Configure NEXT_PUBLIC_XLAYER_FAUCET_ADDRESS or the chain-specific equivalent.`,
    });

    steps.push({
      id: "claim-cor",
      title: `Claim ${FAUCET_AMOUNT_COR} COR from the faucet`,
      kind: "transaction",
      status: faucetConfigured ? "ready" : "blocked",
      description: "Requests the fixed faucet drip directly from the COR faucet contract.",
      ctaLabel: "Claim COR",
      action: "CLAIM_FAUCET",
      parameters: faucetConfigured
        ? {
            contractAddress: activeContracts.faucetAddress,
            functionName: "requestTokens",
          }
        : undefined,
      blockers: faucetConfigured ? [] : ["Faucet address is not configured for this chain."],
    });

    recovery.push({
      title: "If the faucet rejects the claim",
      description: "The faucet contract may be enforcing a cooldown. Wait for the cooldown window, then retry the claim step.",
      severity: "warning",
    });
  }

  if (goal === "SWAP_OKB_TO_COR") {
    const swapAmount = extractAmount(prompt) ?? "0.1";
    const valueWei = parseEther(swapAmount).toString();
    const corAmountOut = formatCorFromOkbInput(swapAmount);
    const swapConfigured =
      hasConfiguredAddress(activeContracts.swapRouterAddress) && hasConfiguredAddress(activeContracts.quoteTokenAddress);

    prerequisites.push({
      id: "router-config",
      label: "Swap router configured",
      status: swapConfigured ? "satisfied" : "required",
      description: swapConfigured
        ? "The Cortex swap router and COR token contracts are configured for this chain."
        : `Missing router or COR token address for ${activeContracts.chainName}. Configure the chain-specific swap router and quote token variables.`,
    });

    prerequisites.push({
      id: "okb-balance",
      label: `${swapAmount} OKB available for swap value`,
      status: "warning",
      description: `The wallet must hold at least ${swapAmount} OKB plus extra gas before this swap can execute.`,
    });

    steps.push({
      id: "swap-okb-to-cor",
      title: `Swap ${swapAmount} OKB for ${corAmountOut} COR`,
      kind: "transaction",
      status: swapConfigured ? "ready" : "blocked",
      description: "Executes the router's fixed-rate native-to-COR swap.",
      ctaLabel: "Swap OKB to COR",
      action: "SWAP_TOKENS",
      parameters: swapConfigured
        ? {
            amount: corAmountOut,
            amountWei: parseEther(corAmountOut).toString(),
            tokenIn: "OKB",
            tokenOut: "COR",
            contractAddress: activeContracts.swapRouterAddress,
            functionName: "swapNativeForExactTokens",
            value: valueWei,
          }
        : undefined,
      blockers: swapConfigured ? [] : ["Swap router or COR token address is not configured."],
    });

    recovery.push({
      title: "If the swap fails",
      description: "Confirm the router still holds enough COR liquidity and the wallet has enough OKB for both value and gas.",
      severity: "warning",
    });
  }

  if (goal === "SWAP_COR_TO_OKB") {
    const swapAmount = extractAmount(prompt) ?? "10000";
    const amountWei = parseEther(swapAmount).toString();
    const okbAmountOut = formatOkbFromCorInput(swapAmount);
    const swapConfigured =
      hasConfiguredAddress(activeContracts.swapRouterAddress) && hasConfiguredAddress(activeContracts.quoteTokenAddress);

    prerequisites.push({
      id: "router-config",
      label: "Swap router configured",
      status: swapConfigured ? "satisfied" : "required",
      description: swapConfigured
        ? "The Cortex swap router and COR token contracts are configured for this chain."
        : `Missing router or COR token address for ${activeContracts.chainName}. Configure the chain-specific swap router and quote token variables.`,
    });

    prerequisites.push({
      id: "cor-balance",
      label: `${swapAmount} COR available for swap`,
      status: "warning",
      description: `The wallet must hold at least ${swapAmount} COR before this reverse swap can execute.`,
    });

    steps.push({
      id: "approve-cor",
      title: `Approve ${swapAmount} COR for the router`,
      kind: "approval",
      status: swapConfigured ? "ready" : "blocked",
      description: "Authorizes the router to transfer COR from the connected wallet.",
      ctaLabel: "Approve COR",
      action: "SWAP_TOKENS",
      parameters: swapConfigured
        ? {
            amount: swapAmount,
            amountWei,
            tokenIn: "COR",
            tokenOut: "OKB",
            contractAddress: activeContracts.quoteTokenAddress,
            functionName: "approve",
            requiresApproval: false,
            approval: {
              tokenAddress: activeContracts.quoteTokenAddress,
              spenderAddress: activeContracts.swapRouterAddress,
              amount: amountWei,
            },
          }
        : undefined,
      blockers: swapConfigured ? [] : ["Swap router or COR token address is not configured."],
    });

    steps.push({
      id: "swap-cor-to-okb",
      title: `Swap ${swapAmount} COR for ${okbAmountOut} OKB`,
      kind: "transaction",
      status: swapConfigured ? "ready" : "blocked",
      description: "Executes the router's fixed-rate COR-to-native swap after approval is granted.",
      ctaLabel: "Swap COR to OKB",
      action: "SWAP_TOKENS",
      parameters: swapConfigured
        ? {
            amount: swapAmount,
            amountWei,
            tokenIn: "COR",
            tokenOut: "OKB",
            contractAddress: activeContracts.swapRouterAddress,
            functionName: "swapTokensForNative",
            value: "0",
            requiresApproval: true,
            approval: {
              tokenAddress: activeContracts.quoteTokenAddress,
              spenderAddress: activeContracts.swapRouterAddress,
              amount: amountWei,
            },
          }
        : undefined,
      blockers: swapConfigured ? [] : ["Swap router or COR token address is not configured."],
    });

    recovery.push({
      title: "If the reverse swap fails",
      description: "Check that the wallet has enough COR, the router has native OKB liquidity, and the approval transaction was confirmed first.",
      severity: "warning",
    });
  }

  if (goal === "MINT_TROPHY") {
    const soulboundConfigured = hasConfiguredAddress(activeContracts.soulboundAddress);

    prerequisites.push({
      id: "soulbound-config",
      label: "Founder trophy contract configured",
      status: soulboundConfigured ? "satisfied" : "required",
      description: soulboundConfigured
        ? "The founder trophy contract is configured for this chain."
        : `Missing soulbound trophy address for ${activeContracts.chainName}. Configure NEXT_PUBLIC_XLAYER_SOULBOUND_ADDRESS or the chain-specific equivalent.`,
    });

    prerequisites.push({
      id: "mint-value",
      label: `${TROPHY_MINT_PRICE_OKB} OKB available for mint price`,
      status: "warning",
      description: `Minting the founder trophy requires ${TROPHY_MINT_PRICE_OKB} OKB plus extra gas.`,
    });

    steps.push({
      id: "mint-trophy",
      title: "Mint the founder trophy",
      kind: "transaction",
      status: soulboundConfigured ? "ready" : "blocked",
      description: "Calls the soulbound founder trophy contract and pays the mint fee.",
      ctaLabel: "Mint Trophy",
      action: "MINT_TROPHY",
      parameters: soulboundConfigured
        ? {
            contractAddress: activeContracts.soulboundAddress,
            functionName: "mint",
            value: parseEther(TROPHY_MINT_PRICE_OKB).toString(),
          }
        : undefined,
      blockers: soulboundConfigured ? [] : ["Founder trophy contract address is not configured."],
    });

    recovery.push({
      title: "If minting fails",
      description: "Confirm the wallet still has enough OKB for the mint fee and that the trophy contract is deployed on the selected chain.",
      severity: "warning",
    });
  }

  if (goal === "MINT_MATCH_PREDICTION") {
    const marketplaceConfigured = hasConfiguredAddress(activeContracts.marketplaceAddress);
    const quoteTokenConfigured = hasConfiguredAddress(activeContracts.quoteTokenAddress);
    const predictionDetails = extractPredictionPromptDetails(prompt);
    const predictionReady = marketplaceConfigured && quoteTokenConfigured && Boolean(predictionDetails);

    prerequisites.push({
      id: "prediction-market-config",
      label: "Prediction marketplace configured",
      status: marketplaceConfigured && quoteTokenConfigured ? "satisfied" : "required",
      description:
        marketplaceConfigured && quoteTokenConfigured
          ? "The marketplace and quote token contracts are configured for this chain."
          : `Missing marketplace or quote token address for ${activeContracts.chainName}. Configure the chain-specific market variables before prediction minting can execute.`,
    });

    prerequisites.push({
      id: "prediction-exact-match",
      label: "Exact match title and option detected",
      status: predictionDetails ? "satisfied" : "required",
      description: predictionDetails
        ? `Prediction parsed: ${predictionDetails.matchTitle} → ${predictionDetails.selectedOption}.`
        : "Use an exact existing match title and one exact option label. Example: Predict Italy vs Iraq for Italy.",
    });

    if (!predictionDetails) {
      steps.push({
        id: "rewrite-prediction-prompt",
        title: "Rewrite the prompt with an exact match title and option",
        kind: "guidance",
        status: "advisory",
        description:
          "Use the exact marketplace match title and the exact option label so the agent can prepare the mint transaction.",
        ctaLabel: undefined,
        action: "MINT_PREDICTION",
      });

      recovery.push({
        title: "Use exact match phrasing",
        description: "Example: Predict Italy vs Iraq for Italy.",
        severity: "info",
      });
    } else {
      const selectedOptionIndex = resolvePredictionOptionIndex(predictionDetails);
      const matchLookupDescription =
        selectedOptionIndex === 2
          ? "The prompt maps to the Draw option."
          : `The prompt maps to option ${selectedOptionIndex + 1} for ${predictionDetails.selectedOption}.`;

      prerequisites.push({
        id: "prediction-option-match",
        label: "Prediction option mapped",
        status: "satisfied",
        description: matchLookupDescription,
      });

      steps.push({
        id: "approve-prediction-spend",
        title: `Approve COR for ${predictionDetails.matchTitle}`,
        kind: "approval",
        status: predictionReady ? "ready" : "blocked",
        description: "Authorizes the marketplace contract to transfer the match entry amount before minting the prediction NFT.",
        ctaLabel: "Approve COR",
        action: "MINT_PREDICTION",
        parameters: predictionReady
          ? {
              matchTitle: predictionDetails.matchTitle,
              selectedOption: predictionDetails.selectedOption,
              selectedOptionIndex,
              contractAddress: activeContracts.quoteTokenAddress,
              functionName: "approvePredictionByMatchTitle",
              approval: {
                tokenAddress: activeContracts.quoteTokenAddress,
                spenderAddress: activeContracts.marketplaceAddress,
                amount: parseEther("100").toString(),
              },
            }
          : undefined,
        blockers: predictionReady ? [] : ["Prediction marketplace contracts are not configured for this chain."],
      });

      steps.push({
        id: "mint-prediction",
        title: `Mint prediction for ${predictionDetails.matchTitle}`,
        kind: "transaction",
        status: predictionReady ? "ready" : "blocked",
        description: `Mints the prediction NFT for ${predictionDetails.selectedOption}.`,
        ctaLabel: "Mint Prediction",
        action: "MINT_PREDICTION",
        parameters: predictionReady
          ? {
              matchTitle: predictionDetails.matchTitle,
              selectedOption: predictionDetails.selectedOption,
              selectedOptionIndex,
              matchId: predictionDetails.matchId,
              contractAddress: activeContracts.marketplaceAddress,
              functionName: "mintPrediction",
              requiresApproval: true,
            }
          : undefined,
        blockers: predictionReady ? [] : ["Prediction marketplace contracts are not configured for this chain."],
      });

      recovery.push({
        title: "If prediction minting fails",
        description:
          "Confirm the wallet has enough COR for the entry amount and enough OKB for gas. If the marketplace rejects the mint, the current AI flow still needs exact onchain match lookup by title before prediction execution can be fully reliable.",
        severity: "warning",
      });
    }
  }

  if (goal === "EARN_AND_MINT") {
    const faucetConfigured = hasConfiguredAddress(activeContracts.faucetAddress);
    const routerConfigured =
      hasConfiguredAddress(activeContracts.swapRouterAddress) && hasConfiguredAddress(activeContracts.quoteTokenAddress);
    const soulboundConfigured = hasConfiguredAddress(activeContracts.soulboundAddress);
    const prefersSwapPath = normalizedPrompt.includes("swap") || normalizedPrompt.includes("buy") || normalizedPrompt.includes("0.1 okb");
    const swapAmount = extractAmount(prompt) ?? "0.1";
    const corAmountOut = formatCorFromOkbInput(swapAmount);

    prerequisites.push({
      id: "onboarding-contracts",
      label: "All onboarding contracts configured",
      status: faucetConfigured && soulboundConfigured && (!prefersSwapPath || routerConfigured) ? "satisfied" : "required",
      description: prefersSwapPath
        ? "This goal depends on the COR faucet or swap router plus the founder trophy contract."
        : "This goal depends on the COR faucet and founder trophy contract.",
    });

    prerequisites.push({
      id: "journey-gas",
      label: "Enough OKB for the full journey",
      status: "warning",
      description: `Keep enough OKB for gas and the ${TROPHY_MINT_PRICE_OKB} OKB trophy mint fee before walking through all steps.`,
    });

    if (faucetConfigured) {
      steps.push({
        id: "earn-claim-cor",
        title: `Claim ${FAUCET_AMOUNT_COR} COR starter balance`,
        kind: "transaction",
        status: "ready",
        description: "Starts the onboarding flow by claiming the fixed COR faucet drip.",
        ctaLabel: "Claim Starter COR",
        action: "CLAIM_FAUCET",
        parameters: {
          contractAddress: activeContracts.faucetAddress,
          functionName: "requestTokens",
        },
      });
    } else {
      steps.push({
        id: "earn-claim-cor",
        title: `Claim ${FAUCET_AMOUNT_COR} COR starter balance`,
        kind: "transaction",
        status: "blocked",
        description: "Starts the onboarding flow by claiming the fixed COR faucet drip.",
        ctaLabel: "Claim Starter COR",
        action: "CLAIM_FAUCET",
        blockers: ["Faucet contract address is not configured for this chain."],
      });
    }

    if (prefersSwapPath) {
      steps.push({
        id: "earn-swap-okb-to-cor",
        title: `Optionally swap ${swapAmount} OKB for ${corAmountOut} COR`,
        kind: routerConfigured ? "transaction" : "guidance",
        status: routerConfigured ? "ready" : "blocked",
        description: "Lets the user deepen their COR balance before minting the trophy.",
        ctaLabel: routerConfigured ? "Swap OKB to COR" : undefined,
        action: "SWAP_TOKENS",
        parameters: routerConfigured
          ? {
              amount: corAmountOut,
              amountWei: parseEther(corAmountOut).toString(),
              tokenIn: "OKB",
              tokenOut: "COR",
              contractAddress: activeContracts.swapRouterAddress,
              functionName: "swapNativeForExactTokens",
              value: parseEther(swapAmount).toString(),
            }
          : undefined,
        blockers: routerConfigured ? [] : ["Swap router or COR token address is not configured."],
      });
    } else {
      steps.push({
        id: "earn-swap-okb-to-cor",
        title: "Optional: buy more COR through the router",
        kind: "guidance",
        status: "advisory",
        description: "If the user wants a larger COR balance, they can add an OKB-to-COR swap before minting.",
        action: "UNKNOWN",
      });
    }

    steps.push({
      id: "earn-mint-trophy",
      title: "Mint the founder trophy",
      kind: "transaction",
      status: soulboundConfigured ? "ready" : "blocked",
      description: "Completes the onboarding flow by minting the founder trophy for the connected wallet.",
      ctaLabel: "Mint Trophy",
      action: "MINT_TROPHY",
      parameters: soulboundConfigured
        ? {
            contractAddress: activeContracts.soulboundAddress,
            functionName: "mint",
            value: parseEther(TROPHY_MINT_PRICE_OKB).toString(),
          }
        : undefined,
      blockers: soulboundConfigured ? [] : ["Founder trophy contract address is not configured."],
    });

    recovery.push({
      title: "Recommended execution order",
      description: "Claim COR first, optionally perform the swap, then mint the founder trophy after confirming enough OKB remains for the mint fee.",
      severity: "info",
    });

    recovery.push({
      title: "Handle partial completion safely",
      description: "Each step should be confirmed in the wallet separately. If one step fails, the agent should leave the later steps available instead of retrying automatically.",
      severity: "warning",
    });
  }

  return {
    goal,
    chainId,
    chainName: activeContracts.chainName,
    prompt,
    summary: buildPlannerSummary(goal, steps),
    prerequisites,
    steps,
    recovery,
  };
}

function inferGoal(prompt: string): IntentGoal {
  if (looksLikeEarnAndMintIntent(prompt)) {
    return "EARN_AND_MINT";
  }

  if (looksLikePredictionIntent(prompt)) {
    return "MINT_MATCH_PREDICTION";
  }

  if (looksLikeMintTrophyIntent(prompt)) {
    return "MINT_TROPHY";
  }

  if (looksLikeClaimFaucetIntent(prompt)) {
    return "CLAIM_COR";
  }

  if (looksLikeSwapIntent(prompt)) {
    return looksLikeReverseSwapIntent(prompt) ? "SWAP_COR_TO_OKB" : "SWAP_OKB_TO_COR";
  }

  return "UNKNOWN";
}

function buildPlannerSummary(goal: IntentGoal, steps: PlannerStep[]) {
  const readySteps = steps.filter((step) => step.status === "ready").length;

  if (goal === "CLAIM_COR") {
    return `The Cortex agent prepared a faucet claim plan with ${readySteps} executable step${readySteps === 1 ? "" : "s"}.`;
  }

  if (goal === "SWAP_OKB_TO_COR") {
    return `The Cortex agent prepared an OKB-to-COR swap plan with ${readySteps} executable step${readySteps === 1 ? "" : "s"}.`;
  }

  if (goal === "SWAP_COR_TO_OKB") {
    return `The Cortex agent prepared a COR-to-OKB exit plan with approval and swap sequencing.`;
  }

  if (goal === "MINT_TROPHY") {
    return `The Cortex agent prepared a founder trophy mint plan with ${readySteps} executable step${readySteps === 1 ? "" : "s"}.`;
  }

  if (goal === "EARN_AND_MINT") {
    return "The Cortex agent prepared a broader onboarding journey that can chain COR acquisition and founder trophy minting one step at a time.";
  }

  if (goal === "MINT_MATCH_PREDICTION") {
    return "The Cortex agent prepared a match prediction flow using the detected match title and selected outcome.";
  }

  return "The Cortex agent could not construct a supported plan.";
}

function mapGoalToPrimaryAction(goal: IntentGoal): IntentAction {
  if (goal === "CLAIM_COR") {
    return "CLAIM_FAUCET";
  }

  if (goal === "SWAP_OKB_TO_COR" || goal === "SWAP_COR_TO_OKB") {
    return "SWAP_TOKENS";
  }

  if (goal === "MINT_TROPHY") {
    return "MINT_TROPHY";
  }

  if (goal === "MINT_MATCH_PREDICTION") {
    return "MINT_PREDICTION";
  }

  return "UNKNOWN";
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

function looksLikeEarnAndMintIntent(prompt: string) {
  return (
    ACTION_KEYWORDS.goalEarnAndMint.some((keyword) => prompt.includes(keyword)) ||
    ((prompt.includes("mint") || prompt.includes("trophy")) &&
      (prompt.includes("claim") || prompt.includes("faucet") || prompt.includes("swap") || prompt.includes("get cor")))
  );
}

function looksLikePredictionIntent(prompt: string) {
  return ACTION_KEYWORDS.prediction.some((keyword) => prompt.includes(keyword));
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

function formatCorFromOkbInput(amount: string) {
  const amountWei = parseEther(amount);
  const corAmountWei = amountWei * COR_PER_OKB;
  return formatTokenAmount(corAmountWei);
}

function formatOkbFromCorInput(amount: string) {
  const corWei = parseEther(amount);
  const okbWei = corWei / COR_PER_OKB;
  return formatTokenAmount(okbWei, 6);
}

function formatTokenAmount(value: bigint, maxFractionDigits = 4) {
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, "0");
  const trimmedFraction = fraction.replace(/0+$/, "").slice(0, maxFractionDigits);
  return trimmedFraction.length > 0 ? `${whole.toString()}.${trimmedFraction}` : whole.toString();
}

type PredictionPromptDetails = {
  matchTitle: string;
  selectedOption: string;
  matchId?: string;
};

function extractPredictionPromptDetails(prompt: string): PredictionPromptDetails | null {
  const normalizedPrompt = prompt.replace(/\s+/g, " ").trim();
  const cleanedPrompt = normalizedPrompt.replace(/^i\s+am\s+/i, "").trim();
  const forPattern = /(?:predict(?:ing)?|prediction(?: for)?|mint prediction for)\s+(.+?)\s+(?:for|choose|pick)\s+(.+?)(?:\s+to\s+win)?$/i;
  const willWinPattern = /(.+?)\s+(?:will win|winning)\s+against\s+(.+)/i;

  const forMatch = cleanedPrompt.match(forPattern) ?? normalizedPrompt.match(forPattern);
  if (forMatch) {
    const matchTitle = forMatch[1]?.trim();
    const selectedOption = forMatch[2]?.trim();

    if (matchTitle && selectedOption) {
      return {
        matchTitle,
        selectedOption: selectedOption.replace(/\s+to\s+win$/i, "").trim(),
      };
    }
  }

  const willWinMatch = cleanedPrompt.match(willWinPattern) ?? normalizedPrompt.match(willWinPattern);
  if (willWinMatch) {
    const selectedOption = willWinMatch[1]?.trim();
    const opponent = willWinMatch[2]?.trim();

    if (selectedOption && opponent) {
      return {
        matchTitle: `${selectedOption} vs ${opponent}`,
        selectedOption,
      };
    }
  }

  return null;
}

function resolvePredictionOptionIndex(predictionDetails: PredictionPromptDetails) {
  if (predictionDetails.selectedOption.trim().toLowerCase() === "draw") {
    return 2;
  }

  return 0;
}

export { extractAmount, extractDestinationToken, extractPredictionPromptDetails, extractToken };
