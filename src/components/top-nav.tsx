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
    <header className="relative w-full border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate font-sans text-base font-bold text-zinc-950 dark:text-zinc-50">
            X Cup Exchange
          </span>
          <span className="shrink-0 rounded border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            Powered by X Layer
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <StatusDot />
            <span>X Layer Testnet</span>
          </div>
          <button
            type="button"
            onClick={handleWalletAction}
            className="rounded bg-zinc-900 px-4 py-1.5 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-500"
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
