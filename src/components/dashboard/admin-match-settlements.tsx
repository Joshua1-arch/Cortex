"use client";

import { useMemo, useState } from "react";
import { formatEther } from "viem";
import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getContractsForChain, hasConfiguredAddress } from "@/lib/contracts";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const XLAYER_TESTNET_CHAIN_ID = 1952;

const marketplaceAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
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
    name: "openMatch",
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
] as const;

type MatchState = "draft" | "live" | "resolved" | "cancelled";

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
  options: string[];
};

type MatchRecord = Omit<MatchTuple, "state" | "exists"> & {
  state: MatchState;
};

type FilterKey = "all" | MatchState;

const filterOptions: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "draft", label: "Draft" },
  { key: "resolved", label: "Resolved" },
  { key: "cancelled", label: "Cancelled" },
];

function formatError(error: unknown) {
  if (error && typeof error === "object") {
    const maybeError = error as {
      message?: string;
      shortMessage?: string;
      details?: string;
      cause?: { message?: string; shortMessage?: string; details?: string };
    };

    const candidate =
      maybeError.shortMessage
      ?? maybeError.details
      ?? maybeError.message
      ?? maybeError.cause?.shortMessage
      ?? maybeError.cause?.details
      ?? maybeError.cause?.message;

    if (candidate) {
      return candidate;
    }
  }

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

function statusStyles(status: MatchState) {
  if (status === "live") {
    return "border-[#1f7b46] bg-[#0d2a18] text-[#61f5a1]";
  }

  if (status === "resolved") {
    return "border-[#5b4b1d] bg-[#201907] text-[#efc75e]";
  }

  if (status === "cancelled") {
    return "border-[#6a2f2f] bg-[#1b0d0d] text-[#ffbeb6]";
  }

  return "border-[#2a372c] bg-[#111713] text-[#cbd3c8]";
}

function MatchRowSkeleton() {
  return (
    <div className="rounded-[22px] border border-[#243225] bg-[#0b100c] p-5">
      <div className="h-5 w-40 animate-pulse rounded bg-[#1b211d]" />
      <div className="mt-4 h-4 w-full animate-pulse rounded bg-[#171c18]" />
      <div className="mt-3 h-10 w-2/3 animate-pulse rounded-2xl bg-[#202823]" />
    </div>
  );
}

export function AdminMatchSettlements() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const { showAlert } = useToast();

  const [filter, setFilter] = useState<FilterKey>("all");
  const [pendingMatchId, setPendingMatchId] = useState<bigint | null>(null);
  const [pendingAction, setPendingAction] = useState<"open" | "resolve" | null>(null);

  const activeContracts = getContractsForChain(XLAYER_TESTNET_CHAIN_ID);
  const marketplaceAddress =
    (activeContracts.marketplaceAddress && hasConfiguredAddress(activeContracts.marketplaceAddress)
      ? activeContracts.marketplaceAddress
      : undefined) ?? (process.env.NEXT_PUBLIC_XLAYER_MARKETPLACE_ADDRESS as `0x${string}` | undefined);

  const isMarketplaceConfigured = Boolean(marketplaceAddress && marketplaceAddress !== ZERO_ADDRESS);

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

    return Array.from({ length: Number(nextId - 1n) }, (_, index) => BigInt(index + 1)).reverse();
  }, [nextMatchId]);

  const matchContracts = useMemo(
    () =>
      isMarketplaceConfigured
        ? matchIds.map((matchId) => ({
            address: marketplaceAddress,
            abi: marketplaceAbi,
            functionName: "getMatch" as const,
            args: [matchId] as const,
          }))
        : [],
    [isMarketplaceConfigured, matchIds, marketplaceAddress],
  );

  const { data: matchResults, isLoading: isMatchesLoading, isFetching: isMatchesFetching } = useReadContracts({
    contracts: matchContracts,
    query: { enabled: matchContracts.length > 0 },
  });

  const matches = useMemo(() => {
    return (matchResults ?? [])
      .map((result) => {
        if (result.status !== "success" || !result.result) {
          return null;
        }

        const match = result.result as MatchTuple;
        if (!match.exists) {
          return null;
        }

        const { exists: _exists, state, ...rest } = match;

        return {
          ...rest,
          state: mapMatchState(state),
        } satisfies MatchRecord;
      })
      .filter((match): match is MatchRecord => match !== null);
  }, [matchResults]);

  const filteredMatches = useMemo(() => {
    if (filter === "all") {
      return matches;
    }

    return matches.filter((match) => match.state === filter);
  }, [filter, matches]);

  const connectedAddress = address?.toLowerCase() ?? "";
  const adminAddress = typeof ownerAddress === "string" ? ownerAddress.toLowerCase() : "";
  const isAdmin = Boolean(connectedAddress && adminAddress && connectedAddress === adminAddress);
  const isLoading = !isMarketplaceConfigured || isNextMatchIdLoading || isMatchesLoading || isMatchesFetching;
  const txBusy = isPending || pendingAction !== null;

  async function handleOpenMatch(matchId: bigint) {
    if (!marketplaceAddress) {
      showAlert("Configure the marketplace contract before opening matches.", "error");
      return;
    }

    if (!isAdmin) {
      showAlert("Connect the marketplace owner wallet to open matches.", "error");
      return;
    }

    try {
      setPendingMatchId(matchId);
      setPendingAction("open");
      await writeContractAsync({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "openMatch",
        args: [matchId],
      });
      showAlert(`Match #${matchId.toString()} is now live.`, "success");
    } catch (error) {
      showAlert(formatError(error), "error");
    } finally {
      setPendingMatchId(null);
      setPendingAction(null);
    }
  }

  async function handleResolveMatch(matchId: bigint, winningOption: number, winnerLabel: string) {
    if (!marketplaceAddress) {
      showAlert("Configure the marketplace contract before settling matches.", "error");
      return;
    }

    if (!isAdmin) {
      showAlert("Connect the marketplace owner wallet to settle predictions.", "error");
      return;
    }

    const confirmed = window.confirm(
      `Settle match #${matchId.toString()} with winner "${winnerLabel}"? Winners can claim rewards after this.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setPendingMatchId(matchId);
      setPendingAction("resolve");
      await writeContractAsync({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "resolveMatch",
        args: [matchId, winningOption],
      });
      showAlert(`Match #${matchId.toString()} settled. Winner: ${winnerLabel}.`, "success");
    } catch (error) {
      const message = formatError(error);
      showAlert(
        message.includes("MatchNotResolvable")
          ? "This match must be live before you can settle it. Open the match first if it is still a draft."
          : message,
        "error",
      );
    } finally {
      setPendingMatchId(null);
      setPendingAction(null);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[#1d291f] bg-[#050705] px-4 py-4 text-[#f5f5ef] shadow-[0_0_0_1px_rgba(34,197,94,0.03),0_30px_80px_rgba(0,0,0,0.45)] sm:px-6 sm:py-6 xl:px-8 xl:py-8">
      <div className="relative space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8f9b8e]">Match history</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#f1f1ea] sm:text-3xl">
              Settle prediction markets
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[#a9b4a8]">
              Review every match created onchain, open drafts, and mark the winning option so users can claim COR rewards.
            </p>
          </div>

          <div className="rounded-2xl border border-[#243225] bg-[#0c120d] px-4 py-3 text-sm text-[#c6c8c2]">
            {isAdmin
              ? "Owner wallet connected"
              : "Connect the marketplace owner wallet to settle matches"}
          </div>
        </div>

        {!isMarketplaceConfigured ? (
          <div className="rounded-[24px] border border-[#57451b] bg-[linear-gradient(180deg,#161206_0%,#0d0b05_100%)] p-6 text-sm text-[#f0efe6]">
            Set NEXT_PUBLIC_XLAYER_MARKETPLACE_ADDRESS to load match history.
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                filter === option.key
                  ? "border border-[#1f7b46] bg-[#0d2a18] text-[#61f5a1]"
                  : "border border-transparent text-[#a9b4a8] hover:border-[#243225] hover:bg-[#101512] hover:text-[#f1f1ea]"
              }`}
            >
              {option.label}
              {option.key === "all" ? ` (${matches.length})` : ` (${matches.filter((m) => m.state === option.key).length})`}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {Array.from({ length: 3 }, (_, index) => (
              <MatchRowSkeleton key={`settlement-skeleton-${index}`} />
            ))}
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="rounded-[22px] border border-[#243225] bg-[#0b100c] p-8 text-sm text-[#a9b4a8]">
            {matches.length === 0
              ? "No matches have been created on this marketplace yet."
              : `No ${filter === "all" ? "" : filter} matches to show.`}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredMatches.map((match) => {
              const isRowBusy = txBusy && pendingMatchId === match.id;
              const winnerLabel =
                match.state === "resolved" && match.options[match.winningOption]
                  ? match.options[match.winningOption]
                  : null;

              return (
                <article
                  key={match.id.toString()}
                  className="rounded-[22px] border border-[#243225] bg-[linear-gradient(180deg,#101512_0%,#0b100c_100%)] p-5 sm:p-6"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-[#f1f1ea]">Match #{match.id.toString()}</h3>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] ${statusStyles(match.state)}`}
                        >
                          {match.state}
                        </span>
                      </div>

                      <p className="mt-2 text-base font-medium text-[#dce4dc]">{match.title}</p>
                      <p className="mt-1 font-mono text-xs text-[#8f9b8e]">{match.slug}</p>
                      <p className="mt-3 text-sm leading-6 text-[#a9b4a8]">{match.description}</p>

                      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#a9b4a8]">
                        <span>
                          Opens: <span className="font-mono text-[#e8e8de]">{formatDate(match.opensAt)}</span>
                        </span>
                        <span>
                          Closes: <span className="font-mono text-[#e8e8de]">{formatDate(match.closesAt)}</span>
                        </span>
                        <span>
                          Total mints: <span className="font-mono text-[#e8e8de]">{match.totalMints.toString()}</span>
                        </span>
                        <span>
                          Mint price:{" "}
                          <span className="font-mono text-[#e8e8de]">
                            {formatEther(match.entryPrice)} {match.rewardAssetSymbol || "COR"}
                          </span>
                        </span>
                        <span>
                          Winner reward:{" "}
                          <span className="font-mono text-[#e8e8de]">
                            {formatEther(match.rewardAmount)} {match.rewardAssetSymbol || "COR"}
                          </span>
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {match.options.map((option, index) => (
                          <span
                            key={`${match.id.toString()}-option-${index}`}
                            className={`rounded-full border px-3 py-1.5 text-xs ${
                              match.state === "resolved" && match.winningOption === index
                                ? "border-[#5b4b1d] bg-[#201907] text-[#efc75e]"
                                : "border-[#2a372c] bg-[#111713] text-[#cbd3c8]"
                            }`}
                          >
                            {index + 1}. {option}
                            {match.state === "resolved" && match.winningOption === index ? " • Winner" : ""}
                          </span>
                        ))}
                      </div>

                      {winnerLabel ? (
                        <div className="mt-4 rounded-2xl border border-[#5b4b1d] bg-[#161206] px-4 py-3 text-sm text-[#efc75e]">
                          Settled winner: <span className="font-semibold text-[#f1f1ea]">{winnerLabel}</span>
                          {match.winningMints > 0n ? (
                            <span className="text-[#c6c8c2]">
                              {" "}
                              • {match.winningMints.toString()} winning mint
                              {match.winningMints === 1n ? "" : "s"}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex w-full shrink-0 flex-col gap-3 sm:max-w-none lg:w-full lg:max-w-sm xl:max-w-md">
                      {match.state === "draft" ? (
                        <Button
                          type="button"
                          onClick={() => void handleOpenMatch(match.id)}
                          isLoading={isRowBusy && pendingAction === "open"}
                          loadingText="Opening..."
                          disabled={!isAdmin || txBusy}
                          className="w-full"
                        >
                          Open match for minting
                        </Button>
                      ) : null}

                      {match.state === "live" ? (
                        <div className="flex w-full flex-col gap-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8f9b8e]">
                            Mark winner
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                          {match.options.map((option, index) => (
                            <button
                              key={`${match.id.toString()}-resolve-${index}`}
                              type="button"
                              onClick={() => void handleResolveMatch(match.id, index, option)}
                              disabled={!isAdmin || txBusy}
                              className="flex w-full items-center justify-center rounded-2xl border border-[#334032] bg-[#263126] px-3 py-3 text-sm font-semibold text-[#edf5ed] transition hover:bg-[#2d3a2d] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isRowBusy && pendingAction === "resolve" ? (
                                <span className="inline-flex items-center gap-2">
                                  <span className="size-4 animate-spin rounded-full border-2 border-[#edf5ed]/25 border-t-[#edf5ed]" />
                                  Settling...
                                </span>
                              ) : (
                                `Set winner: ${option}`
                              )}
                            </button>
                          ))}
                          </div>
                        </div>
                      ) : null}

                      {match.state === "resolved" || match.state === "cancelled" ? (
                        <div className="rounded-2xl border border-[#243225] bg-[#0c120d] px-4 py-3 text-sm text-[#a9b4a8]">
                          {match.state === "resolved"
                            ? "This match is settled. Winners can claim on /nfts."
                            : "This match was cancelled."}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
