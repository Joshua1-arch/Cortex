export function LeftPanel({ isConnected }: { isConnected: boolean }) {
  return (
    <aside className="border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex items-center justify-between border-b border-zinc-200 pb-2 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          Execution
        </h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {isConnected ? "Wallet Ready" : "Disconnected"}
        </span>
      </div>

      <div className="grid gap-3">
        <div>
          <label
            htmlFor="intent"
            className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
          >
            AI Intent
          </label>
          <textarea
            id="intent"
            rows={5}
            defaultValue="Swap 50 USDT for an X-Cup Brazil NFT"
            className="w-full resize-none border border-zinc-200 bg-zinc-50 p-2 text-sm text-zinc-950 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <button
          type="button"
          className="rounded bg-zinc-900 px-4 py-1.5 text-sm font-medium text-zinc-50"
        >
          Execute via Agent
        </button>

        <div className="border border-zinc-200 dark:border-zinc-800">
          <div className="border-b border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-950 dark:border-zinc-800 dark:text-zinc-50">
            Swap
          </div>
          <div className="grid gap-2 p-3">
            <div className="flex items-center justify-between bg-zinc-50 p-2 text-sm dark:bg-zinc-900">
              <span className="text-zinc-500 dark:text-zinc-400">Pay</span>
              <span className="font-medium text-zinc-950 dark:text-zinc-50">
                50 USDT
              </span>
            </div>
            <div className="flex items-center justify-between bg-zinc-50 p-2 text-sm dark:bg-zinc-900">
              <span className="text-zinc-500 dark:text-zinc-400">Receive</span>
              <span className="font-medium text-zinc-950 dark:text-zinc-50">
                Brazil Win Token
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <span className="font-medium text-zinc-950 dark:text-zinc-50">
            Paymaster: Sponsor Gas (USDT)
          </span>
          <span className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-zinc-50">
            On
          </span>
        </div>
      </div>
    </aside>
  );
}

export default LeftPanel;
