import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: "The Permian Basin Energy Risk Guide: Midland, Odessa, and West Texas | TX Energy Risk",
  description: "Energy risk in the Permian Basin operates differently than in Houston or Dallas. West Texas sits at the intersection of the world's most productive oil and gas basin and ERCOT's LZ_WEST load zone.",
  keywords: ["permian basin energy risk", "west Texas ERCOT", "Midland Odessa energy", "ERCOT LZ West", "Waha Hub natural gas", "LZ West risk monitoring"],
};

export default function Article() {
  return (
    <article>
      <div className="mb-2">
        <Link href="/blog" className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-6">
          <ArrowLeft className="w-3 h-3" />Back to Intelligence Library
        </Link>
        <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">ERCOT Intelligence</span>
      </div>
      <h1 className="text-3xl font-black text-white mb-4 leading-tight">The Permian Basin Energy Risk Guide: Midland, Odessa, and West Texas</h1>
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-8 pb-6 border-b border-white/8">
        <Calendar className="w-3 h-3" />
        <span>June 2026</span>
        <span>·</span>
        <span>TX Energy Risk Intelligence</span>
      </div>
      <div className="prose-dark">
      <h2 className="text-xl font-black text-white mt-10 mb-4 pb-2 border-b border-white/8">ERCOT's Western Load Zone (LZ_WEST)</h2>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">Midland, Odessa, and the broader Permian Basin are part of ERCOT's LZ_WEST load zone. This zone has distinct pricing characteristics compared to the Houston Hub (LZ_HOUSTON) or North zone (LZ_NORTH) where Dallas sits.</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">LZ_WEST prices can diverge significantly from the state-wide average during renewable curtailment periods, transmission constraints, and summer demand peaks. West Texas temperatures regularly reach 105–110°F. Industrial and oilfield operations in the region drive significant electricity demand that, when combined with transmission constraints, can push LZ_WEST prices well above the Houston Hub.</p>

      <h2 className="text-xl font-black text-white mt-10 mb-4 pb-2 border-b border-white/8">The Waha Hub Factor</h2>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">The Waha Hub is the primary natural gas trading point for Permian Basin production. Waha pricing is critical for Midland and Odessa energy costs because local gas-fired generation uses Waha-priced gas, not Henry Hub.</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">Waha can trade at significant discounts to Henry Hub when Permian production exceeds pipeline takeaway capacity, or at premiums during winter weather events that compress supply. The most extreme Waha basis events have seen West Texas natural gas trading at -$5 to -$10/MMBtu below Henry Hub — a condition that actually pressures some generators to curtail, tightening West Texas power supply.</p>

      <h2 className="text-xl font-black text-white mt-10 mb-4 pb-2 border-b border-white/8">Oilfield Operations and Energy Intensity</h2>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">The Permian Basin's energy intensity makes grid risk uniquely important. Upstream oil and gas operations — drilling, completions, water handling, gas compression — are among the most electricity-intensive industrial processes in Texas.</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">Unlike commercial buildings that can reduce demand overnight, oilfield operations typically run continuously. Reserve margin compression during peak hours directly affects operating costs without flexibility to defer.</p>

      <h2 className="text-xl font-black text-white mt-10 mb-4 pb-2 border-b border-white/8">Monitoring West Texas Grid Risk</h2>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">TX Energy Risk monitors energy risk for both Midland and Odessa — the two primary cities in the Permian Basin — providing real-time ERCOT risk scores, NOAA weather demand tracking, and Henry Hub and Waha-correlated gas cost signals.</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">Operations managers in the Permian Basin can track grid risk alongside the rest of their Texas monitoring — with alerts configured for the conditions that matter most to their specific exposure.</p>

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
