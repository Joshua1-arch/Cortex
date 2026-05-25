type StoryItem = {
  id: string;
  title: string;
  value: string;
  accent: string;
  detail: string;
};

type Trade = {
  id: string;
  time: string;
  action: "Mint" | "Claim" | "Swap";
  asset: string;
  price: string;
  tx: string;
};

const storyItems: StoryItem[] = [
  {
    id: "admin-create",
    title: "Admin creates the match NFT",
    value: "/agents control",
    accent: "bg-emerald-600",
    detail: "Admins publish the match, teams, price, reward, and flag artwork that becomes the minted NFT metadata.",
  },
  {
    id: "user-mint",
    title: "User mints one pick per match",
    value: "Approval + mint",
    accent: "bg-zinc-700",
    detail: "Users approve the quote token, choose the winner once, and mint exactly one prediction NFT for that match.",
  },
  {
    id: "admin-resolve",
    title: "Admin resolves the result",
    value: "Resolved winner",
    accent: "bg-zinc-900",
    detail: "Resolution locks the winning team and unlocks reward claims for wallets whose NFT pick matches the result.",
  },
  {
    id: "claim-swap",
    title: "Claim and swap reward",
    value: "COR / OKB out",
    accent: "bg-zinc-500",
    detail: "Winning minters claim COR from the same marketplace flow and can still route value through the live swap experience.",
  },
];

const trades: Trade[] = [
  {
    id: "tx-001",
    time: "14:32:09",
    action: "Mint",
    asset: "Brazil vs France - Match NFT",
    price: "10.00 COR",
    tx: "0x4f8b2c19a0d7e35f6c91",
  },
  {
    id: "tx-002",
    time: "14:31:44",
    action: "Claim",
    asset: "Semifinal reward",
    price: "18.00 COR",
    tx: "0xa93e11d70b6c42f9832a",
  },
  {
    id: "tx-003",
    time: "14:31:18",
    action: "Swap",
    asset: "Final reward exit",
    price: "7.20 OKB",
    tx: "0x72bd9a3c6001f8e44d19",
  },
];

export function RightPanel() {
  return (
    <aside className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:border-l">
      <div className="grid gap-3 p-3">
        <section className="border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Prediction Story</h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Admin-managed flow</span>
          </div>
          <StoryGrid items={storyItems} />
        </section>

        <section className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Recent Prediction Activity</h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Live execution</span>
          </div>
          <OrderBookTable rows={trades} />
        </section>
      </div>
    </aside>
  );
}

function StoryGrid({ items }: { items: StoryItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2 xl:grid-cols-2">
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
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{item.value}</p>
            <h3 className="min-h-9 text-sm font-semibold leading-tight text-zinc-950 dark:text-zinc-50">{item.title}</h3>
            <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">{item.detail}</p>
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
          <div className="px-3 py-1 text-right">Amount</div>
          <div className="px-3 py-1">TX</div>
        </div>

        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[88px_72px_minmax(180px,1fr)_112px_132px] border-b border-zinc-100 text-xs text-zinc-700 last:border-b-0 dark:border-zinc-900 dark:text-zinc-300"
          >
            <div className="px-3 py-1 font-mono">{row.time}</div>
            <div className="px-3 py-1 font-medium text-emerald-600">{row.action}</div>
            <div className="truncate px-3 py-1">{row.asset}</div>
            <div className="px-3 py-1 text-right font-mono">{row.price}</div>
            <div className="truncate px-3 py-1 font-mono text-zinc-500 dark:text-zinc-400">{row.tx}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RightPanel;
