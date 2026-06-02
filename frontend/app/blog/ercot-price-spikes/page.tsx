import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: "ERCOT Price Spikes: What Causes Them and How to See Them Coming | TX Energy Risk",
  description: "Texas ERCOT power prices can spike from $30 to $5,000/MWh during scarcity events. Learn the three conditions that consistently precede major ERCOT price events and how to monitor them.",
  keywords: ["ERCOT price spike", "Texas electricity spike", "ERCOT scarcity pricing", "ERCOT price volatility", "Texas grid stress"],
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
      <h1 className="text-3xl font-black text-white mb-4 leading-tight">ERCOT Price Spikes: What Causes Them and How to See Them Coming</h1>
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-8 pb-6 border-b border-white/8">
        <Calendar className="w-3 h-3" />
        <span>June 2026</span>
        <span>·</span>
        <span>TX Energy Risk Intelligence</span>
      </div>
      <div className="prose-dark">
      <h2 className="text-xl font-black text-white mt-10 mb-4 pb-2 border-b border-white/8">What Causes ERCOT Price Spikes?</h2>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">Texas operates the most volatile wholesale electricity market in the United States. Unlike other regulated markets with price caps that limit exposure, ERCOT allows prices to reach $5,000 per MWh during scarcity events — creating real operational cost risk for industrial users, facilities managers, and energy procurement teams.</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">ERCOT power prices are driven by the balance between supply and demand at any given moment. When demand exceeds available supply — or when available supply tightens — settlement point prices rise, sometimes dramatically. Three conditions consistently precede major ERCOT price events.</p>

      <h2 className="text-xl font-black text-white mt-10 mb-4 pb-2 border-b border-white/8">1. Weather-Driven Demand Surges</h2>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">Texas summers generate the highest grid demand in North America. When Houston forecast highs exceed 100°F and overnight lows stay above 78°F, residential and commercial cooling loads push system-wide demand toward peak capacity. ERCOT's generation reserve margin — the buffer between available supply and peak demand — compresses, and prices begin to climb.</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">The risk is compounded when heat persists over multiple days without overnight cooling relief. Extended high-demand periods drain the reserve margin and raise the probability of pricing above $100, $500, or higher.</p>

      <h2 className="text-xl font-black text-white mt-10 mb-4 pb-2 border-b border-white/8">2. Unexpected Generation Outages</h2>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">Thermal generation — natural gas, coal, and nuclear — is subject to unplanned outages. When large plants trip offline during high-demand periods, available supply drops suddenly. ERCOT's real-time market responds within minutes: prices spike as the system calls on increasingly expensive peaker units to maintain balance.</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">Winter events add a different dimension. February 2021's Winter Storm Uri disabled gas-fired generation across Texas when extreme cold froze gas wellheads and pipelines — simultaneously driving demand to record levels while collapsing supply.</p>

      <h2 className="text-xl font-black text-white mt-10 mb-4 pb-2 border-b border-white/8">3. Natural Gas Supply Constraints</h2>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">Gas-fired generation produces more than 50% of Texas electricity in summer. When Henry Hub natural gas prices rise — or when supply disruptions tighten pipeline availability — the marginal cost of generation increases across the stack. ERCOT prices follow.</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">EIA weekly storage data and Henry Hub spot pricing are leading indicators of fuel-side pressure. When storage falls significantly below the 5-year average and prices climb above $4/MMBtu, gas-to-power cost pressure begins showing up in ERCOT settlement prices.</p>

      <h2 className="text-xl font-black text-white mt-10 mb-4 pb-2 border-b border-white/8">The Warning Signs Before a Price Spike</h2>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">72–96 hours before: NOAA weather forecasts showing extended high temperatures (100°F+) in Houston or Dallas. Multiple consecutive hot days with weak overnight cooling are the highest-risk pattern.</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">24–48 hours before: ERCOT publishes its day-ahead operating reserve shortage reports. When reserve margins forecast below 10.5GW, scarcity pricing becomes increasingly likely.</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">Same day: Real-time HB_HOUSTON settlement prices begin moving above $50–75/MWh during mid-morning hours as early demand builds. Prices above $100/MWh by noon are a strong indicator of afternoon scarcity risk.</p>

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
