"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useSyncExternalStore, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRightLeft,
  Gift,
  LayoutGrid,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
const topNavItems = [
  { href: "/trade", label: "Trade" },
  { href: "/nfts", label: "NFTs" },
  { href: "/faucet", label: "Faucet" },
  { href: "/agents", label: "Agents" },
  { href: "/admin/matches", label: "Admin" },
  { href: "/history", label: "History" },
] as const;

const sideNavItems = [
  { href: "/trade", label: "Dashboard", icon: LayoutGrid },
  { href: "/trade", label: "Reward Swap", icon: ArrowRightLeft },
  { href: "/nfts", label: "Prediction Market", icon: Gift },
  { href: "/faucet", label: "COR Faucet", icon: Gift },
  { href: "/agents", label: "AI Agents", icon: LayoutGrid },
  { href: "/history", label: "Activity", icon: Activity },
  { href: "/pools", label: "Settings", icon: Settings },
] as const;

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const mounted = useSyncExternalStore(subscribeToClientRender, getClientSnapshot, getServerSnapshot);
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isWalletActionPending, setIsWalletActionPending] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement | null>(null);
  const { address, isConnected } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();

  const injectedConnector =
    connectors.find((connector) => connector.id === "injected") ?? connectors[0];

  const dashboardHighlights = useMemo(
    () => [
      { label: "Swap rate", value: "1 OKB = 100,000 COR" },
      { label: "Faucet drip", value: "1,000 COR / claim" },
      { label: "Network", value: "X Layer testnet" },
    ],
    [],
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (walletMenuRef.current && !walletMenuRef.current.contains(event.target as Node)) {
        setWalletMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setWalletMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleWalletAction() {
    if (!mounted || isWalletActionPending) {
      return;
    }

    if (isConnected) {
      setWalletMenuOpen((value) => !value);
      return;
    }

    if (connectors.length === 0 || !injectedConnector) {
      alert("Please install a Web3 wallet extension like OKX Wallet or MetaMask to continue.");
      return;
    }

    try {
      setIsWalletActionPending(true);
      await connectAsync({ connector: injectedConnector });
    } catch (error) {
      console.error(error);
      alert("Wallet connection failed or was rejected.");
    } finally {
      setIsWalletActionPending(false);
    }
  }

  async function handleDisconnectWallet() {
    if (isWalletActionPending) {
      return;
    }

    try {
      setIsWalletActionPending(true);
      await disconnectAsync();
      setWalletMenuOpen(false);
    } catch (error) {
      console.error(error);
      alert("Wallet disconnect failed.");
    } finally {
      setIsWalletActionPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(63,255,99,0.07),transparent_20%),linear-gradient(180deg,#030503_0%,#050805_100%)] text-[#f3f5ef]">
      <header className="sticky top-0 z-40 border-b border-[#162118] bg-[#071008]/88 backdrop-blur-2xl">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-4 px-4 py-3 sm:min-h-20 sm:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <button
              type="button"
              aria-label="Toggle navigation menu"
              onClick={() => setIsMobileMenuOpen((value) => !value)}
              className="inline-flex size-11 items-center justify-center rounded-2xl border border-[#1e2a20] bg-[#101711] text-[#e9eee6] shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition hover:border-[#315237] hover:bg-[#152016] lg:hidden"
            >
              {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>

            <Link
              href="/trade"
              className="flex min-w-0 items-center gap-3 rounded-full border border-[#1f3122] bg-[#0c140e]/80 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
            >
              <span className="flex size-10 items-center justify-center rounded-2xl border border-[#28442d] bg-[linear-gradient(180deg,#16311c_0%,#0e1510_100%)] text-[#7cff4d] shadow-[0_0_24px_rgba(90,255,62,0.08)]">
                ⬡
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[22px] font-semibold tracking-[-0.05em] text-[#f5f7f1] sm:text-[26px]">
                  Cortex
                </span>
                <span className="block truncate text-[10px] uppercase tracking-[0.22em] text-[#98a397]">
                  Autonomous DeFi Control Layer
                </span>
              </span>
            </Link>
          </div>

          <nav className="order-3 flex w-full items-center gap-2 overflow-x-auto pb-1 text-sm font-medium text-[#a6afa4] lg:order-none lg:w-auto lg:justify-center lg:gap-3 lg:overflow-visible lg:pb-0">
            {topNavItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`shrink-0 rounded-full px-4 py-2.5 transition ${
                    isActive
                      ? "border border-[#275533] bg-[#132419] text-[#67f59c] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                      : "border border-transparent text-[#c0c6be] hover:border-[#1f3122] hover:bg-[#0f1711] hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            <div className="hidden items-center gap-2 rounded-full border border-[#1c291d] bg-[#111811] px-3 py-2 font-mono text-[11px] text-[#c3cabc] sm:px-4 sm:text-[12px] xl:flex">
              <span className="size-2.5 shrink-0 rounded-full bg-[#55f397] shadow-[0_0_18px_rgba(85,243,151,0.55)]" />
              <span className="whitespace-nowrap">X Layer</span>
            </div>
            <div className="hidden gap-2 md:flex lg:flex">
              {dashboardHighlights.map((item) => (
                <div
                  key={item.label}
                  className="hidden rounded-full border border-[#1e2b20] bg-[#0f1611] px-3 py-2 text-[11px] text-[#b8c1b5] lg:block"
                >
                  <span className="text-[#7ef68f]">{item.label}:</span> {item.value}
                </div>
              ))}
            </div>
            <div className="relative" ref={walletMenuRef}>
              <button
                type="button"
                onClick={() => void handleWalletAction()}
                disabled={isWalletActionPending}
                className="inline-flex min-w-[7.5rem] items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#61f58f_0%,#d7f36b_100%)] px-3 py-2.5 text-xs font-semibold text-[#071108] shadow-[0_12px_30px_rgba(67,175,92,0.25)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[156px] sm:px-5 sm:py-3 sm:text-sm"
              >
                {isWalletActionPending ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-[#071108]/25 border-t-[#071108]" />
                    {isConnected ? "Disconnecting..." : "Connecting..."}
                  </>
                ) : mounted && isConnected && address ? (
                  <>
                    <span className="size-2 rounded-full bg-[#0f8f40]" />
                    {truncateAddress(address)}
                  </>
                ) : (
                  "Connect Wallet"
                )}
              </button>

              {walletMenuOpen && mounted && isConnected && address ? (
                <div className="absolute right-0 top-[calc(100%+12px)] z-50 w-[250px] rounded-[24px] border border-[#223126] bg-[#09110b] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
                  <div className="rounded-[18px] border border-[#162118] bg-[#0d1610] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[#8d978b]">Connected wallet</div>
                    <div className="mt-2 font-mono text-sm text-[#eef3ea]">{truncateAddress(address)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDisconnectWallet()}
                    disabled={isWalletActionPending}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-[18px] border border-[#2b3f2f] bg-[#121b14] px-4 py-3 text-sm font-semibold text-[#eef4ea] transition hover:bg-[#18231a] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isWalletActionPending ? (
                      <>
                        <span className="size-4 animate-spin rounded-full border-2 border-[#eef4ea]/25 border-t-[#eef4ea]" />
                        Disconnecting...
                      </>
                    ) : (
                      "Disconnect Wallet"
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-65px)] grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside
          className={`${
            isMobileMenuOpen ? "block" : "hidden"
          } border-b border-[#162118] bg-[linear-gradient(180deg,#0a140c_0%,#071008_100%)] lg:flex lg:flex-col lg:justify-between lg:border-b-0 lg:border-r`}
        >
          <div>
            <div className="border-b border-[#162118] px-5 py-5 sm:px-6 xl:px-[30px] xl:py-6">
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#defb74_0%,#82e36d_42%,#18311c_100%)] text-lg font-semibold text-[#041007] shadow-[0_0_24px_rgba(126,255,162,0.18)]">
                  ⬡
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[18px] font-semibold leading-none text-[#60f497]">
                    Cortex
                  </div>
                  <div className="mt-2 truncate text-sm uppercase tracking-[0.14em] text-[#afb7ab]">
                    Agentic Liquidity Hub
                  </div>
                </div>
              </div>
            </div>

            <div className="px-3 py-5 sm:px-4 lg:px-5 lg:py-7">
              <nav className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {sideNavItems.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href;

                  return (
                    <Link
                      key={`${href}-${label}`}
                      href={href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-4 rounded-2xl px-4 py-4 text-left text-sm font-medium transition sm:px-5 sm:text-base ${
                        isActive
                          ? "border-l-2 border-[#56f397] bg-[#12331b] text-[#60f497]"
                          : "text-[#c4cbc4] hover:bg-[#0e1810] hover:text-white"
                      }`}
                    >
                      <Icon className="size-5 shrink-0 stroke-[1.9]" />
                      <span className="truncate">{label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="px-5 pb-5 pt-2 sm:px-6 lg:px-[22px] lg:pb-10">
            <div className="w-full rounded-3xl border border-[#223126] bg-[#172119] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] lg:max-w-[248px]">
              <div className="text-xs uppercase tracking-[0.12em] text-[#b7c0b3]">
                Cortex Status
              </div>
              <div className="mt-4 text-[18px] font-semibold leading-8 text-[#65f59d]">
                Agent routing active
              </div>
              <div className="mt-3 text-sm leading-6 text-[#b7c0b3]">
                Swap COR, claim faucet liquidity, review live X Layer proof, and execute wallet intents from one responsive workspace.
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 bg-[radial-gradient(circle_at_top,rgba(18,48,24,0.24),transparent_22%),linear-gradient(180deg,#020402_0%,#050805_100%)] px-4 py-4 sm:px-6 sm:py-6 xl:px-10 xl:py-10">
          {children}
        </main>
      </div>
    </div>
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
