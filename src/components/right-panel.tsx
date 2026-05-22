type Collectible = {
  id: string;
  name: string;
  series: string;
  value: string;
  accent: string;
};

type Trade = {
  id: string;
  time: string;
  action: "Buy" | "Sell";
  asset: string;
  price: string;
  tx: string;
};

const collectibles: Collectible[] = [
  {
    id: "crest-brazil",
    name: "National Team Crests - Brazil",
    series: "Crest Series",
    value: "148.50 USDT",
    accent: "bg-emerald-600",
  },
  {
    id: "crest-france",
    name: "National Team Crests - France",
    series: "Crest Series",
    value: "132.20 USDT",
    accent: "bg-zinc-700",
  },
  {
    id: "player-elite",
    name: "Premium Player Cards - Elite Selection",
    series: "Player Cards",
    value: "284.00 USDT",
    accent: "bg-zinc-900",
  },
  {
    id: "matchday-final",
    name: "Final Matchday Ticket - X Cup",
    series: "Matchday Access",
    value: "96.75 USDT",
    accent: "bg-zinc-500",
  },
  {
    id: "crest-argentina",
    name: "National Team Crests - Argentina",
    series: "Crest Series",
    value: "151.10 USDT",
    accent: "bg-sky-700",
  },
  {
    id: "keeper-legends",
    name: "Goalkeeper Legends - Clean Sheet Set",
    series: "Legends",
    value: "219.35 USDT",
    accent: "bg-zinc-800",
  },
];

const trades: Trade[] = [
  {
    id: "tx-001",
    time: "14:32:09",
    action: "Buy",
    asset: "Brazil Win Token",
    price: "1.084 USDT",
    tx: "0x4f8b2c19a0d7e35f6c91",
  },
  {
    id: "tx-002",
    time: "14:31:44",
    action: "Sell",
    asset: "France Crest NFT",
    price: "132.20 USDT",
    tx: "0xa93e11d70b6c42f9832a",
  },
  {
    id: "tx-003",
    time: "14:31:18",
    action: "Buy",
    asset: "Elite Player Card",
    price: "284.00 USDT",
    tx: "0x72bd9a3c6001f8e44d19",
  },
  {
    id: "tx-004",
    time: "14:30:52",
    action: "Sell",
    asset: "Argentina Crest NFT",
    price: "151.10 USDT",
    tx: "0x0cf281d54a99b72011ae",
  },
  {
    id: "tx-005",
    time: "14:30:26",
    action: "Buy",
    asset: "OKB",
    price: "47.62 USDT",
    tx: "0xe61a4097dd22f1b843aa",
  },
  {
    id: "tx-006",
    time: "14:29:58",
    action: "Buy",
    asset: "Final Matchday Ticket",
    price: "96.75 USDT",
    tx: "0xb88f012ca65de9b3007f",
  },
  {
    id: "tx-007",
    time: "14:29:31",
    action: "Sell",
    asset: "Goalkeeper Legends",
    price: "219.35 USDT",
    tx: "0x5c7d8a20e34f91bcd80e",
  },
  {
    id: "tx-008",
    time: "14:29:05",
    action: "Buy",
    asset: "Brazil Crest NFT",
    price: "148.50 USDT",
    tx: "0xd29039fae118c6070f44",
  },
];

export function RightPanel() {
  return (
    <aside className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:border-l">
      <div className="grid gap-3 p-3">
        <section className="border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              NFT Market
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              X Cup Collectibles
            </span>
          </div>
          <NFTGrid items={collectibles} />
        </section>

        <section className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              Recent Trades
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Live Activity
            </span>
          </div>
          <OrderBookTable rows={trades} />
        </section>
      </div>
    </aside>
  );
}

function NFTGrid({ items }: { items: Collectible[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.id}
          className="border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="aspect-square border border-zinc-200 bg-zinc-100 p-2 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex h-full items-center justify-center border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <div className={`size-10 rounded-full ${item.accent}`} />
            </div>
          </div>

          <div className="mt-2 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {item.series}
            </p>
            <h3 className="min-h-9 text-sm font-semibold leading-tight text-zinc-950 dark:text-zinc-50">
              {item.name}
            </h3>
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {item.value}
              </span>
              <button
                type="button"
                className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
              >
                Buy
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function OrderBookTable({ rows }: { rows: Trade[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-[88px_72px_minmax(180px,1fr)_112px_132px] border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <div className="px-3 py-1">Time</div>
          <div className="px-3 py-1">Action</div>
          <div className="px-3 py-1">Asset Name</div>
          <div className="px-3 py-1 text-right">Price</div>
          <div className="px-3 py-1">TX</div>
        </div>

        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[88px_72px_minmax(180px,1fr)_112px_132px] border-b border-zinc-100 text-xs text-zinc-700 last:border-b-0 dark:border-zinc-900 dark:text-zinc-300"
          >
            <div className="px-3 py-1 font-mono">{row.time}</div>
            <div
              className={`px-3 py-1 font-medium ${
                row.action === "Buy" ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {row.action}
            </div>
            <div className="truncate px-3 py-1">{row.asset}</div>
            <div className="px-3 py-1 text-right font-mono">{row.price}</div>
            <div className="truncate px-3 py-1 font-mono text-zinc-500 dark:text-zinc-400">
              {row.tx}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RightPanel;
