"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { useAccount, usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { MatchPredictionPreview, type MintSlot } from "@/components/dashboard/match-prediction-preview";
import { getContractsForChain, hasConfiguredAddress } from "@/lib/contracts";

const marketCategories = ["Live", "Minted", "Resolved", "Rewards"] as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const SUPPORTED_CHAIN_IDS = new Set([1952, 11155111] as const);

const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const marketplaceAbi = [
  {
    type: "function",
    name: "nextMatchId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getMatch",
    stateMutability: "view",
    inputs: [{ name: "matchId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        name: "",
        components: [
          { name: "id", type: "uint256" },
          { name: "entryPrice", type: "uint256" },
          { name: "rewardAmount", type: "uint256" },
          { name: "opensAt", type: "uint256" },
          { name: "closesAt", type: "uint256" },
          { name: "totalMints", type: "uint256" },
          { name: "winningMints", type: "uint256" },
          { name: "winningOption", type: "uint8" },
          { name: "state", type: "uint8" },
          { name: "exists", type: "bool" },
          { name: "slug", type: "string" },
          { name: "title", type: "string" },
          { name: "description", type: "string" },
          { name: "imageUri", type: "string" },
          { name: "rewardAssetSymbol", type: "string" },
          { name: "metadataUri", type: "string" },
          { name: "options", type: "string[]" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getPrediction",
    stateMutability: "view",
    inputs: [
      { name: "participant", type: "address" },
      { name: "matchId", type: "uint256" },
    ],
    outputs: [
      {
        type: "tuple",
        name: "",
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "selectedOption", type: "uint8" },
          { name: "claimed", type: "bool" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getClaimableReward",
    stateMutability: "view",
    inputs: [
      { name: "participant", type: "address" },
      { name: "matchId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "mintPrediction",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "selectedOption", type: "uint8" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimReward",
    stateMutability: "nonpayable",
    inputs: [{ name: "matchId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "resolveMatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "winningOption", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

type ResolvedMetadata = {
  image: string;
  name: string;
  description: string;
  teamBImage?: string;
  drawMintAmount?: string;
};

type MatchState = "draft" | "live" | "resolved" | "cancelled";

type PredictionCard = {
  id: string;
  matchId: bigint;
  image: string;
  teamAFlagUri: string;
  teamBFlagUri: string;
  title: string;
  description: string;
  listedPrice: bigint;
  rewardAmount: bigint;
  rewardAssetSymbol: string;
  metadataUri: string;
  drawMintAmount: string;
  matchStatus: MatchState;
  outcomeLabel: string;
  rewardLabel: string;
  options: string[];
  totalMints: bigint;
  winningMints: bigint;
  opensAt: bigint;
  closesAt: bigint;
  winningOption: number | null;
  selectedOption: number | null;
  tokenId: bigint | null;
  userMinted: boolean;
  alreadyClaimed: boolean;
  claimableReward: bigint;
};

type TxState = {
  matchId: bigint | null;
  action: "approve" | "mint" | "claim" | "badge" | "resolve" | null;
};

type MatchTuple = {
  id: bigint;
  entryPrice: bigint;
  rewardAmount: bigint;
  opensAt: bigint;
  closesAt: bigint;
  totalMints: bigint;
  winningMints: bigint;
  winningOption: number;
  state: number;
  exists: boolean;
  slug: string;
  title: string;
  description: string;
  imageUri: string;
  rewardAssetSymbol: string;
  metadataUri: string;
  options: readonly string[];
};

type PredictionTuple = {
  tokenId: bigint;
  selectedOption: number;
  claimed: boolean;
  exists: boolean;
};

function ipfsToHttp(uri: string) {
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.replace("ipfs://", "")}`;
  }

  return uri;
}

function decodeBase64JsonUri(uri: string) {
  const payload = uri.replace(/^data:application\/json;base64,/, "");

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const decoded = window.atob(payload);
    return JSON.parse(decoded) as Partial<ResolvedMetadata>;
  } catch {
    return null;
  }
}

async function resolveTokenMetadata(uri: string): Promise<ResolvedMetadata> {
  if (!uri) {
    return {
      image: "",
      name: "Admin Match NFT",
      description: "Metadata unavailable.",
    };
  }

  let metadata: Partial<ResolvedMetadata> | null = null;

  if (uri.startsWith("data:application/json;base64,")) {
    metadata = decodeBase64JsonUri(uri);
  } else {
    const response = await fetch(ipfsToHttp(uri));
    metadata = (await response.json()) as Partial<ResolvedMetadata>;
  }

  const properties =
    metadata && typeof metadata === "object" && "properties" in metadata
      ? (metadata.properties as Record<string, unknown>)
      : null;

  return {
    image: metadata?.image ? ipfsToHttp(metadata.image) : "",
    name: metadata?.name?.trim() || "Admin Match NFT",
    description: metadata?.description?.trim() || "No description provided.",
    teamBImage:
      typeof properties?.teamBImage === "string" && properties.teamBImage.trim()
        ? ipfsToHttp(properties.teamBImage)
        : undefined,
    drawMintAmount:
      typeof properties?.drawMintAmount === "string" && properties.drawMintAmount.trim()
        ? properties.drawMintAmount
        : undefined,
  };
}

function formatPrice(price: bigint, symbol = "COR") {
  if (price === 0n) {
    return `0 ${symbol}`;
  }

  return `${formatEther(price)} ${symbol}`;
}

function formatError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Transaction failed. Please try again.";
}

function mapMatchState(state: number): MatchState {
  if (state === 1) {
    return "live";
  }

  if (state === 2) {
    return "resolved";
  }

  if (state === 3) {
    return "cancelled";
  }

  return "draft";
}

function formatDate(timestamp: bigint) {
  if (timestamp === 0n) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(Number(timestamp) * 1000));
}

function PredictionCardSkeleton() {
  return (
    <div className="min-w-0 rounded-[24px] border border-[#1f2c20] bg-[linear-gradient(180deg,#111512_0%,#090c0a_100%)] p-5 sm:p-6">
      <div className="h-4 w-28 animate-pulse rounded bg-[#1b211d]" />
      <div className="mt-3 rounded-[22px] border border-[#23282a] bg-[#0a0e0b] p-4">
        <div className="h-20 animate-pulse rounded-[18px] bg-[#101512]" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="h-16 animate-pulse rounded-2xl bg-[#101512]" />
          <div className="h-16 animate-pulse rounded-2xl bg-[#101512]" />
          <div className="h-16 animate-pulse rounded-2xl bg-[#101512]" />
        </div>
      </div>
    </div>
  );
}

function getMintPriceForOption(card: PredictionCard) {
  return card.listedPrice;
}

type MintChoice = {
  label: string;
  optionIndex: number;
  price: bigint;
};

function hasDrawMint(card: PredictionCard) {
  return card.options.some((option) => option.trim().toLowerCase() === "draw") ||
    (card.drawMintAmount && card.drawMintAmount !== "—");
}

function getMintChoices(card: PredictionCard, teamA: string, teamB: string): MintChoice[] {
  const normalizedOptions = card.options.map((option) => option.trim().toLowerCase());
  const teamAOptionIndex = normalizedOptions.findIndex((option) => option === teamA.trim().toLowerCase());
  const teamBOptionIndex = normalizedOptions.findIndex((option) => option === teamB.trim().toLowerCase());
  const drawOptionIndex = normalizedOptions.findIndex((option) => option === "draw");

  const resolvedTeamAIndex = teamAOptionIndex >= 0 ? teamAOptionIndex : 0;
  const resolvedDrawIndex = drawOptionIndex >= 0 ? drawOptionIndex : 2;
  const resolvedTeamBIndex =
    teamBOptionIndex >= 0
      ? teamBOptionIndex
      : resolvedDrawIndex === 1
        ? 2
        : 1;

  const choices: MintChoice[] = [
    { label: teamA, optionIndex: resolvedTeamAIndex, price: getMintPriceForOption(card) },
  ];

  if (hasDrawMint(card)) {
    choices.push({
      label: card.options[drawOptionIndex] ?? "Draw",
      optionIndex: resolvedDrawIndex,
      price: getMintPriceForOption(card),
    });
  }

  choices.push({ label: teamB, optionIndex: resolvedTeamBIndex, price: getMintPriceForOption(card) });

  return choices;
}

function formatMintSlotAmount(card: PredictionCard, choice: MintChoice) {
  if (choice.label.trim().toLowerCase() === "draw" && card.drawMintAmount && card.drawMintAmount !== "—") {
    return card.drawMintAmount;
  }

  return formatEther(choice.price);
}

function isDrawMintDisabled(card: PredictionCard, choice: MintChoice) {
  if (choice.label.trim().toLowerCase() !== "draw") {
    return false;
  }

  return !hasDrawMint(card);
}

function getMintSlotLabel(choice: MintChoice) {
  if (choice.label.trim().toLowerCase() === "draw") {
    return "Draw mint";
  }

  if (choice.optionIndex === 0) {
    return "Team A mint";
  }

  return "Team B mint";
}

export function NFTMarket() {
  const { address, chainId } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const isSupportedChain = chainId !== undefined && SUPPORTED_CHAIN_IDS.has(chainId as 1952 | 11155111);
  const activeChainId = isSupportedChain ? chainId : 1952;
  const activeContracts = getContractsForChain(activeChainId);
  const marketplaceAddress =
    (activeContracts.marketplaceAddress && hasConfiguredAddress(activeContracts.marketplaceAddress)
      ? activeContracts.marketplaceAddress
      : undefined) ?? (process.env.NEXT_PUBLIC_XLAYER_MARKETPLACE_ADDRESS as `0x${string}` | undefined);
  const quoteTokenAddress =
    (activeContracts.quoteTokenAddress && hasConfiguredAddress(activeContracts.quoteTokenAddress)
      ? activeContracts.quoteTokenAddress
      : undefined) ?? (process.env.NEXT_PUBLIC_XLAYER_QUOTE_TOKEN_ADDRESS as `0x${string}` | undefined);

  const isMarketplaceConfigured = Boolean(marketplaceAddress && marketplaceAddress !== ZERO_ADDRESS);
  const isQuoteTokenConfigured = Boolean(quoteTokenAddress && quoteTokenAddress !== ZERO_ADDRESS);

  const [txState, setTxState] = useState<TxState>({ matchId: null, action: null });
  const [cards, setCards] = useState<PredictionCard[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"error" | "success" | null>(null);

  const publicClient = usePublicClient();

  const { data: ownerAddress } = useReadContract({
    address: isMarketplaceConfigured ? marketplaceAddress : undefined,
    abi: marketplaceAbi,
    functionName: "owner",
    query: { enabled: isMarketplaceConfigured },
  });

  const { data: nextMatchId, isLoading: isNextMatchIdLoading } = useReadContract({
    address: isMarketplaceConfigured ? marketplaceAddress : undefined,
    abi: marketplaceAbi,
    functionName: "nextMatchId",
    query: { enabled: isMarketplaceConfigured },
  });

  const matchIds = useMemo(() => {
    const nextId = typeof nextMatchId === "bigint" ? nextMatchId : 1n;
    if (nextId <= 1n) {
      return [] as bigint[];
    }

    return Array.from({ length: Number(nextId - 1n) }, (_, index) => BigInt(index + 1));
  }, [nextMatchId]);

  const matchContracts = useMemo(
    () =>
      isMarketplaceConfigured
        ? matchIds.map((matchId) => ({
            address: marketplaceAddress!,
            abi: marketplaceAbi,
            functionName: "getMatch" as const,
            args: [matchId] as const,
          }))
        : [],
    // `marketplaceAddress` is already gated by `isMarketplaceConfigured`; including it
    // trips react-compiler preservation on this stable contract descriptor list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isMarketplaceConfigured, matchIds],
  );

  const predictionContracts = useMemo(
    () =>
      isMarketplaceConfigured && address
        ? matchIds.map((matchId) => ({
            address: marketplaceAddress!,
            abi: marketplaceAbi,
            functionName: "getPrediction" as const,
            args: [address, matchId] as const,
          }))
        : [],
    // `marketplaceAddress` is already gated by `isMarketplaceConfigured`; including it
    // trips react-compiler preservation on this stable contract descriptor list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address, isMarketplaceConfigured, matchIds],
  );

  const rewardContracts = useMemo(
    () =>
      isMarketplaceConfigured && address
        ? matchIds.map((matchId) => ({
            address: marketplaceAddress!,
            abi: marketplaceAbi,
            functionName: "getClaimableReward" as const,
            args: [address, matchId] as const,
          }))
        : [],
    // `marketplaceAddress` is already gated by `isMarketplaceConfigured`; including it
    // trips react-compiler preservation on this stable contract descriptor list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address, isMarketplaceConfigured, matchIds],
  );

  const { data: matchResults, isLoading: isMatchesLoading, isFetching: isMatchesFetching } = useReadContracts({
    contracts: matchContracts,
    query: { enabled: matchContracts.length > 0 },
  });

  const { data: predictionResults, isLoading: isPredictionsLoading, isFetching: isPredictionsFetching } =
    useReadContracts({
      contracts: predictionContracts,
      query: { enabled: predictionContracts.length > 0 },
    });

  const { data: rewardResults, isLoading: isRewardsLoading, isFetching: isRewardsFetching } = useReadContracts({
    contracts: rewardContracts,
    query: { enabled: rewardContracts.length > 0 },
  });

  const matches = useMemo(
    () =>
      (matchResults ?? []).map((result) =>
        result.status === "success" && result.result ? (result.result as MatchTuple) : null,
      ),
    [matchResults],
  );

  const predictions = useMemo(
    () =>
      (predictionResults ?? []).map((result) =>
        result.status === "success" && result.result ? (result.result as PredictionTuple) : null,
      ),
    [predictionResults],
  );

  const claimableRewards = useMemo(
    () =>
      (rewardResults ?? []).map((result) =>
        result.status === "success" && typeof result.result === "bigint" ? result.result : 0n,
      ),
    [rewardResults],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadMatchMetadata() {
      if (!matches.length) {
        setCards([]);
        return;
      }

      setMetadataLoading(true);

      try {
        const resolvedMetadata = await Promise.all(
          matches.map(async (matchConfig) => {
            if (!matchConfig) {
              return {
                image: "",
                name: "Admin Match NFT",
                description: "Metadata unavailable.",
              };
            }

            return resolveTokenMetadata(matchConfig.metadataUri || matchConfig.imageUri);
          }),
        );

        if (cancelled) {
          return;
        }

        setCards(
          matches
            .map((matchConfig, index) => {
              if (!matchConfig || !matchConfig.exists) {
                return null;
              }

              const metadata = resolvedMetadata[index];
              const prediction = predictions[index];
              const claimableReward = claimableRewards[index] ?? 0n;
              const matchStatus = mapMatchState(matchConfig.state);
              const selectedOption = prediction?.exists ? prediction.selectedOption : null;
              const winningOption = matchStatus === "resolved" ? matchConfig.winningOption : null;

              return {
                id: `match-${matchConfig.id.toString()}`,
                matchId: matchConfig.id,
                image: metadata?.image || ipfsToHttp(matchConfig.imageUri),
                teamAFlagUri: metadata?.image ? ipfsToHttp(metadata.image) : ipfsToHttp(matchConfig.imageUri),
                teamBFlagUri: metadata?.teamBImage ?? "",
                drawMintAmount: metadata?.drawMintAmount ?? "—",
                title: metadata?.name && metadata.name !== "Admin Match NFT" ? metadata.name : matchConfig.title,
                description:
                  metadata?.description && metadata.description !== "No description provided."
                    ? metadata.description
                    : matchConfig.description,
                listedPrice: matchConfig.entryPrice,
                rewardAmount: matchConfig.rewardAmount,
                rewardAssetSymbol: matchConfig.rewardAssetSymbol,
                metadataUri: matchConfig.metadataUri,
                matchStatus,
                outcomeLabel: matchConfig.options.join(" vs "),
                rewardLabel: `Reward paid in ${matchConfig.rewardAssetSymbol}`,
                options: [...matchConfig.options],
                totalMints: matchConfig.totalMints,
                winningMints: matchConfig.winningMints,
                opensAt: matchConfig.opensAt,
                closesAt: matchConfig.closesAt,
                winningOption,
                selectedOption,
                tokenId: prediction?.exists ? prediction.tokenId : null,
                userMinted: Boolean(prediction?.exists),
                alreadyClaimed: Boolean(prediction?.claimed),
                claimableReward,
              } satisfies PredictionCard;
            })
            .filter((card): card is PredictionCard => card !== null),
        );
      } catch {
        if (!cancelled) {
          setCards(
            matches
              .map((matchConfig, index) => {
                if (!matchConfig || !matchConfig.exists) {
                  return null;
                }

                const prediction = predictions[index];
                const claimableReward = claimableRewards[index] ?? 0n;
                const matchStatus = mapMatchState(matchConfig.state);

                return {
                  id: `match-${matchConfig.id.toString()}`,
                  matchId: matchConfig.id,
                  image: ipfsToHttp(matchConfig.imageUri),
                  teamAFlagUri: ipfsToHttp(matchConfig.imageUri),
                  teamBFlagUri: "",
                  drawMintAmount: "—",
                  title: matchConfig.title,
                  description: matchConfig.description,
                  listedPrice: matchConfig.entryPrice,
                  rewardAmount: matchConfig.rewardAmount,
                  rewardAssetSymbol: matchConfig.rewardAssetSymbol,
                  metadataUri: matchConfig.metadataUri,
                  matchStatus,
                  outcomeLabel: matchConfig.options.join(" vs "),
                  rewardLabel: `Reward paid in ${matchConfig.rewardAssetSymbol}`,
                  options: [...matchConfig.options],
                  totalMints: matchConfig.totalMints,
                  winningMints: matchConfig.winningMints,
                  opensAt: matchConfig.opensAt,
                  closesAt: matchConfig.closesAt,
                  winningOption: matchStatus === "resolved" ? matchConfig.winningOption : null,
                  selectedOption: prediction?.exists ? prediction.selectedOption : null,
                  tokenId: prediction?.exists ? prediction.tokenId : null,
                  userMinted: Boolean(prediction?.exists),
                  alreadyClaimed: Boolean(prediction?.claimed),
                  claimableReward,
                } satisfies PredictionCard;
              })
              .filter((card): card is PredictionCard => card !== null),
          );
        }
      } finally {
        if (!cancelled) {
          setMetadataLoading(false);
        }
      }
    }

    void loadMatchMetadata();

    return () => {
      cancelled = true;
    };
  }, [claimableRewards, matches, predictions]);

  const chainLabel = isSupportedChain ? activeContracts.chainName : "Unsupported wallet network";

  const isLoading =
    !isMarketplaceConfigured ||
    isNextMatchIdLoading ||
    isMatchesLoading ||
    isMatchesFetching ||
    isPredictionsLoading ||
    isPredictionsFetching ||
    isRewardsLoading ||
    isRewardsFetching ||
    metadataLoading;

  const connectedAddress = address?.toLowerCase() ?? "";
  const adminAddress = typeof ownerAddress === "string" ? ownerAddress.toLowerCase() : "";
  const isAdmin = Boolean(connectedAddress && adminAddress && connectedAddress === adminAddress);

  async function handleClaimReward(matchId: bigint) {
    if (!address || !marketplaceAddress) {
      setFeedbackTone("error");
      setFeedbackMessage("Connect a wallet and configure the reward contract before claiming.");
      return;
    }

    try {
      setFeedbackMessage(null);
      setFeedbackTone(null);
      setTxState({ matchId, action: "claim" });
      await writeContractAsync({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "claimReward",
        args: [matchId],
      });

      setFeedbackTone("success");
      setFeedbackMessage(`Reward claim submitted for match #${matchId.toString()}.`);
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(formatError(error));
    } finally {
      setTxState({ matchId: null, action: null });
    }
  }

  async function handleMintPrediction(matchId: bigint, selectedOption: number, entryPrice: bigint) {
    if (!marketplaceAddress || !quoteTokenAddress || !address) {
      setFeedbackTone("error");
      setFeedbackMessage("Connect your wallet and configure the NFT market before minting.");
      return;
    }

    try {
      setFeedbackMessage(null);
      setFeedbackTone(null);
      setTxState({ matchId, action: "approve" });

      const approvalHash = await writeContractAsync({
        address: quoteTokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [marketplaceAddress, entryPrice],
      });

      await publicClient?.waitForTransactionReceipt({ hash: approvalHash });

      setTxState({ matchId, action: "mint" });
      await writeContractAsync({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "mintPrediction",
        args: [matchId, selectedOption],
      });

      setFeedbackTone("success");
      setFeedbackMessage(`Prediction NFT minted for match #${matchId.toString()} with option ${selectedOption + 1}.`);
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(formatError(error));
    } finally {
      setTxState({ matchId: null, action: null });
    }
  }


  const isApproving = txState.action === "approve";
  const isMintingPrediction = txState.action === "mint";
  const isClaiming = txState.action === "claim";
  const txBusy = isPending || txState.action !== null;

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[#1d291f] bg-[#050705] px-4 py-4 text-[#f5f5ef] shadow-[0_0_0_1px_rgba(34,197,94,0.03),0_30px_80px_rgba(0,0,0,0.45)] sm:px-6 sm:py-6 xl:px-8 xl:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.08),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:60px_60px]" />

      <div className="relative space-y-8">
        {feedbackMessage ? (
          <div
            className={`rounded-[22px] border px-5 py-4 text-sm leading-7 ${
              feedbackTone === "error"
                ? "border-[#6a2f2f] bg-[#1b0d0d] text-[#ffbeb6]"
                : "border-[#1f7b46] bg-[#0d2a18] text-[#b7f8d3]"
            }`}
          >
            {feedbackMessage}
          </div>
        ) : null}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3 text-sm text-[#c6c8c2]">
            {marketCategories.map((category, index) => (
              <button
                key={category}
                type="button"
                className={`rounded-full px-5 py-3 transition ${
                  index === 0
                    ? "border border-[#1f7b46] bg-[#0d2a18] text-[#61f5a1] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    : "text-[#c6c8c2] hover:bg-[#0f1711] hover:text-white"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-between gap-3 rounded-2xl border border-[#283127] bg-[#151c15] px-5 py-3 font-mono text-sm text-[#d8dad4] lg:min-w-[220px]"
          >
            <span>{isAdmin ? `Admin wallet connected • ${chainLabel}` : chainLabel}</span>
            <span className="text-[#9fa39b]">⌄</span>
          </button>
        </div>

        {!isSupportedChain && address ? (
          <div className="rounded-[24px] border border-[#57451b] bg-[linear-gradient(180deg,#161206_0%,#0d0b05_100%)] p-6 text-sm text-[#f0efe6]">
            Switch your wallet to X Layer Testnet or Ethereum Sepolia to load the configured match market.
          </div>
        ) : null}

        {!isMarketplaceConfigured ? (
          <div className="rounded-[24px] border border-[#57451b] bg-[linear-gradient(180deg,#161206_0%,#0d0b05_100%)] p-6 text-sm text-[#f0efe6]">
            Set NEXT_PUBLIC_XLAYER_MARKETPLACE_ADDRESS to load the admin match NFT contract.
          </div>
        ) : null}

        {!isQuoteTokenConfigured ? (
          <div className="rounded-[24px] border border-[#57451b] bg-[linear-gradient(180deg,#161206_0%,#0d0b05_100%)] p-6 text-sm text-[#f0efe6]">
            Set NEXT_PUBLIC_XLAYER_QUOTE_TOKEN_ADDRESS to enable COR approval before minting.
          </div>
        ) : null}

        <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 3 }, (_, index) => <PredictionCardSkeleton key={`skeleton-${index}`} />)
          ) : cards.length === 0 ? (
            <div className="col-span-full rounded-[24px] border border-[#242926] bg-[#141518] p-8 text-sm text-[#c6c8c2]">
              No admin-created match NFTs were found at the configured contract address.
            </div>
          ) : (
            cards.map((card) => {
              const isCardBusy = txBusy && txState.matchId === card.matchId;
              const canClaim = card.claimableReward > 0n && !card.alreadyClaimed;
              const teamA = card.options[0] ?? "Team A";
              const teamB = card.options[1] ?? "Team B";
              const mintChoices = getMintChoices(card, teamA, teamB);
              const canMint = card.matchStatus === "live" && !card.userMinted;
              const mintSlots: MintSlot[] = mintChoices.map((choice) => {
                const drawDisabled = isDrawMintDisabled(card, choice);

                return {
                  id: `${card.matchId.toString()}-${choice.optionIndex}`,
                  label: getMintSlotLabel(choice),
                  amount: formatMintSlotAmount(card, choice),
                  onClick:
                    canMint && !drawDisabled
                      ? () => void handleMintPrediction(card.matchId, choice.optionIndex, choice.price)
                      : undefined,
                  disabled:
                    drawDisabled || !isSupportedChain || !isMarketplaceConfigured || !isQuoteTokenConfigured || txBusy,
                  loading: isCardBusy && (isMintingPrediction || isApproving),
                };
              });

              return (
                <div key={card.id} className="min-w-0">
                  <MatchPredictionPreview
                    label={`Match #${card.matchId.toString()} • ${card.matchStatus.toUpperCase()}`}
                    teamA={teamA}
                    teamB={teamB}
                    teamAFlagUri={card.teamAFlagUri}
                    teamBFlagUri={card.teamBFlagUri}
                    mintSlots={mintSlots}
                    rewardAssetSymbol={card.rewardAssetSymbol || "COR"}
                    footer={
                      <>
                        <div className="rounded-2xl border border-[#243225] bg-[#0c120d] px-4 py-3 text-sm text-[#c6c8c2]">
                          <div className="font-medium text-[#f1f1ea]">{card.title}</div>
                          <p className="mt-2 leading-6">{card.description}</p>
                          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                            <div>
                              Opens: <span className="font-mono text-[#e8e8de]">{formatDate(card.opensAt)}</span>
                            </div>
                            <div>
                              Closes: <span className="font-mono text-[#e8e8de]">{formatDate(card.closesAt)}</span>
                            </div>
                            <div>
                              Total mints: <span className="font-mono text-[#e8e8de]">{card.totalMints.toString()}</span>
                            </div>
                            <div>
                              Claimable:{" "}
                              <span className="font-mono text-[#e8e8de]">
                                {formatPrice(card.claimableReward, card.rewardAssetSymbol)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {card.userMinted ? (
                          <div className="rounded-2xl border border-[#2a372c] bg-[#0f1711] px-4 py-4 text-sm text-[#b7c2b5]">
                            Your NFT pick: {card.selectedOption !== null ? card.options[card.selectedOption] : "Pending"}
                            {card.tokenId ? ` • Token #${card.tokenId.toString()}` : ""}
                            {card.alreadyClaimed ? " • Reward already claimed" : ""}
                          </div>
                        ) : null}

                        {canClaim ? (
                          <button
                            type="button"
                            onClick={() => void handleClaimReward(card.matchId)}
                            disabled={!isSupportedChain || !isMarketplaceConfigured || txBusy}
                            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[#334032] bg-[#263126] px-4 py-4 text-base font-semibold text-[#edf5ed] transition hover:bg-[#2d3a2d] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isCardBusy && isClaiming ? (
                              <>
                                <span className="size-4 animate-spin rounded-full border-2 border-[#edf5ed]/25 border-t-[#edf5ed]" />
                                Claiming...
                              </>
                            ) : (
                              `Claim ${formatPrice(card.claimableReward, card.rewardAssetSymbol)}`
                            )}
                          </button>
                        ) : null}
                      </>
                    }
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
