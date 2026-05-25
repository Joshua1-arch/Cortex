"use client";

import { Trophy, ShieldCheck, Target, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { parseAbi, parseEther, type Hex } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { getContractsForChain, hasConfiguredAddress } from "@/lib/contracts";

const soulboundAbi = parseAbi([
  "function mint() external payable returns (uint256)",
  "function getSupporterProfile(address supporter) external view returns ((uint256 tokenId,uint256 reputation,uint256 level,uint256 predictionCount,uint256 correctPredictionCount,uint256 streak,uint256 longestStreak,uint256 claimCount,uint256 swapCount,uint256 lastUpdatedAt,bool founderMinted))",
  "function getMatchCampaign(uint256 campaignId) external view returns ((uint256 id,string slug,string homeTeam,string awayTeam,uint256 startsAt,uint256 closesAt,uint8 outcome,bool settled,bool exists))",
  "function getPrediction(address supporter, uint256 campaignId) external view returns ((uint256 campaignId,uint8 pick,uint256 confidenceStake,bool settled,bool won,bool claimed,uint256 submittedAt))",
  "function submitPrediction(uint256 campaignId, uint8 pick, uint256 confidenceStake) external",
  "function MINT_PRICE() external view returns (uint256)",
]);

type SupporterProfile = {
  tokenId: bigint;
  reputation: bigint;
  level: bigint;
  predictionCount: bigint;
  correctPredictionCount: bigint;
  streak: bigint;
  longestStreak: bigint;
  claimCount: bigint;
  swapCount: bigint;
  lastUpdatedAt: bigint;
  founderMinted: boolean;
};

type MatchCampaign = {
  id: bigint;
  slug: string;
  homeTeam: string;
  awayTeam: string;
  startsAt: bigint;
  closesAt: bigint;
  outcome: number;
  settled: boolean;
  exists: boolean;
};

type PredictionReceipt = {
  campaignId: bigint;
  pick: number;
  confidenceStake: bigint;
  settled: boolean;
  won: boolean;
  claimed: boolean;
  submittedAt: bigint;
};

const CAMPAIGN_ID = 1n;
const TEAM_OPTIONS = [
  { value: 1, label: "Home Win" },
  { value: 2, label: "Draw" },
  { value: 3, label: "Away Win" },
] as const;

function formatRelativeTimestamp(value: bigint) {
  if (value === 0n) {
    return "Not available";
  }

  return new Date(Number(value) * 1000).toLocaleString();
}

function formatLevel(value?: bigint) {
  return `Level ${value ? value.toString() : "0"}`;
}

function formatPickLabel(value?: number) {
  return TEAM_OPTIONS.find((option) => option.value === value)?.label ?? "No prediction yet";
}

export function SupporterPassCard() {
  const [selectedPick, setSelectedPick] = useState<number>(1);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"idle" | "success" | "error">("idle");
  const [isMinting, setIsMinting] = useState(false);
  const [isSubmittingPrediction, setIsSubmittingPrediction] = useState(false);
  const { address, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const activeChainId = chainId ?? 1952;
  const activeContracts = getContractsForChain(activeChainId);
  const soulboundAddress = hasConfiguredAddress(activeContracts.soulboundAddress)
    ? activeContracts.soulboundAddress
    : undefined;
  const isSoulboundConfigured = Boolean(soulboundAddress);

  const { data: mintPrice } = useReadContract({
    address: soulboundAddress,
    abi: soulboundAbi,
    functionName: "MINT_PRICE",
    query: {
      enabled: isSoulboundConfigured,
    },
  });

  const { data: supporterProfile } = useReadContract({
    address: soulboundAddress,
    abi: soulboundAbi,
    functionName: "getSupporterProfile",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address) && isSoulboundConfigured,
    },
  });

  const { data: campaign } = useReadContract({
    address: soulboundAddress,
    abi: soulboundAbi,
    functionName: "getMatchCampaign",
    args: [CAMPAIGN_ID],
    query: {
      enabled: isSoulboundConfigured,
    },
  });

  const { data: prediction } = useReadContract({
    address: soulboundAddress,
    abi: soulboundAbi,
    functionName: "getPrediction",
    args: address ? [address, CAMPAIGN_ID] : undefined,
    query: {
      enabled: Boolean(address) && isSoulboundConfigured,
    },
  });

  const profile = supporterProfile as SupporterProfile | undefined;
  const matchCampaign = campaign as MatchCampaign | undefined;
  const predictionReceipt = prediction as PredictionReceipt | undefined;

  const derivedStatusClassName = useMemo(() => {
    if (statusTone === "success") {
      return "border-[#1f7b46] bg-[#0d2a18] text-[#b7f8d3]";
    }

    if (statusTone === "error") {
      return "border-[#6a2f2f] bg-[#1b0d0d] text-[#ffbeb6]";
    }

    return "border-[#2a332c] bg-[#101511] text-[#c7d2c5]";
  }, [statusTone]);

  const campaignTitle = matchCampaign?.exists
    ? `${matchCampaign.homeTeam} vs ${matchCampaign.awayTeam}`
    : "World Cup Match Campaign";

  async function handleMintPass() {
    if (!address || !soulboundAddress) {
      setStatusMessage("Connect your wallet and configure the supporter passport contract first.");
      setStatusTone("error");
      return;
    }

    try {
      setIsMinting(true);
      setStatusMessage("");
      setStatusTone("idle");

      await writeContractAsync({
        address: soulboundAddress,
        abi: soulboundAbi,
        functionName: "mint",
        value: (mintPrice as bigint | undefined) ?? parseEther("0.001"),
      });

      setStatusMessage("Supporter passport mint submitted successfully.");
      setStatusTone("success");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Mint failed.");
      setStatusTone("error");
    } finally {
      setIsMinting(false);
    }
  }

  async function handleSubmitPrediction() {
    if (!address || !soulboundAddress) {
      setStatusMessage("Connect your wallet and configure the supporter passport contract first.");
      setStatusTone("error");
      return;
    }

    try {
      setIsSubmittingPrediction(true);
      setStatusMessage("");
      setStatusTone("idle");

      await writeContractAsync({
        address: soulboundAddress as Hex,
        abi: soulboundAbi,
        functionName: "submitPrediction",
        args: [CAMPAIGN_ID, selectedPick, 0n],
      });

      setStatusMessage("Prediction submitted onchain. It will now count toward supporter reputation once settled.");
      setStatusTone("success");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Prediction submission failed.");
      setStatusTone("error");
    } finally {
      setIsSubmittingPrediction(false);
    }
  }

  return (
    <section className="rounded-[32px] border border-[#1d291f] bg-[linear-gradient(180deg,#111512_0%,#090c0a_100%)] p-5 text-[#f2f5ef] shadow-[0_20px_70px_rgba(0,0,0,0.4)] sm:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#29442f] bg-[#0f1812] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#86eba2]">
            <Sparkles className="size-3.5" />
            World Cup Supporter Passport
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#f4f7f1] sm:text-4xl">
            Predict matches and grow your onchain fan reputation
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#b6c1b3] sm:text-base">
            Mint a Cortex supporter passport, commit a World Cup match prediction on X Layer, and build a visible
            reputation trail from your football participation.
          </p>
        </div>

        <div className="grid min-w-[260px] gap-3 rounded-[24px] border border-[#233126] bg-[#0d120e] p-4">
          <div className="flex items-center gap-3">
            <Trophy className="size-5 text-[#f0ca6a]" />
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-[#90a48f]">Supporter Level</div>
              <div className="text-lg font-semibold text-[#f4f7f1]">{formatLevel(profile?.level)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm text-[#d5ddd1]">
            <div className="rounded-2xl border border-[#202a22] bg-[#0a0f0b] p-3">
              <div className="text-xs uppercase tracking-[0.14em] text-[#8fa18e]">Reputation</div>
              <div className="mt-2 text-xl font-semibold">{profile?.reputation?.toString() ?? "0"}</div>
            </div>
            <div className="rounded-2xl border border-[#202a22] bg-[#0a0f0b] p-3">
              <div className="text-xs uppercase tracking-[0.14em] text-[#8fa18e]">Streak</div>
              <div className="mt-2 text-xl font-semibold">{profile?.streak?.toString() ?? "0"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-[#243126] bg-[#0c110d] p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 size-5 text-[#7cf2a1]" />
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[#7cf2a1]">Supporter Passport</div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#f5f8f3]">
                Founder-grade identity for match campaigns
              </h3>
              <p className="mt-3 text-sm leading-7 text-[#b8c3b5]">
                This soulbound pass now tracks reputation, participation, streaks, swaps, claims, and prediction wins
                directly onchain.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#202a22] bg-[#0a0f0b] p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-[#90a18f]">Founder Minted</div>
              <div className="mt-2 text-lg font-semibold text-[#f3f7f0]">
                {profile?.founderMinted ? "Yes" : "Not yet"}
              </div>
            </div>
            <div className="rounded-2xl border border-[#202a22] bg-[#0a0f0b] p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-[#90a18f]">Predictions</div>
              <div className="mt-2 text-lg font-semibold text-[#f3f7f0]">
                {profile?.predictionCount?.toString() ?? "0"}
              </div>
            </div>
            <div className="rounded-2xl border border-[#202a22] bg-[#0a0f0b] p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-[#90a18f]">Correct Picks</div>
              <div className="mt-2 text-lg font-semibold text-[#f3f7f0]">
                {profile?.correctPredictionCount?.toString() ?? "0"}
              </div>
            </div>
            <div className="rounded-2xl border border-[#202a22] bg-[#0a0f0b] p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-[#90a18f]">Longest Streak</div>
              <div className="mt-2 text-lg font-semibold text-[#f3f7f0]">
                {profile?.longestStreak?.toString() ?? "0"}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <Button
              type="button"
              onClick={() => void handleMintPass()}
              disabled={!address || !isSoulboundConfigured || isMinting}
              isLoading={isMinting}
              loadingText="Opening wallet..."
              className="w-full px-5 py-4 text-base sm:w-auto"
            >
              Mint Supporter Passport
            </Button>
          </div>
        </div>

        <div className="rounded-[28px] border border-[#243126] bg-[#0c110d] p-5">
          <div className="flex items-start gap-3">
            <Target className="mt-1 size-5 text-[#f0ca6a]" />
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[#f0ca6a]">Live Match Campaign</div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#f5f8f3]">{campaignTitle}</h3>
              <p className="mt-3 text-sm leading-7 text-[#b8c3b5]">
                Submit a World Cup prediction on X Layer. Your choice becomes a verifiable part of your supporter trail.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 text-sm text-[#d6ddd3] sm:grid-cols-2">
            <div className="rounded-2xl border border-[#202a22] bg-[#0a0f0b] p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-[#90a18f]">Campaign Window</div>
              <div className="mt-2 leading-6">Closes {formatRelativeTimestamp(matchCampaign?.closesAt ?? 0n)}</div>
            </div>
            <div className="rounded-2xl border border-[#202a22] bg-[#0a0f0b] p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-[#90a18f]">Your Pick</div>
              <div className="mt-2 leading-6">{formatPickLabel(predictionReceipt?.pick)}</div>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {TEAM_OPTIONS.map((option) => {
              const isActive = selectedPick === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedPick(option.value)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    isActive
                      ? "border-[#4fe08c] bg-[#112116] text-[#ecf7ef]"
                      : "border-[#263126] bg-[#0a0f0b] text-[#aeb8aa] hover:border-[#36513d] hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              onClick={() => void handleSubmitPrediction()}
              disabled={!address || !isSoulboundConfigured || isSubmittingPrediction}
              isLoading={isSubmittingPrediction}
              loadingText="Opening wallet..."
              className="w-full px-5 py-4 text-base sm:w-auto"
            >
              Submit Prediction
            </Button>
            <div className="rounded-2xl border border-[#243126] bg-[#0b110d] px-4 py-3 text-sm text-[#94a291]">
              Confidence stake is fixed at 0 for this first campaign build to keep execution simple and reliable.
            </div>
          </div>
        </div>
      </div>

      {statusMessage ? (
        <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${derivedStatusClassName}`}>{statusMessage}</div>
      ) : null}
    </section>
  );
}
