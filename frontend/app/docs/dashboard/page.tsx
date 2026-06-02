import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard Guide — TX Energy Risk Help Center",
  description: "Every major dashboard component explained for energy teams.",
};

function ComponentCard({ title, what, why, how }: { title: string; what: string; why: string; how: string }) {
  return (
    <div className="p-5 rounded-2xl bg-white/3 border border-white/8 space-y-3 mb-5">
      <h3 className="text-base font-bold text-white">{title}</h3>
      <div>
        <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">What it means</p>
        <p className="text-sm text-gray-300 leading-relaxed">{what}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold text-teal-400 uppercase tracking-widest mb-1">Why it matters</p>
        <p className="text-sm text-gray-300 leading-relaxed">{why}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">How to interpret it</p>
        <p className="text-sm text-gray-300 leading-relaxed">{how}</p>
      </div>
    </div>
  );
}

export default function DashboardGuide() {
  return (
    <div>
      <h1 className="text-3xl font-black text-white mb-2">Dashboard Guide</h1>
      <p className="text-gray-500 text-sm mb-8">Every major dashboard component explained — what it means, why it matters, and how to act on it.</p>

      <ComponentCard
        title="Current Risk Level (Low / Medium / High)"
        what="The composite operational risk score synthesized from ERCOT pricing conditions, weather demand signals, and natural gas supply data. Updated every 5 minutes."
        why="A single actionable indicator that eliminates the need to monitor three separate data sources. When risk escalates, your team needs one clear signal, not a spreadsheet."
        how="Low: Standard monitoring. No immediate action required. Medium: Elevated conditions. Review the Executive Recommendation and consider procurement or operational adjustments. High: Significant conditions detected. Immediate awareness recommended. Check Monitoring Priorities and act on the Executive Recommendation."
      />

      <ComponentCard
        title="Executive Recommendation"
        what="A plain-language summary of current conditions and suggested operational posture, synthesized by the AI reasoning engine from all active signal channels."
        why="Executives and operations managers need context and direction, not raw data. The recommendation translates market signals into operational language your team can act on."
        how="Read the recommendation in conjunction with the Confidence Score. Higher confidence recommendations reflect more consistent signals across ERCOT, weather, and gas channels. Lower confidence indicates mixed or incomplete data — use judgment accordingly."
      />

      <ComponentCard
        title="Operational Cost Impact"
        what="An assessment of current energy cost exposure based on ERCOT pricing, Henry Hub natural gas levels, and weather-driven demand pressure."
        why="Operational teams need to understand not just risk level, but the potential cost implications of current conditions — particularly for facilities with direct pass-through energy contracts."
        how="Minimal Impact: Standard pricing conditions. No unusual cost pressure expected. Moderate Impact: Elevated pricing or supply pressure. Monitor procurement windows closely. Significant Impact: Material cost pressure conditions. Escalate to procurement and operations leadership."
      />

      <ComponentCard
        title="Scenario Modeling"
        what="Six pre-built operational scenarios that model how current conditions could escalate — including probability estimates and recommended responses for each."
        why="Risk management requires thinking ahead. Scenarios help teams pre-plan responses to conditions before they materialize, reducing reaction time when events occur."
        how="Review the highest-probability scenarios during Medium and High risk periods. Use the recommended actions as a starting point for your team's response playbook. Low-probability scenarios are informational — monitor but do not over-respond."
      />

      <ComponentCard
        title="Risk Escalation Probability"
        what="A quantitative estimate of the probability that current conditions escalate to a higher risk level within the next 6 hours, expressed as a percentage."
        why="Directional awareness — knowing not just where conditions are, but where they are trending — is critical for procurement timing and operational planning."
        how="Below 25%: Low escalation probability. Standard monitoring. 25–50%: Moderate escalation probability. Heightened awareness recommended. Review monitoring priorities. Above 50%: High escalation probability. Proactive response warranted. Check alert settings and notify relevant teams."
      />

      <ComponentCard
        title="Monitoring Priorities"
        what="The top 3 active signal channels driving the current risk assessment, ranked by contribution to the overall risk score."
        why="When multiple signals are active, Monitoring Priorities tells you which factors are most material to current conditions — preventing attention from being spread too thin."
        how="Focus response and monitoring attention on the top 1–2 priorities. If ERCOT Pricing is the primary driver, focus on procurement windows. If Weather Demand is primary, focus on grid load pressure timing."
      />

      <ComponentCard
        title="Confidence Score"
        what="A measure of data freshness and signal consistency across the three data sources. Expressed as a percentage from 0–100%."
        why="Not all risk assessments are equal. A 90% confidence High risk signal warrants a different response than a 55% confidence Medium signal. The score helps teams calibrate their response."
        how="Above 85%: High confidence. All data sources fresh and signals consistent. Act on the assessment with full confidence. 65–85%: Moderate confidence. Some data latency or mixed signals. Use judgment. Below 65%: Limited confidence. Data may be delayed or sources partially unavailable. Monitor and wait for confirmation before major actions."
      />

      <div className="flex flex-wrap gap-3 mt-8">
        <Link href="/docs/analytics" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all">
          Analytics Guide <ArrowRight className="w-4 h-4" />
        </Link>
        <Link href="/docs/grid-map" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-semibold text-sm transition-all">
          Grid Map Guide <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
