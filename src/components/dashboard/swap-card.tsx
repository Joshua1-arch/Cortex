"use client";

import { Loader2, Wallet } from "lucide-react";
import { type ChangeEvent, useMemo, useState } from "react";
import { BaseError, formatEther, parseAbi, parseEther, type Hex } from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { getContractsForChain, hasConfiguredAddress } from "@/lib/contracts";

const SUPPORTED_CHAIN_IDS = new Set([1952, 11155111] as const);

const SWAP_ROUTER_ABI = parseAbi([
  "function swapNativeForExactTokens(uint256 amountOut) external payable",
]);

const APPROVE_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
]);

const SWAP_TOKENS_FOR_NATIVE_ABI = parseAbi([
  "function swapTokensForNative(uint256 amountIn) external",
  "error InsufficientNativeLiquidity()",
  "error TransferFailed()",
]);

function formatBalance(value?: bigint) {
  if (value === undefined) {
    return "0.0000";
  }

  return Number(formatEther(value)).toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof BaseError) {
    return error.shortMessage || error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown transaction error.";
}

export function SwapCard() {
  const [amountIn, setAmountIn] = useState("0.1");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"idle" | "success" | "error">("idle");
  const [submittedHash, setSubmittedHash] = useState<Hex | undefined>();
  const [isReverse, setIsReverse] = useState(false);
  const { address, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const isSupportedChain = chainId !== undefined && SUPPORTED_CHAIN_IDS.has(chainId as 1952 | 11155111);
  const activeChainId = isSupportedChain ? chainId : 1952;
  const activeContracts = getContractsForChain(activeChainId);
  const swapRouterAddress =
    (activeContracts.swapRouterAddress && hasConfiguredAddress(activeContracts.swapRouterAddress)
      ? activeContracts.swapRouterAddress
      : undefined)
    ?? (process.env.NEXT_PUBLIC_XLAYER_SWAP_ROUTER_ADDRESS as `0x${string}` | undefined);
  const quoteTokenAddress =
    (activeContracts.quoteTokenAddress && hasConfiguredAddress(activeContracts.quoteTokenAddress)
      ? activeContracts.quoteTokenAddress
      : undefined)
    ?? (process.env.NEXT_PUBLIC_XLAYER_QUOTE_TOKEN_ADDRESS as `0x${string}` | undefined);
  const isSwapConfigured = Boolean(swapRouterAddress) && Boolean(quoteTokenAddress);

  const {
    data: nativeBalance,
    refetch: refetchNativeBalance,
    isFetching: isFetchingNativeBalance,
  } = useBalance({
    address,
    chainId: activeChainId,
    query: {
      enabled: Boolean(address),
    },
  });

  const {
    data: quoteTokenBalance,
    refetch: refetchQuoteTokenBalance,
    isFetching: isFetchingQuoteTokenBalance,
  } = useBalance({
    address,
    chainId: activeChainId,
    token: quoteTokenAddress as `0x${string}`,
    query: {
      enabled: Boolean(address) && Boolean(quoteTokenAddress),
    },
  });

  const {
    isLoading: isReceiptPending,
    isSuccess: isReceiptSuccess,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: submittedHash,
  });

  const derivedStatus = useMemo(() => {
    if (!submittedHash) {
      return null;
    }

    if (isReceiptPending) {
      return {
        message: "Waiting for blockchain confirmation...",
        tone: "idle" as const,
      };
    }

    if (isReceiptSuccess) {
      return {
        message: "Transaction Confirmed Successfully!",
        tone: "success" as const,
      };
    }

    if (isReceiptError) {
      return {
        message: `Transaction Failed: ${getErrorMessage(receiptError)}`,
        tone: "error" as const,
      };
    }

    return null;
  }, [isReceiptError, isReceiptPending, isReceiptSuccess, receiptError, submittedHash]);

  const displayedStatusMessage = derivedStatus?.message ?? statusMessage;
  const displayedStatusTone = derivedStatus?.tone ?? statusTone;

  const amountOutPreview = useMemo(() => {
    if (amountIn.trim().length === 0) {
      return "0.0000";
    }

    return amountIn;
  }, [amountIn]);

  const statusClassName = useMemo(() => {
    if (displayedStatusTone === "success") {
      return "border-emerald-200 bg-emerald-50 text-emerald-600";
    }

    if (displayedStatusTone === "error") {
      return "border-rose-200 bg-rose-50 text-rose-600";
    }

    return "border-zinc-200 bg-zinc-100 text-zinc-600";
  }, [displayedStatusTone]);

  const isPending = isReceiptPending;
  const parsedAmountIn = useMemo(() => {
    try {
      return amountIn.trim().length > 0 ? parseEther(amountIn) : BigInt(0);
    } catch {
      return undefined;
    }
  }, [amountIn]);
  const hasInsufficientNativeBalance =
    parsedAmountIn !== undefined
    && nativeBalance?.value !== undefined
    && parsedAmountIn > nativeBalance.value;
  const isButtonDisabled =
    !address
    || !isSupportedChain
    || amountIn.trim().length === 0
    || parsedAmountIn === undefined
    || parsedAmountIn <= BigInt(0)
    || hasInsufficientNativeBalance
    || isPending;

  async function handleConfirmSwap() {
    if (!address) {
      setStatusMessage("Connect a wallet before swapping.");
      setStatusTone("error");
      return;
    }

    if (!isSupportedChain) {
      setStatusMessage("Please switch your wallet to X Layer Testnet or Sepolia.");
      setStatusTone("error");
      return;
    }

    if (!isSwapConfigured) {
      setStatusMessage("Swap router or quote token is not configured for this chain.");
      setStatusTone("error");
      return;
    }

    try {
      const parsedAmount = parseEther(amountIn);
      setSubmittedHash(undefined);
      setStatusMessage("Waiting for blockchain confirmation...");
      setStatusTone("idle");

      if (!isReverse) {
        const hash = await writeContractAsync({
          address: swapRouterAddress as `0x${string}`,
          abi: SWAP_ROUTER_ABI,
          functionName: "swapNativeForExactTokens",
          args: [parsedAmount],
          value: parsedAmount,
        });

        setSubmittedHash(hash);
      } else {
        const approvalHash = await writeContractAsync({
          address: quoteTokenAddress as `0x${string}`,
          abi: APPROVE_ABI,
          functionName: "approve",
          args: [swapRouterAddress as `0x${string}`, parsedAmount],
        });

        setSubmittedHash(approvalHash);
        await publicClient?.waitForTransactionReceipt({ hash: approvalHash });
        void refetchQuoteTokenBalance();

        const swapHash = await writeContractAsync({
          address: swapRouterAddress as `0x${string}`,
          abi: SWAP_TOKENS_FOR_NATIVE_ABI,
          functionName: "swapTokensForNative",
          args: [parsedAmount],
        });

        setSubmittedHash(swapHash);
        void refetchNativeBalance();
        void refetchQuoteTokenBalance();
      }
    } catch (error) {
      setStatusMessage(`Transaction Failed: ${getErrorMessage(error)}`);
      setStatusTone("error");
    }
  }

  function handleAmountChange(event: ChangeEvent<HTMLInputElement>) {
    setAmountIn(event.target.value);
  }

  return (
    <section className="rounded-[34px] border border-[#1f2c20] bg-[linear-gradient(180deg,#161918_0%,#101211_100%)] px-5 py-5 text-[#eef2eb] shadow-[0_18px_60px_rgba(0,0,0,0.45)] sm:px-7 sm:py-7">
      <div className="mb-7 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-[-0.04em] text-[#f3f6f0] sm:text-[30px]">
          Swap Tokens
        </h2>
        <button
          type="button"
          onClick={() => {
            void refetchNativeBalance();
            void refetchQuoteTokenBalance();
          }}
          className="rounded-2xl border border-[#243126] bg-[#111713] p-3 text-[#d8ddd5] transition hover:text-white"
        >
          <RefreshIcon />
        </button>
      </div>

      <div className="space-y-7">
        <div className="flex justify-center">
          <div className="inline-flex rounded-[22px] border border-[#1d281f] bg-[#152016] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <button
              type="button"
              className="rounded-[16px] bg-[#283728] px-8 py-3 text-sm font-semibold text-white"
            >
              TOKENS
            </button>
            <button
              type="button"
              className="rounded-[16px] px-8 py-3 text-sm font-semibold text-[#9ca59a]"
            >
              NFTs
            </button>
          </div>
        </div>

        <TokenCard
          label={isReverse ? "You Pay" : "You Pay"}
          amount={amountIn}
          balance={`Balance: ${formatBalance(isReverse ? quoteTokenBalance?.value : nativeBalance?.value)} ${isReverse ? "xUSDT" : "OKB"}`}
          token={isReverse ? "xUSDT" : "OKB"}
          tone="light"
          editable
          onAmountChange={handleAmountChange}
          isLoading={isReverse ? isFetchingQuoteTokenBalance : isFetchingNativeBalance}
        />

        <div className="relative flex justify-center">
          <button
            type="button"
            onClick={() => setIsReverse((current) => !current)}
            className="absolute -top-4 z-10 flex size-14 items-center justify-center rounded-[20px] border border-[#213124] bg-[#182119] text-[#5ff698] shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
          >
            <SwapArrowsIcon />
          </button>
        </div>

        <TokenCard
          label="You Receive"
          amount={amountOutPreview}
          balance={`Balance: ${formatBalance(isReverse ? nativeBalance?.value : quoteTokenBalance?.value)} ${isReverse ? "OKB" : "xUSDT"}`}
          token={isReverse ? "OKB" : "xUSDT"}
          tone="dark"
          isLoading={isReverse ? isFetchingNativeBalance : isFetchingQuoteTokenBalance}
          readOnly
        />

        <div className="flex flex-col gap-4 rounded-[24px] border border-[#203021] bg-[#132016] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Wallet className="size-5 shrink-0 stroke-[2] text-[#86d7a2]" />
            <div>
              <div className="text-sm font-semibold text-[#e7ece5]">Router</div>
              <div className="text-sm text-[#9ca59a]">
                1:1 demo vault swap between native OKB and xUSDT
              </div>
            </div>
          </div>
          <div className="rounded-full border border-[#285434] bg-[#13311c] px-3 py-1 text-xs font-semibold text-[#67f59c]">
            Live On-Chain
          </div>
        </div>

        <button
          type="button"
          disabled={isButtonDisabled}
          onClick={handleConfirmSwap}
          className="inline-flex w-full items-center justify-center gap-3 rounded-[24px] bg-[linear-gradient(90deg,#58ef95_0%,#e7cd61_100%)] px-5 py-5 text-xl font-semibold text-[#081108] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:text-[20px]"
        >
          {isPending ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              Confirming...
            </>
          ) : (
            "Confirm Swap"
          )}
        </button>

        {displayedStatusMessage ? (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${statusClassName}`}>
            {displayedStatusMessage}
          </div>
        ) : null}
      </div>
    </section>
  );
}

type TokenCardProps = {
  label: string;
  amount: string;
  balance: string;
  token: string;
  tone: "light" | "dark";
  editable?: boolean;
  readOnly?: boolean;
  onAmountChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  isLoading?: boolean;
};

function TokenCard({
  label,
  amount,
  balance,
  token,
  tone,
  editable = false,
  readOnly = false,
  onAmountChange,
  isLoading = false,
}: TokenCardProps) {
  const isLight = tone === "light";

  return (
    <div className="rounded-[28px] border border-[#1f2a20] bg-[linear-gradient(180deg,#181a1f_0%,#14161a_100%)] px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-[#b8beb6]">{label}</div>
          {editable ? (
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={onAmountChange}
              placeholder="0.0"
              className="mt-5 w-full border-none bg-transparent font-mono text-[36px] leading-none tracking-[-0.08em] text-[#f4f7f3] outline-none placeholder:text-[#5f665e] sm:text-[52px]"
            />
          ) : (
            <div className="mt-5 font-mono text-[36px] leading-none tracking-[-0.08em] text-[#f4f7f3] sm:text-[52px]">
              {amount}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:items-end sm:text-right">
          <div className="text-sm text-[#b8beb6]">
            {isLoading ? "Refreshing balance..." : balance}
          </div>
          <button
            type="button"
            disabled={readOnly}
            className={`inline-flex w-full items-center justify-center gap-3 rounded-full border px-5 py-3 text-sm font-semibold sm:w-auto sm:min-w-[160px] sm:justify-center sm:text-[15px] ${
              isLight
                ? "border-[#343a38] bg-[#212229] text-[#f4f7f3]"
                : "border-[#285434] bg-[#173622] text-[#63f59c]"
            } ${readOnly ? "cursor-default" : ""}`}
          >
            <span
              className={`size-7 rounded-full shadow-[0_0_12px_rgba(0,0,0,0.3)] ${
                isLight ? "bg-[radial-gradient(circle_at_30%_30%,#4ff08d_0%,#213729_100%)]" : "bg-[radial-gradient(circle_at_30%_30%,#eff468_0%,#42622d_100%)]"
              }`}
            />
            <span className="truncate">{token}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20 11a8 8 0 1 0 2.3 5.7" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

function SwapArrowsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M7 7h10" />
      <path d="m13 3 4 4-4 4" />
      <path d="M17 17H7" />
      <path d="m11 21-4-4 4-4" />
    </svg>
  );
}
