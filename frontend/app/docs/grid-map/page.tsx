import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: "Grid Map Guide — TX Energy Risk Help Center",
  description: "Understanding the Texas ERCOT zone risk map across 8 monitored cities.",
};

const CITIES = [
  { name: "Houston", zone: "LZ_HOUSTON", note: "Texas's largest energy market. Highest demand density. Primary benchmark for ERCOT HB_HOUSTON pricing. Summer heat events in Houston drive state-wide grid stress." },
  { name: "Dallas", zone: "LZ_NORTH", note: "Second-largest Texas energy market. North zone pricing can diverge from Houston during transmission constraint events. Industrial and commercial load concentration." },
  { name: "Austin", zone: "LZ_SOUTH", note: "South zone. Moderate demand. State capital with growing data center and tech sector load. Weather patterns differ from coastal cities." },
  { name: "San Antonio", zone: "LZ_SOUTH", note: "South zone alongside Austin. Military and industrial load base. Extreme summer heat events can create localized demand spikes." },
  { name: "Midland", zone: "LZ_WEST", note: "Permian Basin hub. Oil and gas operational load dominates. LZ_WEST pricing affected by transmission constraints and high wind generation output from West Texas." },
  { name: "Odessa", zone: "LZ_WEST", note: "Permian Basin operations center. Similar exposure to Midland. Waha Hub natural gas pricing is more relevant than Henry Hub for direct gas users in this zone." },
  { name: "Corpus Christi", zone: "LZ_SOUTH", note: "Coastal location. Petrochemical and refining complex creates significant industrial load. Gulf weather patterns create distinct risk profiles from inland cities." },
  { name: "Lubbock", zone: "LZ_WEST", note: "West Texas. High proximity to wind generation. LZ_WEST prices can see large negative swings during high wind / low demand periods — a cost opportunity for flexible load operators." },
];

export default function GridMapGuide() {
  return (
    <div>
      <h1 className="text-3xl font-black text-white mb-2">Grid Map Guide</h1>
      <p className="text-gray-500 text-sm mb-8">How to read risk indicators, confidence levels, trend analysis, and primary drivers across all 8 monitored Texas cities.</p>

      <section className="mb-10">
        <h2 className="text-xl font-black text-white mb-4 pb-2 border-b border-white/8">Reading the Risk Map</h2>
        <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
          <p>The Texas Grid Map shows real-time operational risk for each of the 8 monitored cities. Each city card displays four key indicators:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Risk Level", desc: "Low / Medium / High — the composite risk score for that city based on weather, ERCOT pricing, and gas supply signals." },
              { label: "Risk Direction", desc: "Whether conditions are escalating, stable, or improving. An upward arrow indicates building pressure even at the same risk level." },
              { label: "Primary Driver", desc: "The dominant factor driving the current risk score — typically Weather Demand, ERCOT Pricing, or Gas Supply." },
              { label: "Confidence", desc: "Data freshness for that city's signal set. Cities with fresh NOAA data and recent ERCOT readings show higher confidence." },
            ].map(({ label, desc }) => (
              <div key={label} className="p-4 rounded-xl bg-white/3 border border-white/8">
                <p className="text-sm font-semibold text-white mb-1">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-black text-white mb-4 pb-2 border-b border-white/8">Statewide Summary</h2>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">At the top of the Grid Map, the Statewide Summary aggregates conditions across all 8 cities:</p>
        <div className="space-y-3">
          {[
            { label: "High Risk Count", desc: "Number of cities currently at High risk. Two or more cities at High risk signals a broad state-wide event — not a localized condition." },
            { label: "Statewide Status", desc: "A roll-up status: Elevated (2+ cities High), Watch (1 city High or 2+ Medium), or Normal." },
            { label: "Worst Location", desc: "The city with the most severe current conditions. Use this to focus your monitoring attention during complex events." },
          ].map(({ label, desc }) => (
            <div key={label} className="flex gap-3">
              <MapPin className="w-4 h-4 text-orange-400 flex-shrink-0 mt-1" />
              <div>
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-black text-white mb-4 pb-2 border-b border-white/8">City-by-City Reference</h2>
        <div className="space-y-4">
          {CITIES.map(({ name, zone, note }) => (
            <div key={name} className="p-4 rounded-xl bg-white/3 border border-white/8">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-sm font-bold text-white">{name}</h3>
                <span className="text-[10px] font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded">{zone}</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{note}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3 mt-8">
        <Link href="/docs/analytics" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all">
          Analytics Guide <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
