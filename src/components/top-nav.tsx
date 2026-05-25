"use client";

import { useSyncExternalStore } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function TopNav() {
  const mounted = useSyncExternalStore(subscribeToClientRender, getClientSnapshot, getServerSnapshot);
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();

  const injectedConnector =
    connectors.find((connector) => connector.id === "injected") ?? connectors[0];

  function handleWalletAction() {
    if (!mounted) {
      return;
    }

    if (isConnected) {
      disconnect();
      return;
    }

    if (!connectors || connectors.length === 0) {
      alert("Please install a Web3 wallet extension like OKX Wallet or MetaMask to continue.");
      return;
    }

    if (!injectedConnector) {
      alert("Please install a Web3 wallet extension like OKX Wallet or MetaMask to continue.");
      return;
    }

    try {
      connect({ connector: injectedConnector });
    } catch (error) {
      console.error(error);
      alert("Wallet connection failed or was rejected.");
    }
  }

  return (
    <header className="relative w-full border-b border-[#18261b] bg-[rgba(6,10,7,0.92)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-18 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl border border-[#233526] bg-[#0f1611] text-sm font-black tracking-[0.22em] text-[#79f79a] shadow-[0_0_24px_rgba(97,244,154,0.08)]">
            C
          </span>
          <div className="min-w-0">
            <span className="block truncate font-sans text-base font-bold tracking-[-0.04em] text-[#f4f7f2]">
              Cortex
            </span>
            <span className="block text-xs uppercase tracking-[0.26em] text-[#8b9988]">
              Cortex Control Panel
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 text-sm text-[#a9b5a4]">
            <StatusDot />
            <span>X Layer Testnet</span>
          </div>
          <button
            type="button"
            onClick={handleWalletAction}
            className="rounded-full border border-[#2a3c2d] bg-[linear-gradient(90deg,#61f58f_0%,#d9f06c_100%)] px-4 py-2 text-sm font-semibold text-[#071108] shadow-[0_14px_34px_rgba(67,175,92,0.2)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cf694] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mounted && isConnected && address ? truncateAddress(address) : "Connect Wallet"}
          </button>
        </div>
      </div>
    </header>
  );
}

function StatusDot() {
  return (
    <span
      aria-hidden="true"
      className="size-2 rounded-full bg-emerald-600"
    />
  );
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function subscribeToClientRender() {
  return () => undefined;
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export default TopNav;
