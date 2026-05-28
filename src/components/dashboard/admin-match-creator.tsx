"use client";

import { FormEvent, useMemo, useState } from "react";
import { parseEther } from "viem";
import { MatchPredictionPreview, type MintSlot } from "@/components/dashboard/match-prediction-preview";
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
    name: "createMatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "slug", type: "string" },
      { name: "title", type: "string" },
      { name: "description", type: "string" },
      { name: "imageUri", type: "string" },
      { name: "rewardAssetSymbol", type: "string" },
      { name: "metadataUri", type: "string" },
      { name: "options", type: "string[]" },
      { name: "entryPrice", type: "uint256" },
      { name: "rewardAmount", type: "uint256" },
      { name: "opensAt", type: "uint256" },
      { name: "closesAt", type: "uint256" },
      { name: "openImmediately", type: "bool" },
    ],
    outputs: [{ name: "matchId", type: "uint256" }],
  },
] as const;

type AdminFormState = {
  slug: string;
  title: string;
  description: string;
  teamAFlagUri: string;
  teamBFlagUri: string;
  teamA: string;
  teamB: string;
  entryPrice: string;
  rewardAmount: string;
  drawEntryPrice: string;
  opensAt: string;
  closesAt: string;
  openImmediately: boolean;
};

type MatchPreview = {
  metadataUri: string;
  title: string;
  description: string;
  image: string;
  options: string[];
};

type ExistingMatchTuple = {
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
  options: string[];
};

const defaultFormState: AdminFormState = {
  slug: "brazil-vs-france-semi",
  title: "Brazil vs France - Semifinal Winner",
  description: "Admin-created winner market for the semifinal. The selected flag art becomes the NFT users mint on /nfts.",
  teamAFlagUri: "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1200&q=80",
  teamBFlagUri: "https://images.unsplash.com/photo-1527866512907-e31b9d0dd7b0?auto=format&fit=crop&w=1200&q=80",
  teamA: "Brazil",
  teamB: "France",
  entryPrice: "10",
  rewardAmount: "10",
  drawEntryPrice: "2",
  opensAt: "",
  closesAt: "",
  openImmediately: true,
};

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

function toUnixTimestamp(value: string) {
  if (!value) {
    return 0n;
  }

  const milliseconds = new Date(value).getTime();
  if (!Number.isFinite(milliseconds) || Number.isNaN(milliseconds)) {
    return 0n;
  }

  return BigInt(Math.floor(milliseconds / 1000));
}

function syncTitleFromTeams(teamA: string, teamB: string, currentTitle: string) {
  const normalizedTeamA = teamA.trim();
  const normalizedTeamB = teamB.trim();

  if (!normalizedTeamA || !normalizedTeamB || !currentTitle.includes(" vs ")) {
    return currentTitle;
  }

  const suffixMatch = currentTitle.match(/\s+-\s+(.+)$/);
  const suffix = suffixMatch ? ` - ${suffixMatch[1]}` : " - Winner";

  return `${normalizedTeamA} vs ${normalizedTeamB}${suffix}`;
}

function createMetadataUri({
  title,
  description,
  image,
  teamBImage,
  drawMintAmount,
}: {
  title: string;
  description: string;
  image: string;
  teamBImage?: string;
  drawMintAmount?: string;
}) {
  if (typeof window === "undefined") {
    return "";
  }

  const payload = JSON.stringify({
    name: title,
    description,
    image,
    properties: {
      ...(teamBImage ? { teamBImage } : {}),
      ...(drawMintAmount ? { drawMintAmount } : {}),
    },
  });

  const utf8Bytes = new TextEncoder().encode(payload);
  let binary = "";

  for (const byte of utf8Bytes) {
    binary += String.fromCharCode(byte);
  }

  return `data:application/json;base64,${window.btoa(binary)}`;
}


export function AdminMatchCreator() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const { showAlert } = useToast();

  const [formState, setFormState] = useState<AdminFormState>(defaultFormState);

  const activeContracts = getContractsForChain(XLAYER_TESTNET_CHAIN_ID);
  const marketplaceAddress =
    (activeContracts.marketplaceAddress && hasConfiguredAddress(activeContracts.marketplaceAddress)
      ? activeContracts.marketplaceAddress
      : undefined) ?? (process.env.NEXT_PUBLIC_XLAYER_MARKETPLACE_ADDRESS as `0x${string}` | undefined);
  const isMarketplaceConfigured = Boolean(marketplaceAddress && marketplaceAddress !== ZERO_ADDRESS);

  const configuredOwnerAddress = ((process.env.NEXT_PUBLIC_XLAYER_RECIPIENT_ADDRESS as `0x${string}` | undefined) ?? "").trim();

  const { data: ownerAddress } = useReadContract({
    address: isMarketplaceConfigured ? marketplaceAddress : undefined,
    abi: marketplaceAbi,
    functionName: "owner",
    query: { enabled: isMarketplaceConfigured },
  });

  const connectedAddress = address?.toLowerCase() ?? "";
  const onchainOwnerAddress = typeof ownerAddress === "string" ? ownerAddress.toLowerCase() : "";
  const fallbackOwnerAddress = configuredOwnerAddress.toLowerCase();
  const effectiveOwnerAddress = onchainOwnerAddress || fallbackOwnerAddress;
  const isAdmin = Boolean(connectedAddress && effectiveOwnerAddress && connectedAddress === effectiveOwnerAddress);

  const { data: nextMatchId } = useReadContract({
    address: isMarketplaceConfigured ? marketplaceAddress : undefined,
    abi: marketplaceAbi,
    functionName: "nextMatchId",
    query: { enabled: isMarketplaceConfigured },
  });

  const existingMatchIds = useMemo(() => {
    const nextId = typeof nextMatchId === "bigint" ? nextMatchId : 1n;
    if (nextId <= 1n) {
      return [] as bigint[];
    }

    return Array.from({ length: Number(nextId - 1n) }, (_, index) => BigInt(index + 1));
  }, [nextMatchId]);

  const existingMatchContracts = useMemo(
    () =>
      isMarketplaceConfigured
        ? existingMatchIds.map((matchId) => ({
            address: marketplaceAddress,
            abi: marketplaceAbi,
            functionName: "getMatch" as const,
            args: [matchId] as const,
          }))
        : [],
    [existingMatchIds, isMarketplaceConfigured, marketplaceAddress],
  );

  const { data: existingMatchResults } = useReadContracts({
    contracts: existingMatchContracts,
    query: { enabled: existingMatchContracts.length > 0 },
  });

  const existingSlugs = useMemo(() => {
    if (!existingMatchResults) {
      return new Set<string>();
    }

    const normalizedSlugs = existingMatchResults.flatMap((result) => {
      if (result.status !== "success") {
        return [] as string[];
      }

      const matchConfig = result.result as ExistingMatchTuple;
      return matchConfig.exists ? [matchConfig.slug.trim().toLowerCase()] : [];
    });

    return new Set(normalizedSlugs);
  }, [existingMatchResults]);

  const preview = useMemo<MatchPreview>(() => {
    const options = [formState.teamA.trim(), formState.teamB.trim(), "Draw"].filter(
      (option, index) => index === 2 || Boolean(option),
    );
    const title = formState.title.trim() || "Untitled match";
    const description = formState.description.trim() || "No description provided.";
    const image = formState.teamAFlagUri.trim() || formState.teamBFlagUri.trim();

    return {
      metadataUri: createMetadataUri({
        title,
        description,
        image,
        teamBImage: formState.teamBFlagUri.trim(),
        drawMintAmount: formState.drawEntryPrice.trim(),
      }),
      title,
      description,
      image,
      options,
    };
  }, [formState]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!address) {
      showAlert("Connect the admin wallet before creating matches.", "error");
      return;
    }

    if (!isMarketplaceConfigured || !marketplaceAddress) {
      showAlert("Set NEXT_PUBLIC_XLAYER_MARKETPLACE_ADDRESS before creating matches.", "error");
      return;
    }

    if (!isAdmin) {
      const connectedLabel = connectedAddress || "not connected";
      const ownerLabel = effectiveOwnerAddress || "unavailable";
      showAlert(`Only the marketplace owner wallet can create matches. Connected: ${connectedLabel}. Owner: ${ownerLabel}.`, "error");
      return;
    }

    const slug = formState.slug.trim();
    const title = formState.title.trim();
    const description = formState.description.trim();
    const teamAFlagUri = formState.teamAFlagUri.trim();
    const teamBFlagUri = formState.teamBFlagUri.trim();
    const options = [formState.teamA.trim(), formState.teamB.trim()].filter(Boolean);
    const opensAt = toUnixTimestamp(formState.opensAt);
    const closesAt = toUnixTimestamp(formState.closesAt);
    const metadataUri = createMetadataUri({
      title,
      description,
      image: teamAFlagUri || teamBFlagUri,
      teamBImage: teamBFlagUri,
      drawMintAmount: formState.drawEntryPrice.trim(),
    });
    const entryPrice = parseEther(formState.entryPrice || "0");
    const rewardAmount = parseEther(formState.rewardAmount || "0");

    if (!slug || !title || !description || !teamAFlagUri || !teamBFlagUri || options.length < 2 || !metadataUri) {
      showAlert("Fill in slug, title, description, both teams, and both flag images before creating the match.", "error");
      return;
    }

    if (existingSlugs.has(slug.toLowerCase())) {
      showAlert(`A match with slug \"${slug}\" already exists onchain. Use a unique slug.`, "error");
      return;
    }

    if (entryPrice <= 0n || rewardAmount <= 0n) {
      showAlert("Entry price and reward amount must be greater than zero.", "error");
      return;
    }

    if (opensAt === 0n || closesAt === 0n || closesAt <= opensAt) {
      showAlert("Set a valid open and close window for the match.", "error");
      return;
    }

    try {
      console.log("[AdminMatchCreator] createMatch payload", {
        marketplaceAddress,
        slug,
        title,
        description,
        teamAFlagUri,
        teamBFlagUri,
        rewardAssetSymbol: "COR",
        metadataUri,
        options,
        entryPrice: entryPrice.toString(),
        rewardAmount: rewardAmount.toString(),
        opensAt: opensAt.toString(),
        closesAt: closesAt.toString(),
        openImmediately: formState.openImmediately,
        nowInSeconds: Math.floor(Date.now() / 1000).toString(),
      });

      await writeContractAsync({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "createMatch",
        args: [
          slug,
          title,
          description,
          teamAFlagUri,
          "COR",
          metadataUri,
          options,
          entryPrice,
          rewardAmount,
          opensAt,
          closesAt,
          formState.openImmediately,
        ],
      });

      showAlert(`Admin match \"${title}\" submitted onchain.`, "success");
    } catch (error) {
      console.error("[AdminMatchCreator] createMatch failed", error);
      const message = formatError(error);
      showAlert(
        message.includes("DuplicateSlug")
          ? `A match with slug \"${slug}\" already exists onchain. Use a unique slug.`
          : message,
        "error",
      );
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[#1d291f] bg-[#050705] px-4 py-4 text-[#f5f5ef] shadow-[0_0_0_1px_rgba(34,197,94,0.03),0_30px_80px_rgba(0,0,0,0.45)] sm:px-6 sm:py-6 xl:px-8 xl:py-8">
      <div suppressHydrationWarning className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.08),transparent_28%)]" />
      <div suppressHydrationWarning className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:60px_60px]" />

      <div className="relative space-y-8">
        <div className="rounded-[24px] border border-[#263126] bg-[linear-gradient(180deg,rgba(8,10,8,0.95),rgba(5,6,5,0.98))] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-6 sm:py-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#2d3c2f] bg-[#111713] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#dbe4d8]">
            <span className="size-2 rounded-full bg-[#61f58f]" />
            New Feature Match
          </div>
        </div>

        {!isMarketplaceConfigured ? (
          <div className="rounded-[24px] border border-[#57451b] bg-[linear-gradient(180deg,#161206_0%,#0d0b05_100%)] p-6 text-sm text-[#f0efe6]">
            Set NEXT_PUBLIC_XLAYER_MARKETPLACE_ADDRESS to enable admin match creation.
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,400px)] xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,420px)]">
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="rounded-[24px] border border-[#1f2c20] bg-[linear-gradient(180deg,#151816_0%,#0f1310_100%)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] sm:p-6"
          >
            <div className="space-y-5">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8f9b8e]">Match slug</span>
                <input
                  value={formState.slug}
                  onChange={(event) => setFormState((current) => ({ ...current, slug: event.target.value }))}
                  className="rounded-2xl border border-[#243225] bg-[#0c120d] px-4 py-3 text-sm text-[#f2f5ef] outline-none transition focus:border-[#61f58f]"
                  placeholder="germany-vs-spain"
                />
                {existingSlugs.has(formState.slug.trim().toLowerCase()) ? (
                  <span className="text-xs text-[#f0ca6a]">This slug already exists onchain. Choose a unique slug before submitting.</span>
                ) : null}
              </label>

              <div className="rounded-[22px] border border-[#243225] bg-[#0b100c] p-4 sm:p-5">
                <div className="flex flex-col gap-4 border-b border-[#1f2c20] pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8f9b8e]">Feature match</div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        value={formState.teamA}
                        onChange={(event) =>
                          setFormState((current) => {
                            const teamA = event.target.value;
                            return {
                              ...current,
                              teamA,
                              title: syncTitleFromTeams(teamA, current.teamB, current.title),
                            };
                          })
                        }
                        className="min-w-[7rem] flex-1 rounded-2xl border border-[#243225] bg-[#0c120d] px-4 py-2.5 text-base font-semibold text-[#f1f1ea] outline-none transition focus:border-[#61f58f]"
                        placeholder="Team A"
                      />
                      <span className="shrink-0 text-sm font-semibold uppercase tracking-[0.16em] text-[#61f58f]">vs</span>
                      <input
                        value={formState.teamB}
                        onChange={(event) =>
                          setFormState((current) => {
                            const teamB = event.target.value;
                            return {
                              ...current,
                              teamB,
                              title: syncTitleFromTeams(current.teamA, teamB, current.title),
                            };
                          })
                        }
                        className="min-w-[7rem] flex-1 rounded-2xl border border-[#243225] bg-[#0c120d] px-4 py-2.5 text-base font-semibold text-[#f1f1ea] outline-none transition focus:border-[#61f58f]"
                        placeholder="Team B"
                      />
                    </div>
                  </div>
                  <div className="shrink-0 rounded-full border border-[#2a372c] bg-[#111713] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[#cbd3c8]">
                    New Feature Match
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 rounded-2xl border border-[#1f2c20] bg-[#101512] p-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8f9b8e]">Team A flag</span>
                    <input
                      value={formState.teamAFlagUri}
                      onChange={(event) => setFormState((current) => ({ ...current, teamAFlagUri: event.target.value }))}
                      className="rounded-2xl border border-[#243225] bg-[#0c120d] px-4 py-3 text-sm text-[#f2f5ef] outline-none transition focus:border-[#61f58f]"
                      placeholder="https://..."
                    />
                  </label>

                  <label className="grid gap-2 rounded-2xl border border-[#1f2c20] bg-[#101512] p-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8f9b8e]">Team B flag</span>
                    <input
                      value={formState.teamBFlagUri}
                      onChange={(event) => setFormState((current) => ({ ...current, teamBFlagUri: event.target.value }))}
                      className="rounded-2xl border border-[#243225] bg-[#0c120d] px-4 py-3 text-sm text-[#f2f5ef] outline-none transition focus:border-[#61f58f]"
                      placeholder="https://..."
                    />
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="grid gap-2 rounded-2xl border border-[#1f2c20] bg-[#101512] p-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8f9b8e]">Onchain entry price</span>
                    <input
                      value={formState.entryPrice}
                      onChange={(event) => setFormState((current) => ({ ...current, entryPrice: event.target.value }))}
                      className="rounded-2xl border border-[#243225] bg-[#0c120d] px-4 py-3 text-sm text-[#f2f5ef] outline-none transition focus:border-[#61f58f]"
                      placeholder="10"
                    />
                  </label>

                  <label className="grid gap-2 rounded-2xl border border-[#1f2c20] bg-[#101512] p-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8f9b8e]">Onchain reward amount</span>
                    <input
                      value={formState.rewardAmount}
                      onChange={(event) => setFormState((current) => ({ ...current, rewardAmount: event.target.value }))}
                      className="rounded-2xl border border-[#243225] bg-[#0c120d] px-4 py-3 text-sm text-[#f2f5ef] outline-none transition focus:border-[#61f58f]"
                      placeholder="10"
                    />
                  </label>

                  <label className="grid gap-2 rounded-2xl border border-[#1f2c20] bg-[#101512] p-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8f9b8e]">Draw display amount</span>
                    <input
                      value={formState.drawEntryPrice}
                      onChange={(event) => setFormState((current) => ({ ...current, drawEntryPrice: event.target.value }))}
                      className="rounded-2xl border border-[#243225] bg-[#0c120d] px-4 py-3 text-sm text-[#f2f5ef] outline-none transition focus:border-[#61f58f]"
                      placeholder="2"
                    />
                  </label>
                </div>

              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8f9b8e]">Match title</span>
                  <input
                    value={formState.title}
                    onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                    className="rounded-2xl border border-[#243225] bg-[#0c120d] px-4 py-3 text-sm text-[#f2f5ef] outline-none transition focus:border-[#61f58f]"
                    placeholder="Germany vs Spain"
                  />
                </label>

                <div className="grid gap-4">
                  <div className="rounded-2xl border border-[#243225] bg-[#0c120d] px-4 py-4 text-sm leading-6 text-[#b9c4b8]">
                    <div className="font-semibold text-[#f1f1ea]">Contract-safe metadata preview</div>
                    <p className="mt-2">
                      The onchain match uses one real entry price, one real reward amount, and one primary image URI.
                      Team B flag and draw amount remain display metadata for the preview and NFT market.
                    </p>
                  </div>
                </div>

                <label className="grid gap-2 md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8f9b8e]">Description</span>
                  <textarea
                    value={formState.description}
                    onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
                    className="min-h-28 rounded-2xl border border-[#243225] bg-[#0c120d] px-4 py-3 text-sm text-[#f2f5ef] outline-none transition focus:border-[#61f58f]"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8f9b8e]">Opens at</span>
                  <input
                    type="datetime-local"
                    value={formState.opensAt}
                    onChange={(event) => setFormState((current) => ({ ...current, opensAt: event.target.value }))}
                    className="rounded-2xl border border-[#243225] bg-[#0c120d] px-4 py-3 text-sm text-[#f2f5ef] outline-none transition focus:border-[#61f58f]"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8f9b8e]">Closes at</span>
                  <input
                    type="datetime-local"
                    value={formState.closesAt}
                    onChange={(event) => setFormState((current) => ({ ...current, closesAt: event.target.value }))}
                    className="rounded-2xl border border-[#243225] bg-[#0c120d] px-4 py-3 text-sm text-[#f2f5ef] outline-none transition focus:border-[#61f58f]"
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-[#243225] bg-[#0c120d] px-4 py-4 text-sm text-[#dce4dc]">
                <input
                  type="checkbox"
                  checked={formState.openImmediately}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, openImmediately: event.target.checked }))
                  }
                  className="size-4 rounded border-[#35513b] bg-[#0a120c] text-[#61f58f]"
                />
                Open this match immediately after creation
              </label>

              <div className="flex flex-col gap-4 border-t border-[#1f2c20] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-[#a9b4a8]">
                  {isAdmin
                    ? `Admin wallet verified. Connected: ${connectedAddress || "unknown"}. Owner: ${effectiveOwnerAddress || "unknown"}.`
                    : `Connect the marketplace owner wallet to submit matches. Connected: ${connectedAddress || "not connected"}. Owner: ${effectiveOwnerAddress || "unavailable"}.`}
                </div>

                <Button type="submit" isLoading={isPending} loadingText="Submitting match...">
                  Create onchain match
                </Button>
              </div>
            </div>
          </form>

          <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <MatchPredictionPreview
            teamA={formState.teamA.trim() || "Team A"}
            teamB={formState.teamB.trim() || "Team B"}
            teamAFlagUri={formState.teamAFlagUri}
            teamBFlagUri={formState.teamBFlagUri}
            mintSlots={[
              { id: "team-a", label: "Entry price", amount: formState.entryPrice || "0" },
              { id: "draw", label: "Draw display", amount: formState.drawEntryPrice || "0" },
              { id: "team-b", label: "Reward amount", amount: formState.rewardAmount || "0" },
            ] satisfies MintSlot[]}
            showMetadata
            metadataUri={preview.metadataUri}
          />
          </div>
        </div>
      </div>
    </section>
  );
}
