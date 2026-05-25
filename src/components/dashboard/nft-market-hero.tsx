"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { getContractsForChain, hasConfiguredAddress } from "@/lib/contracts";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const XLAYER_TESTNET_CHAIN_ID = 1952;

const soulboundAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "payable",
    inputs: [],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
] as const;

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

export function NFTMarketHero() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [isMintingBadge, setIsMintingBadge] = useState(false);

  const activeContracts = getContractsForChain(XLAYER_TESTNET_CHAIN_ID);
  const soulboundAddress =
    (activeContracts.soulboundAddress && hasConfiguredAddress(activeContracts.soulboundAddress)
      ? activeContracts.soulboundAddress
      : undefined) ?? (process.env.NEXT_PUBLIC_XLAYER_SOULBOUND_ADDRESS as `0x${string}` | undefined);

  const isSoulboundConfigured = Boolean(soulboundAddress && soulboundAddress !== ZERO_ADDRESS);
  const sectionTitle = "Admin Match NFTs";

  async function handleMintSoulbound() {
    if (!soulboundAddress || !address) {
      return;
    }

    setIsMintingBadge(true);

    try {
      await writeContractAsync({
        address: soulboundAddress,
        abi: soulboundAbi,
        functionName: "mint",
        args: [],
        value: parseEther("0.001"),
      });
    } finally {
      setIsMintingBadge(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[#1d291f] bg-[#050705] px-4 py-4 text-[#f5f5ef] shadow-[0_0_0_1px_rgba(34,197,94,0.03),0_30px_80px_rgba(0,0,0,0.45)] sm:px-6 sm:py-6 xl:px-8 xl:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.08),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:60px_60px]" />

      <div className="relative space-y-6">
        <div className="overflow-hidden rounded-[28px] border border-[#263126] bg-[linear-gradient(180deg,rgba(8,10,8,0.95),rgba(5,6,5,0.98))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-8">
          <div className="relative overflow-hidden rounded-[24px] border border-[#1e281f] bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_22%),radial-gradient(circle_at_70%_65%,rgba(255,255,255,0.08),transparent_24%),linear-gradient(180deg,#0a0b0a_0%,#060706_100%)] px-6 py-8 sm:px-9 sm:py-12">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_35%,rgba(255,255,255,0.12),transparent_24%),radial-gradient(circle_at_72%_65%,rgba(255,255,255,0.05),transparent_32%)]" />

            <div className="relative max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#5b4b1d] bg-[#201907] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#efc75e]">
                <span className="inline-flex size-4 items-center justify-center rounded-full border border-[#705b22] text-[10px]">
                  ◉
                </span>
                Admin-Created Match NFTs
              </div>

              <h2 className="mt-6 text-4xl font-semibold tracking-[-0.05em] text-[#f3f3ed] sm:text-5xl xl:text-[58px] xl:leading-[1.02]">
                The <span className="italic text-[#f0ca6a]">{sectionTitle}</span>
              </h2>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-[#c6c8c2] sm:text-lg sm:leading-8">
                Admin creates the match and flag artwork on /admin/matches, users mint one NFT per wallet by choosing
                the winner here on /nfts, admin resolves the result, winners claim COR rewards, and the live router
                remains available for COR or native OKB exits.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-[#57451b] bg-[linear-gradient(135deg,#191204_0%,#0d0b05_55%,#15231a_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-8">
          <div className="grid grid-cols-1 items-center gap-6 sm:gap-8 md:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[200px_minmax(0,1fr)_auto] lg:gap-8">
            <div className="rounded-[28px] border border-[#6d5520] bg-[radial-gradient(circle_at_top,rgba(255,241,184,0.24),transparent_38%),linear-gradient(180deg,#171106_0%,#090805_100%)] p-4">
              <TrophySoulboundArt />
            </div>

            <div>
              <div className="text-sm uppercase tracking-[0.12em] text-[#f1c95e]">Reward Redemption</div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#f1f1ea]">
                Claim your winning COR reward, then swap out to COR or OKB/native
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#c6c8c2]">
                The marketplace contract pays claimable COR rewards onchain and the live swap router still handles the
                actual exit leg.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleMintSoulbound()}
              disabled={!address || !isSoulboundConfigured || isPending || isMintingBadge}
              className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#f1c95e] px-6 py-4 text-sm font-semibold text-[#171208] transition disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
            >
              {isMintingBadge ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-[#171208]/25 border-t-[#171208]" />
                  Minting...
                </>
              ) : (
                "Mint Trophy Badge"
              )}
            </button>
          </div>

          {!isSoulboundConfigured ? (
            <p className="mt-4 text-sm text-[#f0ca6a]">
              Set NEXT_PUBLIC_XLAYER_SOULBOUND_ADDRESS to enable trophy badge minting.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
