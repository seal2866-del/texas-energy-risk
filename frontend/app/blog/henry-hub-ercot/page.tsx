import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: "Henry Hub vs ERCOT: How Natural Gas Prices Drive Texas Electricity Costs | TX Energy Risk",
  description: "If you are monitoring Texas energy costs, watching ERCOT prices alone only tells half the story. Henry Hub natural gas pricing sets the marginal cost of electricity generation across Texas.",
  keywords: ["henry hub ERCOT correlation", "gas-to-power Texas", "natural gas electricity Texas", "henry hub price monitor", "Texas energy cost natural gas"],
};

export default function Article() {
  return (
    <article>
      <div className="mb-2">
        <Link href="/blog" className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-6">
          <ArrowLeft className="w-3 h-3" />Back to Intelligence Library
        </Link>
        <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Natural Gas Intelligence</span>
      </div>
      <h1 className="text-3xl font-black text-white mb-4 leading-tight">Henry Hub vs ERCOT: How Natural Gas Prices Drive Texas Electricity Costs</h1>
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-8 pb-6 border-b border-white/8">
        <Calendar className="w-3 h-3" />
        <span>June 2026</span>
        <span>·</span>
        <span>TX Energy Risk Intelligence</span>
      </div>
      <div className="prose-dark">
      <h2 className="text-xl font-black text-white mt-10 mb-4 pb-2 border-b border-white/8">Why Natural Gas Sets Texas Electricity Prices</h2>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">ERCOT's electricity market clears on a marginal cost basis. In simple terms: the price of electricity in Texas is determined by the cost of producing the last unit of electricity needed to meet demand.</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">In Texas, that last unit is almost always gas-fired generation. Natural gas plants produce approximately 50–60% of Texas electricity on a typical summer day, and they set the marginal clearing price for the rest of the market.</p>

      <h2 className="text-xl font-black text-white mt-10 mb-4 pb-2 border-b border-white/8">The Henry Hub Price Monitor: What Texas Teams Watch</h2>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">Spot price: The daily Henry Hub spot price at the NYMEX settlement is the most immediate indicator of gas cost pressure. Prices above $4/MMBtu signal watch-level conditions. Above $6/MMBtu, Texas energy cost pressure becomes significant.</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">Weekly storage reports: EIA publishes natural gas storage data every Thursday. When working gas in storage falls more than 10% below the 5-year average, it signals that supply is tighter than normal — a condition that supports elevated prices for weeks or months.</p>

      <h2 className="text-xl font-black text-white mt-10 mb-4 pb-2 border-b border-white/8">Gas-to-Power Risk in the Permian Basin</h2>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">West Texas — Midland, Odessa, and the Permian Basin — faces a specific version of this risk. Waha Hub natural gas in West Texas has historically traded at a discount to Henry Hub due to pipeline takeaway constraints. But in periods of high demand or when export capacity is constrained, Waha can trade at parity or premium — directly affecting power generation costs in ERCOT's western load zone.</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">Operations in Midland and Odessa exposed to real-time ERCOT pricing should monitor both Henry Hub and Waha basis alongside LZ_WEST settlement prices.</p>

      <h2 className="text-xl font-black text-white mt-10 mb-4 pb-2 border-b border-white/8">The Combined Risk Scenario</h2>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">The highest-risk condition for Texas energy costs is the intersection of: extended heat above 100°F, elevated Henry Hub above $4/MMBtu, below-average EIA storage, and compressed ERCOT reserve margins below 8GW.</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">This quadruple pressure scenario has historically corresponded with ERCOT prices above $200/MWh in the Houston Hub. It is the scenario that energy procurement teams prepare for — and operations directors need early warning about.</p>

      </div>
      <div className="mt-10 pt-6 border-t border-white/8">
        <p className="text-xs text-gray-600 leading-relaxed mb-6">TX Energy Risk provides operational intelligence and situational awareness only. This article does not constitute investment, trading, financial, legal, or procurement advice.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all">
            View Live Risk Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/blog" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-semibold text-sm transition-all">
            More Articles
          </Link>
        </div>
      </div>
    </article>
  );
}
