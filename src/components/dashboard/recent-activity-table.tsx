"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowUpRight, Clock3, Loader2, ShieldCheck, ShieldX, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getContractsForChain, hasConfiguredAddress } from "@/lib/contracts";

type ActivityCategory =
  | "swap"
  | "faucet"
  | "trophy"
  | "approval"
  | "prediction"
  | "claim"
  | "resolution"
  | "transfer"
  | "unknown";
type ActivityStatus = "success" | "error";

type NormalizedActivity = {
  hash: string;
  hashLabel: string;
  category: ActivityCategory;
  title: string;
  description: string;
  asset: string;
  amount: string;
  unit: string;
  status: ActivityStatus;
  timestamp: string;
  timeLabel: string;
  explorerUrl: string;
  proofLabel: string;
  methodLabel: string;
};

type ActivityResponse = {
  address: string;
  chainId: number;
  chainName: string;
  proofSource: string;
  totalTransactions: number;
  activity: NormalizedActivity[];
};

const XLAYER_TESTNET_CHAIN_ID = 1952;

export function RecentActivityTable() {
  const { address } = useAccount();
  const activeContracts = getContractsForChain(XLAYER_TESTNET_CHAIN_ID);
  const swapRouterAddress =
    (activeContracts.swapRouterAddress && hasConfiguredAddress(activeContracts.swapRouterAddress)
      ? activeContracts.swapRouterAddress
      : undefined) ?? (process.env.NEXT_PUBLIC_XLAYER_SWAP_ROUTER_ADDRESS as `0x${string}` | undefined);

  const {
    data: activityResponse,
    isLoading,
    isError,
    error,
  } = useQuery<ActivityResponse>({
    queryKey: ["recent-activity", address],
    enabled: Boolean(address),
    queryFn: async () => {
      const response = await fetch(`/api/activity?address=${address}`);

      if (!response.ok) {
        throw new Error("Failed to fetch recent activity.");
      }

      return (await response.json()) as ActivityResponse;
    },
  });

  const activityRows = activityResponse?.activity ?? [];

  const emptyStateMessage = useMemo(() => {
    if (!address) {
      return "Connect your wallet to view proof of activity.";
    }

    if (isLoading) {
      return null;
    }

    if (isError) {
      return error instanceof Error ? error.message : "Unable to load recent activity.";
    }

    if (activityRows.length === 0) {
      return "No recent activity found.";
    }

    return null;
  }, [activityRows.length, address, error, isError, isLoading]);

  return (
    <section className="rounded-[28px] border border-[#1d291f] bg-[linear-gradient(180deg,#161918_0%,#101211_100%)] px-4 py-4 text-[#eef2eb] shadow-[0_18px_60px_rgba(0,0,0,0.35)] sm:px-6 sm:py-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Clock3 className="size-5 stroke-[2.1] text-[#86f19e]" />
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#f4f8f1] sm:text-xl">
              Recent Activity
            </h2>
            <p className="text-xs text-[#8d9a8a]">Live proof from the connected wallet on X Layer.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#9cab97]">
          <Sparkles className="size-4 text-[#86f19e]" />
          {activityResponse?.proofSource ?? "Explorer proof"}
        </div>
      </div>

      {emptyStateMessage ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-[22px] border border-dashed border-[#2a372c] bg-[#0b100d] px-6 py-8 text-center text-sm text-[#9da89a] sm:text-base">
          {emptyStateMessage}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[22px] border border-[#223026] bg-[#0b100d]">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[130px_120px_1fr_180px_120px] border-b border-[#223026] bg-[#111713] text-[11px] uppercase tracking-[0.2em] text-[#8fa08b] sm:text-[12px]">
                <div className="px-4 py-3">Time</div>
                <div className="px-4 py-3">Type</div>
                <div className="px-4 py-3">Proof</div>
                <div className="px-4 py-3 text-right">Transaction</div>
                <div className="px-4 py-3 text-center">Status</div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center gap-3 px-4 py-10 text-sm text-[#98a694]">
                  <Loader2 className="size-4 animate-spin" />
                  Loading recent activity...
                </div>
              ) : (
                activityRows.map((row) => (
                  <div
                    key={`${row.hash}-${row.timestamp}`}
                    className="grid grid-cols-[130px_120px_1fr_180px_120px] items-center border-b border-[#1d291f] text-sm text-[#e7ece4] last:border-b-0"
                  >
                    <div className="px-4 py-4 font-mono text-xs text-[#91a190]">{row.timeLabel}</div>
                    <div className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getCategoryClassName(row.category)}`}>
                        {row.category}
                      </span>
                    </div>
                    <div className="px-4 py-4">
                      <div className="font-semibold text-[#f2f6ef]">{row.title}</div>
                      <div className="mt-1 text-xs leading-5 text-[#94a191]">{row.description}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#7f8b7b]">
                        <span className="rounded-full border border-[#223026] bg-[#0f1511] px-2 py-1">{row.asset}</span>
                        <span className="rounded-full border border-[#223026] bg-[#0f1511] px-2 py-1">{row.methodLabel}</span>
                        <span className="rounded-full border border-[#223026] bg-[#0f1511] px-2 py-1">{row.proofLabel}</span>
                      </div>
                    </div>
                    <div className="px-4 py-4 text-right font-mono text-xs text-[#dce3d7]">
                      <Link href={row.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white hover:underline">
                        {row.hashLabel}
                        <ArrowUpRight className="size-3.5" />
                      </Link>
                    </div>
                    <div className="flex justify-center px-4 py-4">
                      {row.status === "success" ? <SuccessStatusIcon /> : <ErrorStatusIcon />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#8d9a8a]">
        <span>{activityResponse ? `${activityResponse.totalTransactions} transactions indexed` : "Awaiting wallet connection"}</span>
        <span className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-[#86f19e]" />
          X Layer proof-backed activity surface
        </span>
      </div>
    </section>
  );
}

function getCategoryClassName(category: ActivityCategory) {
  if (category === "swap") {
    return "border border-[#274330] bg-[#102016] text-[#8ff0a5]";
  }

  if (category === "faucet") {
    return "border border-[#2b3c25] bg-[#151f11] text-[#c8f08f]";
  }

  if (category === "trophy") {
    return "border border-[#40381f] bg-[#1d190f] text-[#f2de86]";
  }

  if (category === "approval") {
    return "border border-[#22313a] bg-[#10171b] text-[#a0d7f6]";
  }

  if (category === "prediction") {
    return "border border-[#274330] bg-[#102016] text-[#8ff0a5]";
  }

  if (category === "claim") {
    return "border border-[#3d3520] bg-[#17130d] text-[#f2de86]";
  }

  if (category === "resolution") {
    return "border border-[#3a2222] bg-[#190f0f] text-[#ffb1b1]";
  }

  if (category === "transfer") {
    return "border border-[#2f2f2f] bg-[#151515] text-[#d5d5d5]";
  }

  return "border border-[#2c322d] bg-[#111513] text-[#c9d4c6]";
}

function SuccessStatusIcon() {
  return (
    <span className="inline-flex size-7 items-center justify-center rounded-full border border-[#24532d] bg-[#102015] text-[#8ff0a5]">
      <ShieldCheck className="size-4" />
    </span>
  );
}

function ErrorStatusIcon() {
  return (
    <span className="inline-flex size-7 items-center justify-center rounded-full border border-[#5a2b2b] bg-[#1e1111] text-[#ffb1b1]">
      <ShieldX className="size-4" />
    </span>
  );
}
