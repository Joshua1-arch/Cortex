"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, useState, type ReactNode } from "react";
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
  { href: "/pools", label: "Pools" },
  { href: "/agents", label: "Agents" },
  { href: "/history", label: "History" },
] as const;

const sideNavItems = [
  { href: "/trade", label: "Dashboard", icon: LayoutGrid },
  { href: "/trade", label: "Token Swap", icon: ArrowRightLeft },
  { href: "/nfts", label: "NFT Market", icon: Gift },
  { href: "/faucet", label: "xUSDT Faucet", icon: Gift },
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
  const { address, isConnected } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();

  const injectedConnector =
    connectors.find((connector) => connector.id === "injected") ?? connectors[0];

  async function handleWalletAction() {
    if (!mounted || isWalletActionPending) {
      return;
    }

    if (isConnected) {
      try {
        setIsWalletActionPending(true);
        await disconnectAsync();
      } catch (error) {
        console.error(error);
        alert("Wallet disconnect failed.");
      } finally {
        setIsWalletActionPending(false);
      }
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

  return (
    <div className="min-h-screen bg-[#040704] text-[#f3f5ef]">
      <header className="sticky top-0 z-40 border-b border-[#162118] bg-[#091109]/95 backdrop-blur-xl">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:min-h-20 sm:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <button
              type="button"
              aria-label="Toggle navigation menu"
              onClick={() => setIsMobileMenuOpen((value) => !value)}
              className="inline-flex size-10 items-center justify-center rounded-2xl border border-[#1e2a20] bg-[#101711] text-[#e9eee6] lg:hidden"
            >
              {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>

            <Link
              href="/trade"
              className="truncate text-[28px] font-semibold tracking-[-0.05em] text-[#f5f7f1]"
            >
              X CUP
            </Link>
          </div>

          <nav className="order-3 flex w-full items-center gap-2 overflow-x-auto pb-1 text-sm font-medium text-[#a6afa4] lg:order-none lg:w-auto lg:justify-center lg:gap-8 lg:overflow-visible lg:pb-0">
            {topNavItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`shrink-0 border-b-2 px-1 py-2 transition ${
                    isActive
                      ? "border-[#55f397] text-[#55f397]"
                      : "border-transparent text-[#c0c6be] hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-3 sm:gap-4 md:flex">
            <div className="flex items-center gap-3 rounded-full border border-[#1c291d] bg-[#111811] px-4 py-2 font-mono text-[13px] text-[#c3cabc] sm:px-6">
              <span className="size-2.5 rounded-full bg-[#55f397]" />
              <span className="whitespace-nowrap">X Layer Mainnet</span>
            </div>
            <button
              type="button"
              onClick={() => void handleWalletAction()}
              disabled={isWalletActionPending}
              className="rounded-2xl bg-[#61f58f] px-5 py-3 text-sm font-semibold text-[#071108] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[146px]"
            >
              {isWalletActionPending
                ? (isConnected ? "Disconnecting..." : "Connecting...")
                : mounted && isConnected && address
                  ? truncateAddress(address)
                  : "Connect Wallet"}
            </button>
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
                  ⊗
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[18px] font-semibold leading-none text-[#60f497]">
                    X CUP
                  </div>
                  <div className="mt-2 truncate text-sm uppercase tracking-[0.14em] text-[#afb7ab]">
                    X Layer Trading
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
                Season Event
              </div>
              <div className="mt-4 text-[18px] font-semibold leading-8 text-[#65f59d]">
                Season: World Cup 2026
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
