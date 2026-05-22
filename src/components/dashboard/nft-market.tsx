"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { parseEther } from "viem";
import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";

const marketCategories = ["Trending", "Recent", "Legend Series", "Stadium Pass"] as const;
const TOKEN_IDS = [1n, 2n, 3n] as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const NFT_COLLECTION_ADDRESS = process.env.NEXT_PUBLIC_XLAYER_NFT_COLLECTION_ADDRESS as
  | `0x${string}`
  | undefined;
const MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_XLAYER_MARKETPLACE_ADDRESS as
  | `0x${string}`
  | undefined;
const SOULBOUND_ADDRESS = process.env.NEXT_PUBLIC_XLAYER_SOULBOUND_ADDRESS as
  | `0x${string}`
  | undefined;

const erc721MetadataAbi = [
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const marketplaceAbi = [
  {
    type: "function",
    name: "listItem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" },
    ],
    outputs: [],
  },
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
  {
    type: "function",
    name: "getListing",
    stateMutability: "view",
    inputs: [
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "seller", type: "address" },
          { name: "price", type: "uint256" },
        ],
      },
    ],
  },
] as const;

const soulboundAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "payable",
    inputs: [],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
] as const;

type ResolvedMetadata = {
  image: string;
  name: string;
  description: string;
};

type GalleryCard = {
  id: string;
  tokenId: bigint;
  owner: string;
  image: string;
  title: string;
  description: string;
  listedPrice: bigint;
};

type TxState = {
  tokenId: bigint | null;
  action: "approve" | "list" | "buy" | "mint" | null;
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
      name: "Unnamed NFT",
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

  return {
    image: metadata?.image ? ipfsToHttp(metadata.image) : "",
    name: metadata?.name?.trim() || "Unnamed NFT",
    description: metadata?.description?.trim() || "No description provided.",
  };
}

function formatOwner(address: string) {
  if (!address || address === ZERO_ADDRESS) {
    return "Unowned";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatPrice(price: bigint) {
  if (price === 0n) {
    return "Unlisted";
  }

  return `${price.toString()} wei`;
}

function formatError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Transaction failed. Please try again.";
}

function NFTCardSkeleton() {
  return (
    <article className="rounded-[24px] border border-[#242926] bg-[#141518] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="overflow-hidden rounded-[18px] border border-[#23282a] bg-[#0a0e0b] p-3">
        <div className="h-[230px] animate-pulse rounded-[14px] bg-[#1b211d]" />
      </div>
      <div className="space-y-4 px-1 pb-1 pt-4">
        <div className="h-6 w-2/3 animate-pulse rounded bg-[#1b211d]" />
        <div className="h-4 w-full animate-pulse rounded bg-[#171c18]" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-[#171c18]" />
        <div className="h-12 w-full animate-pulse rounded-2xl bg-[#202823]" />
      </div>
    </article>
  );
}

function SoulboundBannerSkeleton() {
  return <div className="h-[220px] animate-pulse rounded-[28px] border border-[#2c3a2f] bg-[#121814]" />;
}

function TrophySoulboundArt() {
  return (
    <div className="relative mx-auto flex h-[168px] w-[132px] items-end justify-center">
      <div className="absolute top-1 h-28 w-20 rounded-full bg-[#f4d06f]/30 blur-2xl" />
      <div className="absolute bottom-3 h-10 w-24 rounded-full bg-[#e7b84d]/30 blur-xl" />
      <div className="relative mb-4 flex flex-col items-center">
        <div className="relative h-[120px] w-[78px] bg-[linear-gradient(180deg,#fff1b8_0%,#f0c75f_28%,#a56a14_66%,#5a3305_100%)] [clip-path:polygon(50%_0%,68%_12%,78%_34%,86%_62%,68%_100%,32%_100%,14%_62%,22%_34%,32%_12%)] shadow-[inset_-10px_-14px_18px_rgba(0,0,0,0.22),inset_8px_8px_16px_rgba(255,255,255,0.24),0_20px_26px_rgba(0,0,0,0.35)]">
          <div className="absolute inset-x-[22px] top-[10px] h-[54px] rounded-full border border-white/25" />
          <div className="absolute left-[10px] top-[30px] h-[34px] w-[12px] rounded-full border border-[#f4d06f]/60" />
          <div className="absolute right-[10px] top-[30px] h-[34px] w-[12px] rounded-full border border-[#f4d06f]/60" />
        </div>
        <div className="-mt-1 h-5 w-6 rounded-b-xl bg-[#6c4310]" />
        <div className="h-4 w-12 rounded-md bg-[linear-gradient(180deg,#d8ae4c,#68410f)]" />
        <div className="mt-1 h-3 w-20 rounded-md bg-[linear-gradient(180deg,#8b5b19,#2f1c05)]" />
      </div>
    </div>
  );
}

export function NFTMarket() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const collectionAddress = NFT_COLLECTION_ADDRESS;
  const marketplaceAddress = MARKETPLACE_ADDRESS;
  const soulboundAddress = SOULBOUND_ADDRESS;
  const isCollectionConfigured = Boolean(collectionAddress && collectionAddress !== ZERO_ADDRESS);
  const isMarketplaceConfigured = Boolean(marketplaceAddress && marketplaceAddress !== ZERO_ADDRESS);
  const isSoulboundConfigured = Boolean(soulboundAddress && soulboundAddress !== ZERO_ADDRESS);
  const [txState, setTxState] = useState<TxState>({ tokenId: null, action: null });
  const [cards, setCards] = useState<GalleryCard[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"error" | "success" | null>(null);

  const { data: collectionName, isLoading: isCollectionNameLoading } = useReadContract({
    address: isCollectionConfigured ? collectionAddress : undefined,
    abi: [
      {
        type: "function",
        name: "name",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
      },
    ],
    functionName: "name",
    query: { enabled: isCollectionConfigured },
  });

  const tokenUriContracts = useMemo(
    () =>
      isCollectionConfigured
        ? TOKEN_IDS.map((tokenId) => ({
            address: collectionAddress,
            abi: erc721MetadataAbi,
            functionName: "tokenURI" as const,
            args: [tokenId] as const,
          }))
        : [],
    [collectionAddress, isCollectionConfigured],
  );

  const ownerContracts = useMemo(
    () =>
      isCollectionConfigured
        ? TOKEN_IDS.map((tokenId) => ({
            address: collectionAddress,
            abi: erc721MetadataAbi,
            functionName: "ownerOf" as const,
            args: [tokenId] as const,
          }))
        : [],
    [collectionAddress, isCollectionConfigured],
  );

  const listingContracts = useMemo(
    () =>
      isCollectionConfigured && isMarketplaceConfigured
        ? TOKEN_IDS.map((tokenId) => ({
            address: marketplaceAddress,
            abi: marketplaceAbi,
            functionName: "getListing" as const,
            args: [collectionAddress, tokenId] as const,
          }))
        : [],
    [collectionAddress, isCollectionConfigured, isMarketplaceConfigured, marketplaceAddress],
  );

  const { data: tokenUriResults, isLoading: isTokenUrisLoading, isFetching: isTokenUrisFetching } =
    useReadContracts({
      contracts: tokenUriContracts,
      query: { enabled: tokenUriContracts.length > 0 },
    });

  const { data: ownerResults, isLoading: isOwnersLoading, isFetching: isOwnersFetching } =
    useReadContracts({
      contracts: ownerContracts,
      query: { enabled: ownerContracts.length > 0 },
    });

  const { data: listingResults, isLoading: isListingsLoading, isFetching: isListingsFetching } =
    useReadContracts({
      contracts: listingContracts,
      query: { enabled: listingContracts.length > 0 },
    });

  const tokenUris = useMemo(
    () =>
      (tokenUriResults ?? []).map((result) =>
        result.status === "success" && typeof result.result === "string" ? result.result : "",
      ),
    [tokenUriResults],
  );

  const owners = useMemo(
    () =>
      (ownerResults ?? []).map((result) =>
        result.status === "success" && typeof result.result === "string" ? result.result : ZERO_ADDRESS,
      ),
    [ownerResults],
  );

  const listedPrices = useMemo(
    () =>
      (listingResults ?? []).map((result) => {
        if (result.status !== "success") {
          return 0n;
        }

        const listing = result.result;
        if (!listing || typeof listing !== "object" || !("price" in listing)) {
          return 0n;
        }

        return typeof listing.price === "bigint" ? listing.price : 0n;
      }),
    [listingResults],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadMetadata() {
      if (!tokenUris.length || tokenUris.some((uri) => !uri)) {
        setCards([]);
        return;
      }

      setMetadataLoading(true);

      try {
        const resolvedMetadata = await Promise.all(tokenUris.map((uri) => resolveTokenMetadata(uri)));

        if (cancelled) {
          return;
        }

        setCards(
          resolvedMetadata.map((metadata, index) => ({
            id: `token-${TOKEN_IDS[index].toString()}`,
            tokenId: TOKEN_IDS[index],
            owner: owners[index] ?? ZERO_ADDRESS,
            image: metadata.image,
            title: metadata.name,
            description: metadata.description,
            listedPrice: listedPrices[index] ?? 0n,
          })),
        );
      } catch {
        if (!cancelled) {
          setCards(
            TOKEN_IDS.map((tokenId, index) => ({
              id: `token-${tokenId.toString()}`,
              tokenId,
              owner: owners[index] ?? ZERO_ADDRESS,
              image: "",
              title: `NFT #${tokenId.toString()}`,
              description: "Metadata unavailable.",
              listedPrice: listedPrices[index] ?? 0n,
            })),
          );
        }
      } finally {
        if (!cancelled) {
          setMetadataLoading(false);
        }
      }
    }

    void loadMetadata();

    return () => {
      cancelled = true;
    };
  }, [listedPrices, owners, tokenUris]);

  const isLoading =
    !isCollectionConfigured ||
    isCollectionNameLoading ||
    isTokenUrisLoading ||
    isTokenUrisFetching ||
    isOwnersLoading ||
    isOwnersFetching ||
    isListingsLoading ||
    isListingsFetching ||
    metadataLoading;

  const sectionTitle = collectionName || "World Cup Collection";
  const connectedAddress = address?.toLowerCase() ?? "";

  async function handleListForSale(tokenId: bigint) {
    if (!collectionAddress || !marketplaceAddress || !address) {
      setFeedbackTone("error");
      setFeedbackMessage("Connect your wallet and configure the marketplace before listing.");
      return;
    }

    const priceInput = window.prompt("Enter listing price in wei");
    if (!priceInput) {
      return;
    }

    try {
      const price = BigInt(priceInput);
      setFeedbackMessage(null);
      setFeedbackTone(null);
      setTxState({ tokenId, action: "approve" });

      await writeContractAsync({
        address: collectionAddress,
        abi: erc721MetadataAbi,
        functionName: "approve",
        args: [marketplaceAddress, tokenId],
      });

      setTxState({ tokenId, action: "list" });

      await writeContractAsync({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "listItem",
        args: [collectionAddress, tokenId, price],
      });

      setFeedbackTone("success");
      setFeedbackMessage(`Token #${tokenId.toString()} listed successfully.`);
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(formatError(error));
    } finally {
      setTxState({ tokenId: null, action: null });
    }
  }

  async function handleBuy(tokenId: bigint) {
    if (!collectionAddress || !marketplaceAddress) {
      setFeedbackTone("error");
      setFeedbackMessage("Configure the marketplace before buying NFTs.");
      return;
    }

    const listing = cards.find((item) => item.tokenId === tokenId);

    if (!listing || listing.listedPrice === 0n) {
      setFeedbackTone("error");
      setFeedbackMessage("This NFT is not currently listed for sale.");
      return;
    }

    try {
      setFeedbackMessage(null);
      setFeedbackTone(null);
      setTxState({ tokenId, action: "buy" });

      await writeContractAsync({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: "buyItem",
        args: [collectionAddress, tokenId],
      });

      setFeedbackTone("success");
      setFeedbackMessage(`Purchase submitted for token #${tokenId.toString()}.`);
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(formatError(error));
    } finally {
      setTxState({ tokenId: null, action: null });
    }
  }

  async function handleMintSoulbound() {
    if (!soulboundAddress || !address) {
      setFeedbackTone("error");
      setFeedbackMessage("Connect your wallet before minting the OG badge.");
      return;
    }

    setFeedbackMessage(null);
    setFeedbackTone(null);
    setTxState({ tokenId: null, action: "mint" });

    try {
      await writeContractAsync({
        address: soulboundAddress,
        abi: soulboundAbi,
        functionName: "mint",
        args: [],
        value: parseEther("0.001"),
      });

      setFeedbackTone("success");
      setFeedbackMessage("OG Soulbound trophy badge minted to your wallet.");
    } catch (error) {
      setFeedbackTone("error");
      setFeedbackMessage(formatError(error));
    } finally {
      setTxState({ tokenId: null, action: null });
    }
  }

  const isApproving = txState.action === "approve";
  const isListing = txState.action === "list";
  const isBuying = txState.action === "buy";
  const isMinting = txState.action === "mint";
  const txBusy = isPending || txState.action !== null;

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[#1d291f] bg-[#050705] px-4 py-4 text-[#f5f5ef] shadow-[0_0_0_1px_rgba(34,197,94,0.03),0_30px_80px_rgba(0,0,0,0.45)] sm:px-6 sm:py-6 xl:px-8 xl:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.08),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:60px_60px]" />

      <div className="relative space-y-10">
        <div className="overflow-hidden rounded-[28px] border border-[#263126] bg-[linear-gradient(180deg,rgba(8,10,8,0.95),rgba(5,6,5,0.98))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-8">
          <div className="relative overflow-hidden rounded-[24px] border border-[#1e281f] bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_22%),radial-gradient(circle_at_70%_65%,rgba(255,255,255,0.08),transparent_24%),linear-gradient(180deg,#0a0b0a_0%,#060706_100%)] px-6 py-8 sm:px-9 sm:py-12">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_35%,rgba(255,255,255,0.12),transparent_24%),radial-gradient(circle_at_72%_65%,rgba(255,255,255,0.05),transparent_32%)]" />
            <div className="pointer-events-none absolute right-[-10%] top-[-18%] h-[130%] w-[62%] rounded-full border border-white/10 opacity-50 blur-[1px]" />
            <div className="pointer-events-none absolute right-[-4%] top-[10%] h-[86%] w-[48%] rounded-full border border-white/10 opacity-40" />
            <div className="pointer-events-none absolute bottom-[-18%] right-[4%] h-[55%] w-[42%] rounded-full border border-white/10 opacity-25" />

            <div className="relative max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#5b4b1d] bg-[#201907] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#efc75e]">
                <span className="inline-flex size-4 items-center justify-center rounded-full border border-[#705b22] text-[10px]">
                  ◉
                </span>
                Exclusive Drop
              </div>

              <h2 className="mt-6 text-4xl font-semibold tracking-[-0.05em] text-[#f3f3ed] sm:text-5xl xl:text-[58px] xl:leading-[1.02]">
                The <span className="italic text-[#f0ca6a]">{sectionTitle}</span>
              </h2>

              <p className="mt-5 max-w-xl text-sm leading-7 text-[#c6c8c2] sm:text-lg sm:leading-8">
                Own the most legendary moments in football history. Live metadata and ownership are
                pulled directly from your X Layer NFT collection contract.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  className="rounded-2xl bg-[#4ff08d] px-7 py-4 text-sm font-semibold text-[#08110b] transition hover:brightness-105 sm:min-w-[176px]"
                >
                  View Collection
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-[#39ce76] bg-transparent px-7 py-4 text-sm font-semibold text-[#e8f8ee] transition hover:bg-[#0c160f] sm:min-w-[176px]"
                >
                  Learn More
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-[#57451b] bg-[linear-gradient(135deg,#191204_0%,#0d0b05_55%,#15231a_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-8">
          {isLoading ? (
            <SoulboundBannerSkeleton />
          ) : (
            <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-center">
              <div className="rounded-[28px] border border-[#6d5520] bg-[radial-gradient(circle_at_top,rgba(255,241,184,0.24),transparent_38%),linear-gradient(180deg,#171106_0%,#090805_100%)] p-4">
                <TrophySoulboundArt />
              </div>

              <div>
                <div className="text-sm uppercase tracking-[0.12em] text-[#f1c95e]">OG Soulbound Trophy</div>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#f1f1ea]">
                  Claim the World Cup founder trophy badge
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[#c6c8c2]">
                  Mint the production soulbound trophy directly to your connected wallet.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleMintSoulbound()}
                disabled={!address || !isSoulboundConfigured || txBusy}
                className="inline-flex items-center justify-center gap-3 rounded-2xl bg-[#f1c95e] px-6 py-4 text-sm font-semibold text-[#171208] transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isMinting ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-[#171208]/25 border-t-[#171208]" />
                    Minting...
                  </>
                ) : (
                  "Mint Trophy Badge"
                )}
              </button>
            </div>
          )}
        </div>

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
            {marketCategories.map((category, index) => {
              const isActive = index === 0;

              return (
                <button
                  key={category}
                  type="button"
                  className={`rounded-full px-5 py-3 transition ${
                    isActive
                      ? "border border-[#1f7b46] bg-[#0d2a18] text-[#61f5a1] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                      : "text-[#c6c8c2] hover:text-white"
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-between gap-3 rounded-2xl border border-[#283127] bg-[#151c15] px-5 py-3 font-mono text-sm text-[#d8dad4] lg:min-w-[190px]"
          >
            <span>Live on X Layer</span>
            <span className="text-[#9fa39b]">⌄</span>
          </button>
        </div>

        {!isCollectionConfigured ? (
          <div className="rounded-[24px] border border-[#57451b] bg-[linear-gradient(180deg,#161206_0%,#0d0b05_100%)] p-6 text-sm text-[#f0efe6]">
            Set NEXT_PUBLIC_XLAYER_NFT_COLLECTION_ADDRESS to load the deployed NFT collection.
          </div>
        ) : null}

        {!isMarketplaceConfigured ? (
          <div className="rounded-[24px] border border-[#57451b] bg-[linear-gradient(180deg,#161206_0%,#0d0b05_100%)] p-6 text-sm text-[#f0efe6]">
            Set NEXT_PUBLIC_XLAYER_MARKETPLACE_ADDRESS to enable list and buy actions.
          </div>
        ) : null}

        {!isSoulboundConfigured ? (
          <div className="rounded-[24px] border border-[#57451b] bg-[linear-gradient(180deg,#161206_0%,#0d0b05_100%)] p-6 text-sm text-[#f0efe6]">
            Set NEXT_PUBLIC_XLAYER_SOULBOUND_ADDRESS to enable trophy badge minting.
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {isLoading
            ? TOKEN_IDS.map((tokenId) => <NFTCardSkeleton key={tokenId.toString()} />)
            : cards.map((card) => {
                const isOwnedByConnectedWallet = card.owner.toLowerCase() === connectedAddress;
                const isCardBusy = txBusy && txState.tokenId === card.tokenId;

                return (
                  <article
                    key={card.id}
                    className="rounded-[24px] border border-[#242926] bg-[#141518] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                  >
                    <div className="relative overflow-hidden rounded-[18px] border border-[#23282a] bg-[#0a0e0b] p-3">
                      <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-[#f0f0e6] backdrop-blur-sm">
                        <span className="size-2 rounded-full bg-[#35f391]" />
                        <span>{`Token #${card.tokenId.toString()}`}</span>
                      </div>

                      <div className="relative flex h-[230px] items-center justify-center overflow-hidden rounded-[14px] bg-[radial-gradient(circle_at_top,rgba(87,255,146,0.12),transparent_35%),linear-gradient(180deg,#0e1110_0%,#060807_100%)]">
                        {card.image ? (
                          <Image
                            src={card.image}
                            alt={card.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm text-[#9fa39b]">
                            Image unavailable
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="px-1 pb-1 pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-[22px] font-medium tracking-[-0.04em] text-[#f1f1ea]">
                          {card.title}
                        </h3>
                        <div className="whitespace-nowrap rounded-full border border-[#1f7b46] bg-[#0d2a18] px-3 py-1 font-mono text-xs text-[#57f49b]">
                          Live
                        </div>
                      </div>

                      <p className="mt-4 min-h-12 text-sm leading-7 text-[#c6c8c2]">
                        {card.description}
                      </p>

                      <div className="mt-4 flex gap-8 text-sm text-[#c6c8c2]">
                        <div>
                          <div className="mb-1">Owner</div>
                          <div className="font-mono text-base text-[#e8e8de]">{formatOwner(card.owner)}</div>
                        </div>
                        <div>
                          <div className="mb-1">Token ID</div>
                          <div className="font-mono text-base text-[#e8e8de]">#{card.tokenId.toString()}</div>
                        </div>
                      </div>

                      {isOwnedByConnectedWallet ? (
                        <button
                          type="button"
                          onClick={() => void handleListForSale(card.tokenId)}
                          disabled={!isMarketplaceConfigured || txBusy}
                          className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl border border-[#334032] bg-[#263126] px-4 py-4 text-base font-semibold text-[#edf5ed] transition hover:bg-[#2d3a2d] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isCardBusy && (isApproving || isListing) ? (
                            <>
                              <span className="size-4 animate-spin rounded-full border-2 border-[#edf5ed]/25 border-t-[#edf5ed]" />
                              {isApproving ? "Approving..." : "Listing..."}
                            </>
                          ) : (
                            "List for Sale"
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleBuy(card.tokenId)}
                          disabled={!isMarketplaceConfigured || txBusy || card.listedPrice === 0n}
                          className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl border border-[#334032] bg-[#263126] px-4 py-4 text-base font-semibold text-[#edf5ed] transition hover:bg-[#2d3a2d] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBuying && isCardBusy ? (
                            <>
                              <span className="size-4 animate-spin rounded-full border-2 border-[#edf5ed]/25 border-t-[#edf5ed]" />
                              Buying...
                            </>
                          ) : (
                            `Buy${card.listedPrice > 0n ? ` (${formatPrice(card.listedPrice)})` : ""}`
                          )}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,0.9fr)]">
          <div className="rounded-[30px] border border-[#25292b] bg-[#151519] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-8">
            <div className="grid gap-8 md:grid-cols-[140px_minmax(0,1fr)] md:items-center">
              <div className="flex items-center justify-center">
                <div className="relative flex size-28 items-center justify-center rounded-full border border-dashed border-[#57f49b] bg-[#15231a] text-[#57f49b] shadow-[0_0_0_8px_rgba(87,244,155,0.05)]">
                  <div className="absolute inset-3 rounded-full border border-[#57f49b]/50" />
                  <span className="relative text-2xl">⚽</span>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.12em] text-[#57f49b]">
                  Market Insight by X-Agent
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#f1f1ea]">
                  Bullish Momentum Detected
                </h3>
                <p className="mt-4 max-w-2xl text-base leading-8 text-[#c6c8c2]">
                  Historical data suggests Legend Series NFTs appreciated by 24% in the 30 days
                  leading up to the Opening Ceremony. Current buy wall for Legendaries is
                  strengthening at 4.2 ETH.
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <div className="min-w-[140px] rounded-2xl bg-[#313a31] px-4 py-3 text-sm text-[#f1f1ea]">
                    <div className="font-mono text-[#d7ddd3]">Confidence:</div>
                    <div className="mt-1 text-xl">94%</div>
                  </div>
                  <div className="min-w-[140px] rounded-2xl bg-[#313a31] px-4 py-3 text-sm text-[#f1f1ea]">
                    <div className="font-mono text-[#d7ddd3]">Sentiment:</div>
                    <div className="mt-1 text-xl">High</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-[#57451b] bg-[linear-gradient(180deg,#161206_0%,#0d0b05_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-8">
            <div className="text-sm uppercase tracking-[0.12em] text-[#f1c95e]">Trending Now</div>

            <div className="mt-6 space-y-4 text-base text-[#f0efe6]">
              <div className="flex items-center justify-between gap-4">
                <span>Stadium Pass</span>
                <span className="font-mono text-[#57f49b]">+12.4%</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Goal Moments</span>
                <span className="font-mono text-[#57f49b]">+8.1%</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Jerseys</span>
                <span className="font-mono text-[#ff8d7d]">-2.4%</span>
              </div>
            </div>

            <button
              type="button"
              className="mt-8 w-full rounded-2xl bg-[#ebc75d] px-5 py-4 text-base font-semibold text-[#171208] transition hover:brightness-105"
            >
              View Heatmap
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
