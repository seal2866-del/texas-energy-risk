import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: "Texas Energy Risk Intelligence Blog",
  description: "ERCOT market analysis, natural gas intelligence, weather demand risk, and operational procurement insights for Texas energy teams.",
  keywords: ["ERCOT risk management blog", "Texas energy intelligence", "energy procurement risk articles", "natural gas market intelligence Texas"],
};

const POSTS = [
  { slug: "ercot-price-spikes",            title: "ERCOT Price Spikes: What Causes Them and How to See Them Coming",             date: "June 2026", category: "ERCOT Intelligence",         desc: "Texas operates the most volatile wholesale electricity market in the US. Understanding what drives ERCOT price spikes — and what to watch before they happen — is the difference between reacting to a cost surprise and managing your exposure in advance." },
  { slug: "texas-summer-energy-risk",       title: "Texas Energy Risk in Summer: The 3 Signals That Matter",                       date: "June 2026", category: "Weather Risk Intelligence",   desc: "Three signals consistently determine whether a summer day in Texas will be expensive or routine. Heat persistence pattern, ERCOT reserve margin, and the gas-to-power cost floor — monitored together, they provide 48-72 hours of advance warning." },
  { slug: "henry-hub-ercot",                title: "Henry Hub vs ERCOT: How Natural Gas Prices Drive Texas Electricity Costs",     date: "June 2026", category: "Natural Gas Intelligence",   desc: "If you are monitoring Texas energy costs, watching ERCOT prices alone only tells half the story. The other half is Henry Hub — the natural gas benchmark that sets the marginal cost of electricity generation across Texas." },
  { slug: "permian-basin-energy-risk",      title: "The Permian Basin Energy Risk Guide: Midland, Odessa, and West Texas",         date: "June 2026", category: "ERCOT Intelligence",         desc: "Energy risk in the Permian Basin operates differently than in Houston or Dallas. West Texas sits at the intersection of the world's most productive oil and gas basin and one of the most dynamic electricity markets in North America." },
  { slug: "texas-energy-alerts-setup",      title: "How to Set Up Texas Energy Alerts for Your Facility",                          date: "June 2026", category: "Operations & Procurement",   desc: "For Texas facilities and operations teams, the challenge is not finding energy data — it is knowing when to act on it. A real-time alert system that fires at the right moment, for the right conditions, is worth more than any dashboard that requires manual checking." },
];

const CAT_COLORS: Record<string, string> = {
  "ERCOT Intelligence":       "text-orange-400 bg-orange-500/10 border-orange-500/20",
  "Weather Risk Intelligence": "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "Natural Gas Intelligence":  "text-red-400 bg-red-500/10 border-red-500/20",
  "Operations & Procurement":  "text-teal-400 bg-teal-500/10 border-teal-500/20",
};

export default function BlogIndex() {
  return (
    <div>
      <div className="mb-10">
        <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-2">TX Energy Risk</p>
        <h1 className="text-3xl font-black text-white mb-3">Texas Energy Risk Intelligence</h1>
        <p className="text-gray-400 text-sm leading-relaxed max-w-xl">
          ERCOT market analysis, natural gas intelligence, weather demand risk, and operational procurement guidance for Texas energy teams.
        </p>
      </div>
      <div className="space-y-4">
        {POSTS.map(({ slug, title, date, category, desc }) => (
          <Link key={slug} href={`/blog/${slug}`}
            className="group block p-6 rounded-2xl bg-white/3 border border-white/8 hover:border-orange-500/25 hover:bg-orange-500/5 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${CAT_COLORS[category] ?? "text-gray-400 bg-white/5 border-white/10"}`}>{category}</span>
              <span className="flex items-center gap-1 text-[11px] text-gray-600"><Calendar className="w-3 h-3" />{date}</span>
            </div>
            <h2 className="text-base font-bold text-white mb-2 group-hover:text-orange-300 transition-colors leading-snug">{title}</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-3">{desc}</p>
            <span className="flex items-center gap-1 text-xs text-orange-400 font-semibold">Read article <ArrowRight className="w-3 h-3" /></span>
          </Link>
        ))}
      </div>
      <div className="mt-10 p-4 rounded-xl bg-white/3 border border-white/5 text-center">
        <p className="text-xs text-gray-500">All content is informational only and does not constitute investment, trading, or procurement advice.</p>
      </div>
    </div>
  );
}
