import { AdminMatchCreator } from "@/components/dashboard/admin-match-creator";
import { AdminMatchSettlements } from "@/components/dashboard/admin-match-settlements";

export default function AdminMatchesPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 sm:gap-8">
      <AdminMatchCreator />
      <AdminMatchSettlements />
    </div>
  );
}
