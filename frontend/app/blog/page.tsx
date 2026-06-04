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
  { slug: "texas-energy-alerts-setup",             title: "How to Set Up Texas Energy Alerts for Your Facility",                                    date: "June 2026", category: "Operations & Procurement",   desc: "For Texas facilities and operations teams, the challenge is not finding energy data — it is knowing when to act on it. A real-time alert system that fires at the right moment, for the right conditions, is worth more than any dashboard that requires manual checking." },
  { slug: "ercot-reserve-margin-explained",        title: "ERCOT Reserve Margin Explained: What It Is and Why It Matters for Texas Operations",     date: "June 2026", category: "ERCOT Intelligence",         desc: "The ERCOT reserve margin is one of the most important — and most misunderstood — indicators in Texas energy markets. It tells you how much generation capacity the grid has available above peak demand, and it is a leading indicator of both price volatility and reliability risk." },
  { slug: "texas-winter-energy-risk",              title: "Texas Winter Energy Risk: Lessons from Grid Events and What to Monitor",                  date: "June 2026", category: "ERCOT Intelligence",         desc: "Texas winters create a different kind of energy risk than summer heat events. While summer risk is predictable and demand-driven, winter risk comes from unexpected demand surges and generation failures on the coldest days of the year." },
  { slug: "natural-gas-storage-ercot",             title: "Natural Gas Storage and ERCOT Prices: The Connection Texas Operators Need to Understand", date: "June 2026", category: "Natural Gas Intelligence",   desc: "Natural gas powers more than 40 percent of Texas electricity generation. When gas storage tightens or supply becomes constrained, the cost of generating power in Texas increases directly — and ERCOT prices follow." },
  { slug: "houston-energy-procurement-guide",      title: "Houston Energy Procurement Guide: Managing ERCOT Exposure for Industrial Buyers",        date: "June 2026", category: "Operations & Procurement",   desc: "For large industrial energy buyers in Houston, the decision between fixed-price and index contracts is one of the most consequential energy decisions a procurement team makes. Understanding ERCOT market conditions at the time of contracting determines whether a facility overpays or captures below-market pricing." },
  { slug: "ercot-price-forecast-week",             title: "How to Read the ERCOT Price Forecast for the Week Ahead",                                date: "June 2026", category: "ERCOT Intelligence",         desc: "ERCOT does not publish a single, authoritative price forecast. Instead, understanding what prices are likely to do in the coming week requires synthesizing several inputs: weather forecasts, demand outlooks, generation availability, and recent price behavior." },
  { slug: "data-center-texas-energy-risk",         title: "Texas Data Center Energy Risk: Managing ERCOT Exposure for Colocation and Hyperscale",   date: "June 2026", category: "Operations & Procurement",   desc: "Texas has become one of the fastest-growing data center markets in the United States. But unlike regulated utility markets in other states, ERCOT's real-time wholesale market creates unique power cost risks for data center operators." },
  { slug: "ercot-demand-response-operations",      title: "ERCOT Demand Response for Operations Teams: What It Is and When It Helps",               date: "June 2026", category: "Operations & Procurement",   desc: "ERCOT demand response programs allow large industrial customers to reduce electricity consumption during grid stress events in exchange for payments. Understanding when these programs activate — and how to monitor the conditions that trigger them — is valuable for Texas operations teams." },
  { slug: "midland-odessa-energy-outlook",         title: "Midland-Odessa Energy Outlook: Permian Basin Grid Conditions and Operational Risk",       date: "June 2026", category: "ERCOT Intelligence",         desc: "The Permian Basin's explosive growth in oil and gas production has fundamentally changed the energy landscape in West Texas. Midland and Odessa now sit at the center of one of the most dynamic and rapidly evolving electricity market regions in the United States." },
  { slug: "henry-hub-price-monitor-guide",         title: "How to Monitor Henry Hub Prices for Texas Operations",                                    date: "June 2026", category: "Natural Gas Intelligence",   desc: "Henry Hub is the most widely referenced natural gas price benchmark in North America. For Texas operations teams, understanding how to monitor Henry Hub — and what price levels matter for different operation types — is fundamental to managing energy cost exposure." },
  { slug: "ercot-congestion-guide",                title: "ERCOT Congestion Monitoring: What Transmission Constraints Mean for Texas Operations",    date: "June 2026", category: "ERCOT Intelligence",         desc: "ERCOT transmission congestion occurs when the grid cannot move power from where it is generated to where it is needed. When congestion occurs, prices in different load zones can diverge significantly — creating both risks and opportunities for Texas energy buyers." },
  { slug: "texas-grid-reliability-outlook",        title: "Texas Grid Reliability Outlook: What Operations Teams Need to Know",                      date: "June 2026", category: "ERCOT Intelligence",         desc: "Texas grid reliability — the ability of ERCOT to serve all demand without emergency conditions — is determined by the balance between available generation capacity and peak demand. Understanding the factors that affect this balance is essential for operations teams planning around potential disruptions." },
  { slug: "energy-procurement-best-practices",     title: "Energy Procurement Best Practices for Texas Industrial Facilities",                        date: "June 2026", category: "Operations & Procurement",   desc: "Energy procurement in Texas is more complex — and more consequential — than in regulated utility markets in other states. The combination of ERCOT's competitive market structure, extreme weather events, and direct pass-through pricing means that procurement decisions have significant multi-year financial implications." },
  { slug: "weather-demand-risk-texas",             title: "Weather Demand Risk in Texas: How Temperature Drives ERCOT Prices",                       date: "June 2026", category: "Weather Risk Intelligence",   desc: "No single factor drives ERCOT price volatility more consistently than weather. Texas extreme temperatures — both summer heat and winter cold — create demand surges that can push electricity prices from single-digit levels to hundreds or thousands of dollars per megawatt-hour within hours." },
  { slug: "operational-energy-intelligence",       title: "What Is Operational Energy Intelligence and Why Does It Matter?",                          date: "June 2026", category: "Operations & Procurement",   desc: "Most energy dashboards show you data. Operational energy intelligence is different — it tells you what that data means for your operations, what conditions deserve attention, and when conditions have changed enough to warrant action." },
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
