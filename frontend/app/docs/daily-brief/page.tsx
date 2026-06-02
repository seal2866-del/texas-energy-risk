import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Energy Risk Brief Guide — TX Energy Risk Help Center",
  description: "How to read and act on the TX Energy Risk executive daily brief.",
};

function BriefSection({ label, what, action }: { label: string; what: string; action: string }) {
  return (
    <div className="p-5 rounded-2xl bg-white/3 border border-white/8 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-orange-400" />
        <h3 className="text-sm font-bold text-white">{label}</h3>
      </div>
      <div className="space-y-2">
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">What it contains</p>
          <p className="text-sm text-gray-300 leading-relaxed">{what}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">How executives use it</p>
          <p className="text-sm text-gray-300 leading-relaxed">{action}</p>
        </div>
      </div>
    </div>
  );
}

export default function DailyBriefGuide() {
  return (
    <div>
      <h1 className="text-3xl font-black text-white mb-2">Texas Energy Risk Brief</h1>
      <p className="text-gray-500 text-sm mb-8">The Energy Risk Brief is the executive-facing daily report. It synthesizes all platform intelligence into a structured, decision-ready format.</p>

      <section className="mb-8">
        <h2 className="text-xl font-black text-white mb-4 pb-2 border-b border-white/8">Overview</h2>
        <p className="text-sm text-gray-300 leading-relaxed mb-3">The brief is delivered automatically each morning at 7am CDT (Morning Digest subscribers) and is available on-demand via the Export Brief button on the dashboard. It is formatted for PDF distribution to leadership, board reporting, or regulatory documentation.</p>
        <div className="p-4 rounded-xl bg-teal-500/5 border border-teal-500/15">
          <p className="text-sm text-gray-300">The brief is designed to be read in under 3 minutes. Executives and directors should not need to open the dashboard to get full situational awareness — the brief provides it.</p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-black text-white mb-4 pb-2 border-b border-white/8">Brief Sections Explained</h2>

        <BriefSection
          label="Executive Summary"
          what="A plain-language 2–3 sentence synthesis of current conditions, risk level, and directional trend. Written for non-technical readers."
          action="Read first. If conditions are Low and stable, the brief can be filed. If Medium or High, continue to Current Risk Status and What Changed."
        />

        <BriefSection
          label="Current Risk Status"
          what="Risk level (Low / Medium / High), confidence score, primary driver, ERCOT price, weather conditions, and gas supply status — all in one view."
          action="Cross-reference with your existing energy reports. If TX Energy Risk shows Medium risk but your ETRM shows normal pricing, check the primary driver — it may be weather demand, not price, driving the signal."
        />

        <BriefSection
          label="What Changed"
          what="The delta from the previous assessment — which signals moved, in which direction, and by how much. Includes ERCOT price movement, weather forecast changes, and gas storage updates."
          action="The most time-efficient section. If nothing material changed, the brief can be filed quickly. Material changes warrant review of the Forecast section."
        />

        <BriefSection
          label="Forecast"
          what="The 0–6h, 6–24h, and 24–48h predictive outlook — risk trajectory, escalation probability, and the WHY / WHAT / WATCH / NEXT framework."
          action="Use the forecast to plan procurement timing. If the 6–24h outlook shows escalating conditions, avoid procurement windows that fall in that period unless current pricing is compelling."
        />

        <BriefSection
          label="Monitoring Priorities"
          what="The top 3 active signal channels, ranked by contribution to the risk score. Includes recommended monitoring actions for each."
          action="Assign each priority to a team member for the day. If Weather Demand is Priority 1, your operations manager should track the afternoon demand window. If ERCOT Pricing is Priority 1, your procurement team should be on standby."
        />

        <BriefSection
          label="Confidence Assessment"
          what="Data freshness and signal consistency across ERCOT, NOAA, and EIA. Includes any data quality flags or latency warnings."
          action="If confidence is below 70%, treat the brief as informational awareness, not actionable intelligence. Wait for conditions to update before making significant procurement or operational decisions."
        />
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-black text-white mb-4 pb-2 border-b border-white/8">Exporting the Brief</h2>
        <p className="text-sm text-gray-300 leading-relaxed">Click Export Brief on the dashboard to generate a PDF of the current moment's intelligence snapshot. The PDF includes all sections above plus timestamp, data source status, and compliance disclaimer. Use it for:</p>
        <ul className="mt-3 space-y-2 text-sm text-gray-400">
          {["Distribution to leadership via email", "Inclusion in operational morning reports", "Regulatory or compliance documentation", "Post-event analysis of what was known and when"].map(item => (
            <li key={item} className="flex items-start gap-2"><span className="text-orange-400 mt-1">•</span>{item}</li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3 mt-8">
        <Link href="/docs/workflow" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all">
          Daily Workflow <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
