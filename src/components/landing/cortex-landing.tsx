"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  Droplets,
  Gift,
  LayoutGrid,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

const navLinks = [
  { href: "/trade", label: "Trade" },
  { href: "/nfts", label: "NFTs" },
  { href: "/faucet", label: "Faucet" },
  { href: "/agents", label: "Agents" },
  { href: "/admin/matches", label: "Admin" },
] as const;

const productFeatures = [
  {
    icon: Gift,
    eyebrow: "Prediction markets",
    title: "Mint match-winner NFTs",
    description:
      "Admins publish live fixtures with team flags and COR mint prices. Users pick Team A, Draw, or Team B once per wallet and hold the result onchain.",
    href: "/nfts",
    cta: "Open markets",
  },
  {
    icon: ArrowRight,
    eyebrow: "Reward router",
    title: "Swap COR and OKB",
    description:
      "Winners claim COR from the marketplace, then exit through the live swap router to COR or native OKB on X Layer testnet.",
    href: "/trade",
    cta: "Go to trade",
  },
  {
    icon: Droplets,
    eyebrow: "Testnet liquidity",
    title: "COR faucet",
    description: "Claim test COR to approve markets, mint prediction NFTs, and rehearse the full winner payout loop.",
    href: "/faucet",
    cta: "Claim COR",
  },
  {
    icon: Sparkles,
    eyebrow: "Agentic control",
    title: "AI intent console",
    description:
      "Describe swaps, faucet claims, and contract actions in natural language. The agent routes wallet transactions through the same contracts as the UI.",
    href: "/agents",
    cta: "Use agents",
  },
  {
    icon: ShieldCheck,
    eyebrow: "Admin ops",
    title: "Create and settle matches",
    description:
      "List fixtures, open mint windows, review match history, and mark the winning option so correct predictions can claim rewards.",
    href: "/admin/matches",
    cta: "Admin console",
  },
  {
    icon: Trophy,
    eyebrow: "Soulbound identity",
    title: "Founder trophy badge",
    description:
      "Mint the Cortex soulbound trophy from the NFT hub as a permanent testnet identity marker alongside your prediction activity.",
    href: "/nfts",
    cta: "View NFT hub",
  },
] as const;

const workflowSteps = [
  {
    step: "01",
    title: "Admin lists the fixture",
    description: "Set teams, flag art, mint amounts, and the open/close window on /admin/matches.",
  },
  {
    step: "02",
    title: "Users mint one pick",
    description: "Fans tap Team A, Draw, or Team B on /nfts and lock a single prediction NFT per match.",
  },
  {
    step: "03",
    title: "Admin settles the winner",
    description: "When the match ends, the owner wallet resolves the market and unlocks winner claims.",
  },
  {
    step: "04",
    title: "Winners claim and exit",
    description: "Correct picks claim COR, then swap out through the live router to COR or native OKB.",
  },
] as const;

const liveStats = [
  { label: "Network", value: "X Layer testnet" },
  { label: "Quote token", value: "COR" },
  { label: "Swap rail", value: "COR ↔ OKB" },
  { label: "Faucet drip", value: "1,000 COR / claim" },
] as const;

export function CortexLanding() {
  const mounted = useSyncExternalStore(subscribeToClientRender, getClientSnapshot, getServerSnapshot);
  const [isWalletActionPending, setIsWalletActionPending] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const { address, isConnected } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();

  const injectedConnector = useMemo(
    () => connectors.find((connector) => connector.id === "injected") ?? connectors[0],
    [connectors],
  );

  async function handleWalletAction() {
    if (!mounted || isWalletActionPending) {
      return;
    }

    if (isConnected) {
      setWalletMenuOpen((value) => !value);
      return;
    }

    if (connectors.length === 0 || !injectedConnector) {
      window.alert("Install OKX Wallet or MetaMask to connect.");
      return;
    }

    try {
      setIsWalletActionPending(true);
      await connectAsync({ connector: injectedConnector });
    } catch (error) {
      console.error(error);
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
    } finally {
      setIsWalletActionPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(63,255,99,0.08),transparent_24%),linear-gradient(180deg,#030503_0%,#050805_100%)] text-[#f3f5ef]">
      <header className="sticky top-0 z-40 border-b border-[#162118] bg-[#071008]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[#28442d] bg-[linear-gradient(180deg,#16311c_0%,#0e1510_100%)] text-[#7cff4d] sm:size-11">
              ⬡
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-semibold tracking-[-0.05em] sm:text-xl">Cortex</span>
              <span className="block truncate text-[10px] uppercase tracking-[0.2em] text-[#98a397]">
                X Layer DeFi workspace
              </span>
            </span>
          </Link>

          <nav className="order-3 flex w-full gap-2 overflow-x-auto pb-1 text-sm sm:order-none sm:w-auto sm:pb-0">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-full border border-transparent px-3 py-2 text-[#c0c6be] transition hover:border-[#1f3122] hover:bg-[#0f1711] hover:text-white sm:px-4"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="relative flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-[#1c291d] bg-[#111811] px-3 py-2 text-[11px] text-[#c3cabc] sm:flex">
              <span className="size-2 shrink-0 rounded-full bg-[#55f397]" />
              <span className="whitespace-nowrap">X Layer</span>
            </div>

            <button
              type="button"
              onClick={() => void handleWalletAction()}
              disabled={isWalletActionPending}
              className="inline-flex min-w-[8.5rem] items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#61f58f_0%,#d7f36b_100%)] px-4 py-2.5 text-sm font-semibold text-[#071108] transition hover:brightness-105 disabled:opacity-60 sm:min-w-[9.5rem] sm:px-5 sm:py-3"
            >
              {isWalletActionPending
                ? "..."
                : mounted && isConnected && address
                  ? truncateAddress(address)
                  : "Connect"}
            </button>

            {walletMenuOpen && mounted && isConnected && address ? (
              <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(100vw-2rem,240px)] rounded-2xl border border-[#223126] bg-[#09110b] p-2 shadow-xl">
                <div className="px-3 py-2 font-mono text-xs text-[#eef3ea]">{truncateAddress(address)}</div>
                <button
                  type="button"
                  onClick={() => void handleDisconnectWallet()}
                  className="w-full rounded-xl border border-[#2b3f2f] bg-[#121b14] px-3 py-2.5 text-sm font-semibold text-[#eef4ea]"
                >
                  Disconnect
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className="py-10 sm:py-14 lg:py-20">
          <div className="overflow-hidden rounded-[32px] border border-[#1d291f] bg-[linear-gradient(180deg,rgba(8,10,8,0.98),rgba(5,6,5,1))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:p-10 lg:p-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2d3c2f] bg-[#111713] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#dbe4d8]">
              <span className="size-2 rounded-full bg-[#61f58f]" />
              Live on X Layer testnet
            </div>

            <h1 className="mt-6 max-w-4xl text-[clamp(2rem,6vw,4.25rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-[#f3f3ed]">
              Agentic DeFi for <span className="text-[#61f58f]">swaps</span>,{" "}
              <span className="italic text-[#f0ca6a]">prediction NFTs</span>, and onchain proof.
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-[#c6c8c2] sm:text-base sm:leading-8">
              Cortex is the control layer we built end to end: admins publish match markets, users mint winner picks as
              NFTs, results settle onchain, and winners claim COR before swapping to OKB through the same dashboard you
              use for faucet liquidity and AI-routed transactions.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href={mounted && isConnected ? "/trade" : "#"}
                onClick={(event) => {
                  if (!mounted || !isConnected) {
                    event.preventDefault();
                    void handleWalletAction();
                  }
                }}
                className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#61f58f_0%,#d9f06c_100%)] px-6 py-4 text-sm font-semibold text-[#071108] transition hover:brightness-105"
              >
                {mounted && isConnected ? "Enter dashboard" : "Connect to start"}
              </Link>
              <Link
                href="/nfts"
                className="inline-flex items-center justify-center rounded-2xl border border-[#334032] bg-[#101512] px-6 py-4 text-sm font-semibold text-[#edf5ed] transition hover:bg-[#1a231c]"
              >
                Browse match NFTs
              </Link>
              <Link
                href="/admin/matches"
                className="inline-flex items-center justify-center rounded-2xl border border-[#57451b] bg-[#161206] px-6 py-4 text-sm font-semibold text-[#efc75e] transition hover:bg-[#1f1a0c]"
              >
                Admin match console
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {liveStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-[#243225] bg-[#0c120d] px-3 py-3 sm:px-4 sm:py-4"
                >
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[#8f9b8e]">{stat.label}</div>
                  <div className="mt-1 font-mono text-xs text-[#f1f1ea] sm:text-sm">{stat.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-12 sm:pb-16">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8f9b8e]">Built modules</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Everything in the workspace</h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-[#a9b4a8]">
              Each route maps to a live screen in the app — not a roadmap slide.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {productFeatures.map((feature) => {
              const Icon = feature.icon;

              return (
                <Link
                  key={feature.title}
                  href={feature.href}
                  className="group flex h-full flex-col rounded-[24px] border border-[#243225] bg-[linear-gradient(180deg,#101512_0%,#0b100c_100%)] p-5 transition hover:border-[#3a5240] sm:p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="rounded-2xl border border-[#2a372c] bg-[#111713] p-3 text-[#61f58f]">
                      <Icon className="size-5" />
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-[#8f9b8e]">{feature.eyebrow}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-[#f1f1ea]">{feature.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-7 text-[#a9b4a8]">{feature.description}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#61f58f]">
                    {feature.cta}
                    <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="pb-12 sm:pb-16">
          <div className="rounded-[28px] border border-[#263126] bg-[linear-gradient(180deg,#0a140c_0%,#071008_100%)] p-6 sm:p-8 lg:p-10">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#8f9b8e]">
              <LayoutGrid className="size-4" />
              Prediction lifecycle
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">How a match runs on Cortex</h2>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {workflowSteps.map((item) => (
                <div
                  key={item.step}
                  className="rounded-[22px] border border-[#1f2c20] bg-[#0d120e] p-5"
                >
                  <div className="font-mono text-sm text-[#61f58f]">{item.step}</div>
                  <h3 className="mt-3 text-base font-semibold text-[#f1f1ea]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#a9b4a8]">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-16 sm:pb-20">
          <div className="rounded-[28px] border border-[#57451b] bg-[linear-gradient(135deg,#191204_0%,#0d0b05_55%,#15231a_100%)] px-6 py-10 text-center sm:px-10 sm:py-14">
            <h2 className="text-2xl font-semibold tracking-[-0.04em] sm:text-4xl">Ready to run the full loop?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#c6c8c2] sm:text-base">
              Claim COR, mint your pick, wait for settlement, claim your reward, and swap out — all from one responsive
              Cortex dashboard on X Layer.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/faucet"
                className="inline-flex items-center justify-center rounded-2xl border border-[#334032] bg-[#101512] px-6 py-4 text-sm font-semibold text-[#edf5ed]"
              >
                Start with faucet
              </Link>
              <Link
                href="/nfts"
                className="inline-flex items-center justify-center rounded-2xl bg-[#f1c95e] px-6 py-4 text-sm font-semibold text-[#171208]"
              >
                Mint a prediction
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#162118] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-[#f1f1ea]">Cortex</div>
            <p className="mt-1 text-sm text-[#8f9b8e]">Autonomous DeFi intelligence on X Layer testnet.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-[#a9b4a8]">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-[#f1f1ea]">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
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
