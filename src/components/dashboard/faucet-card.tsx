"use client";

import { ArrowUpRight, Coins, Droplets } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BaseError, formatEther, parseAbi, type Hex } from "viem";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getContractsForChain, hasConfiguredAddress } from "@/lib/contracts";

const SUPPORTED_CHAIN_IDS = new Set([1952, 11155111] as const);
const FAUCET_ABI = parseAbi([
  "function requestTokens() external",
  "function nextRequestAt(address) external view returns (uint256)",
  "function cooldownTime() external view returns (uint256)",
  "function dripAmount() external view returns (uint256)",
]);

function getErrorMessage(error: unknown) {
  if (error instanceof BaseError) {
    return error.shortMessage || error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown faucet transaction error.";
}

function formatDuration(seconds: bigint) {
  const totalSeconds = Number(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours <= 0) {
    return `${minutes}m`;
  }

  if (minutes <= 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function FaucetCard() {
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"idle" | "success" | "error">("idle");
  const [submittedHash, setSubmittedHash] = useState<Hex | undefined>();
  const [isClaimSubmitting, setIsClaimSubmitting] = useState(false);
  const { address, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { showToast } = useToast();

  const isSupportedChain = chainId !== undefined && SUPPORTED_CHAIN_IDS.has(chainId as 1952 | 11155111);
  const activeChainId = isSupportedChain ? chainId : 1952;
  const activeContracts = getContractsForChain(activeChainId);
  const faucetAddress =
    (activeContracts.faucetAddress && hasConfiguredAddress(activeContracts.faucetAddress)
      ? activeContracts.faucetAddress
      : undefined) ?? (process.env.NEXT_PUBLIC_XLAYER_FAUCET_ADDRESS as `0x${string}` | undefined);
  const quoteTokenAddress =
    (activeContracts.quoteTokenAddress && hasConfiguredAddress(activeContracts.quoteTokenAddress)
      ? activeContracts.quoteTokenAddress
      : undefined) ?? (process.env.NEXT_PUBLIC_XLAYER_QUOTE_TOKEN_ADDRESS as `0x${string}` | undefined);
  const isFaucetConfigured = Boolean(faucetAddress);

  const {
    isLoading: isReceiptPending,
    isSuccess: isReceiptSuccess,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: submittedHash,
  });

  const { data: nextRequestAt } = useReadContract({
    address: faucetAddress,
    abi: FAUCET_ABI,
    functionName: "nextRequestAt",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(faucetAddress) && Boolean(address),
    },
  });

  const { data: dripAmount } = useReadContract({
    address: faucetAddress,
    abi: FAUCET_ABI,
    functionName: "dripAmount",
    query: {
      enabled: Boolean(faucetAddress),
    },
  });

  const { data: quoteBalance } = useBalance({
    address,
    chainId: activeChainId,
    token: quoteTokenAddress as `0x${string}`,
    query: {
      enabled: Boolean(address) && Boolean(quoteTokenAddress),
    },
  });

  const [nowInSeconds, setNowInSeconds] = useState(() => BigInt(Math.floor(Date.now() / 1000)));

  useEffect(() => {
    const updateCurrentTime = () => setNowInSeconds(BigInt(Math.floor(Date.now() / 1000)));

    updateCurrentTime();

    if (!(typeof nextRequestAt === "bigint" && nextRequestAt > nowInSeconds)) {
      return undefined;
    }

    const intervalId = window.setInterval(updateCurrentTime, 1000);
    return () => window.clearInterval(intervalId);
  }, [nextRequestAt, nowInSeconds]);

  const isOnCooldown = typeof nextRequestAt === "bigint" && nextRequestAt > nowInSeconds;
  const cooldownRemaining = isOnCooldown ? nextRequestAt - nowInSeconds : BigInt(0);

  const derivedStatus = useMemo(() => {
    if (!submittedHash) {
      return null;
    }

    if (isReceiptPending) {
      return {
        message: "Waiting for faucet claim confirmation...",
        tone: "idle" as const,
      };
    }

    if (isReceiptSuccess) {
      return {
        message: "1,000 COR claimed successfully.",
        tone: "success" as const,
      };
    }

    if (isReceiptError) {
      return {
        message: `Claim failed: ${getErrorMessage(receiptError)}`,
        tone: "error" as const,
      };
    }

    return null;
  }, [isReceiptError, isReceiptPending, isReceiptSuccess, receiptError, submittedHash]);

  const displayedStatusMessage = derivedStatus?.message ?? statusMessage;
  const displayedStatusTone = derivedStatus?.tone ?? statusTone;

  const statusClassName = useMemo(() => {
    if (displayedStatusTone === "success") {
      return "border-emerald-200 bg-emerald-50 text-emerald-600";
    }

    if (displayedStatusTone === "error") {
      return "border-rose-200 bg-rose-50 text-rose-600";
    }

    return "border-zinc-200 bg-zinc-100 text-zinc-600";
  }, [displayedStatusTone]);

  const isClaimDisabled =
    !address
    || !isSupportedChain
    || !isFaucetConfigured
    || isOnCooldown
    || isClaimSubmitting
    || isReceiptPending;

  const isClaimLoading = isClaimSubmitting || isReceiptPending;

  function handleOpenOkbFaucet() {
    if (!address) {
      showToast("Connect wallet first before opening the official OKB faucet.", "error");
      return;
    }

    window.open("https://web3.okx.com/xlayer/faucet/xlayerfaucet", "_blank", "noopener,noreferrer");
  }

  async function handleClaim() {
    if (!address) {
      setStatusMessage("Connect your wallet before claiming faucet tokens.");
      setStatusTone("error");
      return;
    }

    if (!isSupportedChain) {
      setStatusMessage("Please switch your wallet to X Layer Testnet or Sepolia.");
      setStatusTone("error");
      return;
    }

    if (!faucetAddress) {
      setStatusMessage("Faucet contract address is not configured.");
      setStatusTone("error");
      return;
    }

    if (isOnCooldown) {
      setStatusMessage(`Cooldown active. Try again in ${formatDuration(cooldownRemaining)}.`);
      setStatusTone("error");
      return;
    }

    try {
      setIsClaimSubmitting(true);
      setSubmittedHash(undefined);
      setStatusMessage("Submitting faucet claim...");
      setStatusTone("idle");

      const hash = await writeContractAsync({
        address: faucetAddress,
        abi: FAUCET_ABI,
        functionName: "requestTokens",
        args: [],
      });

      setSubmittedHash(hash);
    } catch (error) {
      setStatusMessage(`Claim failed: ${getErrorMessage(error)}`);
      setStatusTone("error");
    } finally {
      setIsClaimSubmitting(false);
    }
  }

  return (
    <section className="rounded-[34px] border border-[#1f2c20] bg-[linear-gradient(180deg,#161918_0%,#101211_100%)] px-5 py-5 text-[#eef2eb] shadow-[0_18px_60px_rgba(0,0,0,0.45)] sm:px-7 sm:py-7">
      <div className="mb-7 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-full border border-[#2d7d4a] bg-[#173321] text-[#61f49a] shadow-[0_0_16px_rgba(97,244,154,0.12)]">
            <Droplets className="size-5 stroke-[2.1]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.04em] text-[#f3f6f0] sm:text-[28px]">
              COR Faucet
            </h2>
            <p className="mt-1 text-sm text-[#a8b1a4]">
              Claim free testnet liquidity for DEX beta testing.
            </p>
          </div>
        </div>
        <span className="rounded-full border border-[#285434] bg-[#13311c] px-3 py-1 text-xs font-semibold text-[#67f59c]">
          Testnet Only
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[24px] border border-[#203021] bg-[#132016] px-5 py-4">
          <div className="text-sm text-[#9ca59a]">Faucet Drip</div>
          <div className="mt-3 flex items-center gap-3 text-[28px] font-semibold text-[#f4f7f3]">
            <Coins className="size-6 text-[#67f59c]" />
            {dripAmount ? Number(formatEther(dripAmount)).toLocaleString() : "1,000"} COR
          </div>
        </div>

        <div className="rounded-[24px] border border-[#203021] bg-[#132016] px-5 py-4">
          <div className="text-sm text-[#9ca59a]">Your COR Balance</div>
          <div className="mt-3 text-[28px] font-semibold text-[#f4f7f3]">
            {quoteBalance?.value ? Number(formatEther(quoteBalance.value)).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }) : "0.00"}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div className="rounded-[24px] border border-[#203021] bg-[#132016] px-5 py-4 text-sm text-[#a8b1a4]">
          {isOnCooldown
            ? `Cooldown active. You can claim again in ${formatDuration(cooldownRemaining)}.`
            : "Each wallet can claim once every 24 hours."}
        </div>

        <div className="rounded-[24px] border border-[#2f3f2f] bg-[#101711] px-5 py-4 text-sm text-[#b9c3b5]">
          Claim amount is fixed at <span className="font-semibold text-[#eef2eb]">1,000 COR</span>. There is no input field because the faucet contract only supports a fixed [`requestTokens()`](src/components/dashboard/faucet-card.tsx:17) claim amount.
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <Button
          type="button"
          disabled={isClaimDisabled}
          isLoading={isClaimLoading}
          loadingText={isClaimSubmitting ? "Opening wallet..." : "Confirming claim..."}
          onClick={() => void handleClaim()}
          className="w-full rounded-[24px] px-5 py-5 text-xl sm:text-[20px]"
        >
          Claim 1,000 COR
        </Button>

        <div className="rounded-[28px] border border-[#223126] bg-[linear-gradient(180deg,#111713_0%,#0c120d_100%)] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-[#7ef68f]">Native Gas Support</div>
              <h3 className="mt-2 text-lg font-semibold text-[#f2f6ef]">OKB Testnet Faucet</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#aab3a7]">
                Need native OKB for gas? Open the official X Layer faucet to top up your wallet before swapping or executing intents.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleOpenOkbFaucet}
              className="w-full shrink-0 rounded-[18px] px-5 py-4 text-sm sm:w-auto"
            >
              Open Official Faucet
              <ArrowUpRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {displayedStatusMessage ? (
        <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${statusClassName}`}>
          {displayedStatusMessage}
        </div>
      ) : null}
    </section>
  );
}
