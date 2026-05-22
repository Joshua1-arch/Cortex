"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

const featureCards = [
  {
    eyebrow: "AI-Driven DEX",
    title: "INTELLIGENT LIQUIDITY.",
    description:
      "Smart routes optimize your token swaps across pools, predicting optimal price paths and minimizing slippage. Agentic trade execution and portfolio management are integrated.",
    icon: "◉",
  },
  {
    eyebrow: "Gasless Transactions",
    title: "FRICTIONLESS TRADING.",
    description:
      "Focus on the asset, not the network. Sponsor your transactions and pay gas in your preferred token, or not at all, with our automated paymaster system.",
    icon: "↗",
  },
  {
    eyebrow: "Soulbound Trophies",
    title: "IMMUTABLE DIGITAL IDENTITY.",
    description:
      "Mint unique, non-transferable soulbound badges identifying with the Cortex Founder Trophy Badge. Trade smart digital assets in our AI-curated marketplace.",
    icon: "▣",
  },
] as const;

const roadmapItems = [
  {
    quarter: "Q3 2026",
    title: "CORTEX FOUNDATION MINT",
    description: "Testnet Faucet launch. Soulbound Trophy Claim. Cortex launch.",
    side: "left" as const,
  },
  {
    quarter: "Q4 2026",
    title: "AGENT INTEGRATION BETA",
    description: "Intelligent routing. Gasless V1 deployment on testnet.",
    side: "right" as const,
  },
  {
    quarter: "Q1 2027",
    title: "V1 MAINNET DEPLOYMENT",
    description: "CORTX token public sale. Full DEX & NFT V1 integration.",
    side: "left" as const,
  },
  {
    quarter: "Q2 2027",
    title: "DAO V1 & AGENT GOVERNANCE",
    description: "Decentralized control. Autonomous parameter optimization by AI models.",
    side: "right" as const,
  },
] as const;

const tokenUtilityItems = [
  "GOVERNANCE VOTING — Empowering holders to steer the protocol's evolutionary path through DAO voting.",
  "GAS SPONSORSHIP — Utility as a medium for gas-fee ecosystem interaction via automated paymasters.",
  "STAKING INCENTIVES — Reward protocols for securing the neural computation layer and providing liquidity.",
  "ECOSYSTEM GRANTS — Continuous funding for developers building next-gen autonomous DeFi applications.",
] as const;

export default function HomePage() {
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(93,255,95,0.08),transparent_28%),linear-gradient(180deg,#020402_0%,#040704_100%)] text-white">
      <div className="mx-auto max-w-[1440px] px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        <header className="sticky top-3 z-30 mb-4 rounded-[28px] border border-[#17331b] bg-[rgba(7,12,8,0.82)] px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:px-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-[#213e25] bg-[linear-gradient(180deg,#16311c_0%,#0e1510_100%)] text-[#7cff4d] shadow-[0_0_24px_rgba(90,255,62,0.08)]">
                ⬡
              </div>
              <div>
                <div className="text-[20px] font-semibold tracking-[-0.05em] text-[#f5f7f1] sm:text-[24px]">Cortex</div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#9aa599]">Autonomous DeFi Intelligence</div>
              </div>
            </div>

            <nav className="hidden items-center gap-6 rounded-full border border-[#203225] bg-[#0e1310] px-5 py-2.5 text-[11px] font-medium text-[#cbd1c8] md:flex">
              <Link href="/trade" className="text-[#82ff59] transition hover:text-white">
                Dashboard
              </Link>
              <a href="#tokenomics" className="transition hover:text-white">
                Tokenomics
              </a>
              <a href="#roadmap" className="transition hover:text-white">
                Roadmap
              </a>
            </nav>

            <div className="relative flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleWalletAction()}
                disabled={isWalletActionPending}
                className="inline-flex min-w-[132px] items-center justify-center rounded-full border border-[#2a422d] bg-[#0f1a12] px-4 py-2.5 text-[11px] font-semibold text-[#eff4ea] transition hover:bg-[#132017] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isWalletActionPending
                  ? isConnected
                    ? "Disconnecting..."
                    : "Connecting..."
                  : mounted && isConnected && address
                    ? truncateAddress(address)
                    : "Connect Wallet"}
              </button>

              {mounted && isConnected && address ? (
                <button
                  type="button"
                  onClick={() => setWalletMenuOpen((value) => !value)}
                  className="inline-flex size-11 items-center justify-center rounded-full border border-[#2a422d] bg-[#111813] text-[#92f36a] transition hover:bg-[#16211a]"
                  aria-label="Wallet options"
                >
                  ☰
                </button>
              ) : null}

              {walletMenuOpen && mounted && isConnected && address ? (
                <div className="absolute right-0 top-[calc(100%+12px)] z-40 w-[220px] rounded-[20px] border border-[#223126] bg-[#09110b] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
                  <div className="px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-[#8d978b]">Wallet connected</div>
                  <div className="px-3 pb-2 text-sm font-medium text-[#eef3ea]">{truncateAddress(address)}</div>
                  <button
                    type="button"
                    onClick={() => void handleDisconnectWallet()}
                    disabled={isWalletActionPending}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(90deg,#58ef95_0%,#e7cd61_100%)] px-4 py-3 text-sm font-semibold text-[#081108] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isWalletActionPending ? "Disconnecting..." : "Disconnect Wallet"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <section className="px-2 pb-14 pt-6 text-center sm:px-10 sm:pt-2">
          <div className="mx-auto max-w-[860px] rounded-[32px] border border-[#1b2e1f] bg-[linear-gradient(180deg,#09110b_0%,#050705_100%)] px-5 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:px-8 sm:py-14">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#244128] bg-[#0f1811] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#90ff6e]">
              Cortex Autonomous DeFi
            </div>
            <h1 className="mx-auto mt-5 max-w-[780px] text-[34px] font-semibold uppercase leading-[0.95] tracking-[-0.06em] text-[#e9e9e9] sm:text-[58px] lg:text-[68px]">
              AI AGENTS FOR <span className="text-[#64ff32]">INTELLIGENT LIQUIDITY</span> AND
              DIGITAL OWNERSHIP.
            </h1>

            <p className="mx-auto mt-5 max-w-[700px] text-[13px] leading-7 text-[#cfd5cb] sm:text-[15px]">
              Cortex delivers a sleek agentic trading experience for swaps, faucet claims, and soulbound trophy minting—optimized for X Layer testnet and built for a responsive, premium DeFi workflow.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/trade"
                className="inline-flex min-w-[186px] items-center justify-center rounded-full bg-[linear-gradient(90deg,#5bff2f_0%,#c8ff63_100%)] px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-black transition hover:brightness-105"
              >
                Enter Dashboard
              </Link>
              <Link
                href="/nfts"
                className="inline-flex min-w-[186px] items-center justify-center rounded-full border border-[#2a422d] bg-[#111813] px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#eef4ea] transition hover:bg-[#16211a]"
              >
                Claim Founder Trophy
              </Link>
            </div>
          </div>

          <div className="mt-8 text-[9px] font-semibold uppercase tracking-[0.28em] text-[#d4d4d4]">
            Read Whitepaper
          </div>

          <div className="mt-5 flex items-center justify-center gap-5 text-[#f0f0f0]">
            <span className="text-sm">◫</span>
            <span className="text-sm">◧</span>
            <span className="text-sm">◩</span>
          </div>

          <div className="mt-5 text-[8px] uppercase tracking-[0.4em] text-[#6f6f6f]">Powered By X Layer</div>

          <div className="relative mx-auto mt-10 flex max-w-[720px] items-center justify-center overflow-hidden border border-[#101d12] bg-[radial-gradient(circle_at_center,rgba(60,255,102,0.16),transparent_28%),linear-gradient(180deg,#070a08_0%,#030303_100%)] px-6 py-10 sm:px-10 sm:py-14">
            <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(92,255,111,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(92,255,111,0.08)_1px,transparent_1px)] [background-size:34px_34px]" />
            <div className="absolute h-[300px] w-[300px] rounded-full border border-[#4cff65]/40 shadow-[0_0_50px_rgba(76,255,101,0.25)] sm:h-[380px] sm:w-[380px]" />
            <div className="absolute h-[260px] w-[260px] rounded-full border border-[#fbda58]/60 rotate-[24deg] sm:h-[330px] sm:w-[330px]" />
            <div className="absolute h-[260px] w-[260px] rounded-full border border-[#52ff6d]/50 -rotate-[24deg] sm:h-[330px] sm:w-[330px]" />
            <div className="relative flex h-[180px] w-[180px] items-center justify-center rounded-full border border-[#a8ffb7]/50 bg-[radial-gradient(circle_at_30%_30%,#1e3524_0%,#0b130d_55%,#050505_100%)] shadow-[0_0_60px_rgba(95,255,124,0.35)] sm:h-[220px] sm:w-[220px]">
              <div className="absolute inset-3 rounded-full border border-[#65ff74]/40" />
              <div className="absolute inset-7 rounded-full border border-[#ffd54a]/30" />
              <div className="text-center">
                <div className="text-[12px] uppercase tracking-[0.36em] text-[#8dff7d]">CORTX</div>
                <div className="mt-2 flex h-16 w-16 items-center justify-center rounded-full border border-[#d6d6d6]/20 bg-[radial-gradient(circle_at_top,#5c6b62_0%,#131616_75%)] text-4xl font-semibold text-[#dbe7dc] shadow-[inset_0_0_20px_rgba(255,255,255,0.06)] sm:h-20 sm:w-20 sm:text-5xl">
                  C
                </div>
                <div className="mt-2 text-[12px] uppercase tracking-[0.36em] text-[#8dff7d]">CORTX</div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-[#071407] px-2 py-12 sm:px-0">
          <div className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#70ff5d]">Efficiency Redefined</div>
          <h2 className="mt-3 text-[34px] font-semibold uppercase leading-[0.98] tracking-[-0.05em] text-[#dedede] sm:text-[52px]">
            REVOLUTIONIZING THE DEFI LANDSCAPE.
          </h2>
          <p className="mt-3 max-w-[520px] text-[12px] leading-6 text-[#c7c7c7]">
            Three key pillars of the Cortex ecosystem designed to eliminate friction and maximize
            intelligence.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {featureCards.map((card) => (
              <article
                key={card.title}
                className="rounded-[10px] border border-[#16391a] bg-[linear-gradient(180deg,#071007_0%,#091109_100%)] px-5 py-6 shadow-[inset_0_0_0_1px_rgba(80,255,120,0.03)]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#325d35] bg-[#0b140c] text-[#85ff71]">
                  {card.icon}
                </div>
                <div className="mt-5 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#61ff4f]">
                  {card.eyebrow}
                </div>
                <h3 className="mt-2 text-[24px] font-semibold uppercase leading-none tracking-[-0.05em] text-[#e8e8e8]">
                  {card.title}
                </h3>
                <p className="mt-4 text-[12px] leading-6 text-[#c2c2c2]">{card.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="tokenomics"
          className="mt-8 grid gap-8 rounded-[28px] border border-[#1a2d1d] bg-[linear-gradient(180deg,#09110b_0%,#050705_100%)] px-4 py-8 shadow-[0_18px_60px_rgba(0,0,0,0.25)] sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_340px]"
        >
          <div>
            <h2 className="max-w-[300px] text-[36px] font-semibold uppercase leading-[0.92] tracking-[-0.06em] text-[#ececec]">
              $CORTX TOKEN ECONOMY.
            </h2>

            <div className="mt-7 flex flex-col gap-4 sm:flex-row">
              <div className="min-w-[190px] rounded-[6px] border border-[#565656] bg-[#0f0f0f] px-5 py-5">
                <div className="text-[10px] uppercase tracking-[0.08em] text-[#d5d5d5]">Total Supply</div>
                <div className="mt-4 text-[24px] font-semibold leading-tight text-white">10,000,000,000</div>
                <div className="mt-1 text-[18px] font-semibold uppercase text-white">CORTX</div>
              </div>
              <div className="min-w-[190px] rounded-[6px] border border-[#d4b745] bg-[#0f0f0f] px-5 py-5">
                <div className="text-[10px] uppercase tracking-[0.08em] text-[#d5d5d5]">Network</div>
                <div className="mt-4 text-[24px] font-semibold leading-tight text-white">X Layer-</div>
                <div className="mt-1 text-[18px] font-semibold uppercase text-white">Integrated</div>
              </div>
            </div>

            <ul className="mt-8 space-y-4">
              {tokenUtilityItems.map((item) => {
                const [title, description] = item.split(" — ");
                return (
                  <li key={title} className="flex gap-3 text-[12px] leading-6 text-[#d0d0d0]">
                    <span className="mt-1 text-[#f0f0f0]">◉</span>
                    <span>
                      <span className="font-semibold uppercase text-white">{title}</span>
                      {` ${description}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex items-center justify-center">
            <div className="relative flex h-[320px] w-[320px] items-center justify-center rounded-full bg-[conic-gradient(#56ff26_0deg_40deg,#ecffcf_40deg_72deg,#c7ff53_72deg_118deg,#fed53f_118deg_160deg,#f0f0d7_160deg_208deg,#6cff28_208deg_245deg,#293b2a_245deg_270deg,#b8ff5f_270deg_312deg,#f5f6df_312deg_360deg)] shadow-[0_0_50px_rgba(0,0,0,0.35)]">
              <div className="absolute flex h-[210px] w-[210px] flex-col items-center justify-center rounded-full bg-[#111111] text-center shadow-[0_0_0_18px_rgba(17,17,17,1)]">
                <div className="text-[8px] uppercase tracking-[0.28em] text-[#8b8b8b]">Allocation</div>
                <div className="mt-3 text-[34px] font-semibold uppercase tracking-[-0.05em] text-white">CORTX</div>
              </div>
            </div>
          </div>
        </section>

        <section id="roadmap" className="px-2 py-16 sm:px-6 lg:px-12">
          <h2 className="text-center text-[38px] font-semibold uppercase leading-none tracking-[-0.06em] text-[#ececec] sm:text-[54px]">
            ROADMAP TO AUTONOMOUS DEFI.
          </h2>

          <div className="relative mx-auto mt-14 max-w-[720px]">
            <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-[linear-gradient(180deg,#1d3d1f_0%,#76ff62_50%,#1d3d1f_100%)] md:block" />

            <div className="space-y-14 md:space-y-0">
              {roadmapItems.map((item, index) => (
                <div
                  key={item.title}
                  className={`relative md:grid md:grid-cols-2 md:gap-12 ${index > 0 ? "md:mt-16" : ""}`}
                >
                  <div className={`${item.side === "left" ? "md:pr-12" : "md:col-start-2 md:pl-12"}`}>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f1f1f1]">
                      {item.quarter}
                    </div>
                    <h3 className="mt-3 text-[24px] font-semibold uppercase leading-none tracking-[-0.05em] text-white">
                      {item.title}
                    </h3>
                    <p className="mt-3 max-w-[260px] text-[12px] leading-6 text-[#bdbdbd]">
                      {item.description}
                    </p>
                  </div>

                  <div className="hidden md:block" />

                  <div className="absolute left-1/2 top-2 hidden h-3.5 w-3.5 -translate-x-1/2 rounded-full border border-[#7fff5a] bg-black shadow-[0_0_0_4px_rgba(57,93,48,0.45)] md:block" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-2 pb-16 sm:px-0">
          <div className="mx-auto max-w-[620px] rounded-[24px] border border-[#203120] bg-[linear-gradient(180deg,#070b07_0%,#0a0d0a_100%)] px-6 py-10 text-center shadow-[inset_0_0_0_1px_rgba(82,255,105,0.03)] sm:px-10 sm:py-14">
            <h2 className="text-[36px] font-semibold uppercase leading-[0.92] tracking-[-0.06em] text-[#ededed]">
              BUILD THE FUTURE WITH CORTEX.
            </h2>
            <p className="mx-auto mt-5 max-w-[420px] text-[13px] leading-6 text-[#d0d0d0]">
              Join the community and experience the first truly autonomous decentralized financial
              layer.
            </p>
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => void handleWalletAction()}
                disabled={isWalletActionPending}
                className="inline-flex min-w-[176px] items-center justify-center rounded-[6px] bg-[#5bff2f] px-6 py-4 text-[12px] font-medium uppercase tracking-[0.04em] text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isWalletActionPending
                  ? isConnected
                    ? "Disconnecting..."
                    : "Connecting..."
                  : mounted && isConnected && address
                    ? truncateAddress(address)
                    : "Connect Wallet"}
              </button>
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-[#0d180d] bg-[#0b0b0b] px-4 py-8 text-[#8f8f8f] sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[960px] flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[18px] font-semibold tracking-[-0.04em] text-white">Cortex</div>
            <p className="mt-2 max-w-[260px] text-[10px] leading-5 text-[#777777]">
              The first execution layer for autonomous agents, powered by decentralized intelligence.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-[10px] uppercase tracking-[0.08em]">
            <a href="#">X (Twitter)</a>
            <a href="#">Telegram</a>
            <a href="#">Discord</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>

          <div className="text-right text-[10px] uppercase tracking-[0.12em] text-[#6f6f6f]">
            <div>© 2026 Cortex Foundation. All Rights Reserved.</div>
            <div className="mt-2 text-[#d8d8d8]">Powered By X Layer</div>
          </div>
        </div>
      </footer>
    </main>
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
