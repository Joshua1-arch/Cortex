import { RecentActivityTable } from "@/components/dashboard/recent-activity-table";
import { SwapCard } from "@/components/dashboard/swap-card";

export default function TradePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <SwapCard />
      <RecentActivityTable />
    </div>
  );
}
