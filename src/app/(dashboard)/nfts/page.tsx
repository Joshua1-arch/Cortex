import { NFTMarket } from "@/components/dashboard/nft-market";
import { NFTMarketHero } from "@/components/dashboard/nft-market-hero";

export default function NFTsPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 sm:gap-8">
      <NFTMarketHero />
      <NFTMarket />
    </div>
  );
}
