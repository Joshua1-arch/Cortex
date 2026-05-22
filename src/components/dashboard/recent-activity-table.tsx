"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Clock3, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getContractsForChain, hasConfiguredAddress } from "@/lib/contracts";

type ActivityRow = {
  time: string;
  action: "BUY" | "SELL" | "SWAP";
  asset: string;
  price: string;
  unit: string;
  status: "success" | "error";
  href: string;
  hashLabel: string;
};

type OkLinkTransaction = {
  txId?: string;
  transactionHash?: string;
  hash?: string;
  from?: string;
  to?: string;
  txTime?: string;
  transactionTime?: string;
  timestamp?: string;
  amount?: string;
  value?: string;
  symbol?: string;
  state?: string;
  status?: string;
  txStatus?: string;
};

type OkLinkResponse = {
  code?: string;
  msg?: string;
  data?: Array<{
    transactionLists?: OkLinkTransaction[];
    transactionList?: OkLinkTransaction[];
  }>;
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
    data: activityRows = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["recent-activity", address],
    enabled: Boolean(address),
    queryFn: async () => {
      const response = await fetch(`/api/activity?address=${address}`);

      if (!response.ok) {
        throw new Error("Failed to fetch recent activity.");
      }

      const result = (await response.json()) as OkLinkResponse;
      const transactions = result.data?.flatMap(
        (entry) => entry.transactionLists ?? entry.transactionList ?? [],
      ) ?? [];

      return transactions.map((transaction) =>
        mapTransactionToActivityRow(transaction, swapRouterAddress),
      );
    },
  });

  const emptyStateMessage = useMemo(() => {
    if (!address) {
      return "Connect your wallet to view activity";
    }

    if (isLoading) {
      return null;
    }

    if (isError) {
      return error instanceof Error ? error.message : "Unable to load recent activity.";
    }

    if (activityRows.length === 0) {
      return "No recent activity found";
    }

    return null;
  }, [activityRows.length, address, error, isError, isLoading]);

  return (
    <section className="rounded-2xl border border-zinc-300 bg-white px-4 py-4 shadow-sm sm:px-6 sm:py-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Clock3 className="size-5 stroke-[2.1] text-zinc-950" />
          <h2 className="text-lg font-semibold tracking-[-0.03em] text-zinc-950 sm:text-xl">
            Recent Activity
          </h2>
        </div>
        <button type="button" className="text-left text-sm text-zinc-900 sm:text-right">
          Download CSV
        </button>
      </div>

      {emptyStateMessage ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-center text-sm text-zinc-600 sm:text-base">
          {emptyStateMessage}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-zinc-300">
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[110px_84px_1fr_160px_70px] bg-zinc-100 text-[12px] uppercase text-zinc-700 sm:grid-cols-[122px_84px_1fr_180px_70px] sm:text-[13px]">
                <div className="px-3 py-[7px] sm:px-4">Time</div>
                <div className="px-2 py-[7px]">Action</div>
                <div className="px-2 py-[7px]">Asset</div>
                <div className="px-2 py-[7px] text-right">Transaction</div>
                <div className="px-2 py-[7px] text-center">Status</div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center gap-3 px-4 py-10 text-sm text-zinc-600">
                  <Loader2 className="size-4 animate-spin" />
                  Loading recent activity...
                </div>
              ) : (
                activityRows.map((row) => (
                  <div
                    key={`${row.href}-${row.time}`}
                    className="grid grid-cols-[110px_84px_1fr_160px_70px] items-center border-t border-zinc-300 text-[13px] text-zinc-800 sm:grid-cols-[122px_84px_1fr_180px_70px] sm:text-sm"
                  >
                    <div className="px-3 py-[10px] font-mono tracking-[-0.02em] text-zinc-700 sm:px-4">
                      {row.time}
                    </div>
                    <div className="px-2 py-[10px]">
                      <span
                        className={`inline-flex rounded-[3px] px-[6px] py-[3px] text-[11px] font-semibold ${getActionClassName(
                          row.action,
                        )}`}
                      >
                        {row.action}
                      </span>
                    </div>
                    <div className="truncate px-2 py-[10px] font-semibold">{row.asset}</div>
                    <div className="px-2 py-[10px] text-right font-mono text-zinc-800">
                      <Link href={row.href} target="_blank" rel="noreferrer" className="hover:underline">
                        {row.hashLabel}
                      </Link>
                    </div>
                    <div className="flex justify-center px-2 py-[10px]">
                      {row.status === "success" ? <SuccessStatusIcon /> : <ErrorStatusIcon />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function mapTransactionToActivityRow(
  transaction: OkLinkTransaction,
  swapRouterAddress?: `0x${string}`,
): ActivityRow {
  const txHash = transaction.txId || transaction.transactionHash || transaction.hash || "unknown";
  const toAddress = transaction.to?.toLowerCase();
  const fromAddress = transaction.from?.toLowerCase();
  const routerAddress = swapRouterAddress?.toLowerCase();
  const normalizedStatus = (transaction.txStatus || transaction.status || transaction.state || "").toLowerCase();
  const timestamp = transaction.txTime || transaction.transactionTime || transaction.timestamp || "";
  const amount = transaction.amount || transaction.value || "--";
  const unit = transaction.symbol || "";
  const isSwapInteraction = Boolean(routerAddress) && (toAddress === routerAddress || fromAddress === routerAddress);

  return {
    time: formatTimestamp(timestamp),
    action: isSwapInteraction ? "SWAP" : detectAction(transaction),
    asset: isSwapInteraction ? "DEX Swap" : `${amount}${unit ? ` ${unit}` : ""}`,
    price: amount,
    unit,
    status: normalizedStatus.includes("success") || normalizedStatus === "1" ? "success" : "error",
    href: `https://www.oklink.com/xlayer-test/tx/${txHash}`,
    hashLabel: truncateHash(txHash),
  };
}

function detectAction(transaction: OkLinkTransaction): ActivityRow["action"] {
  const normalizedStatus = `${transaction.amount ?? transaction.value ?? ""}`;

  if (normalizedStatus.startsWith("-")) {
    return "SELL";
  }

  if (normalizedStatus.startsWith("+")) {
    return "BUY";
  }

  return "SWAP";
}

function formatTimestamp(value: string) {
  const parsedValue = Number(value);
  const date = Number.isFinite(parsedValue)
    ? new Date(value.length === 10 ? parsedValue * 1000 : parsedValue)
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function truncateHash(value: string) {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getActionClassName(action: ActivityRow["action"]) {
  if (action === "BUY") {
    return "bg-zinc-200 text-zinc-900";
  }

  if (action === "SELL") {
    return "bg-zinc-300 text-zinc-900";
  }

  return "bg-zinc-100 text-zinc-900";
}

function SuccessStatusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="#18181b"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

function ErrorStatusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="#3f3f46"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  );
}
