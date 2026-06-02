import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "FAQ — TX Energy Risk Help Center",
  description: "Frequently asked questions about TX Energy Risk platform.",
};

const FAQS = [
  {
    q: "What is the Risk Score?",
    a: "The Risk Score is a composite operational risk indicator — Low, Medium, or High — synthesized from three live data sources: ERCOT real-time power prices, NOAA weather demand forecasts, and EIA natural gas storage data. It is not a market price forecast or a trading signal. It reflects the current state of conditions that historically correlate with elevated Texas energy costs and operational risk.",
  },
  {
    q: "How often is data updated?",
    a: "ERCOT pricing data is fetched every 5 minutes from the ERCOT CDR (Content Delivery Reports). NOAA weather forecasts are cached for 30 minutes and refreshed from NWS grid forecast endpoints. EIA natural gas storage data is cached for 4 hours and updated weekly from the EIA v2 API. The Risk Score recalculates each time any data source updates.",
  },
  {
    q: "How accurate are the alerts?",
    a: "Alerts fire when the risk score changes level based on current data. The platform does not predict future risk levels — it monitors current conditions and alerts you when those conditions change. False positives (alerts that fire but conditions quickly recover) are possible, particularly during rapid market volatility. Use the Analytics predictive outlook to contextualize whether a current alert reflects a sustained shift or a transient spike.",
  },
  {
    q: "Is this trading advice?",
    a: "No. TX Energy Risk provides operational intelligence and situational awareness only. The platform does not provide investment, trading, procurement, legal, engineering, or financial advice. Users remain fully responsible for all operational and business decisions. Nothing in the platform should be construed as a recommendation to buy, sell, or hold any financial instrument or commodity.",
  },
  {
    q: "What data sources are used?",
    a: "Three primary data sources: (1) ERCOT CDR — real-time HB_HOUSTON settlement point prices from ERCOT's public content delivery reports. (2) NOAA / National Weather Service — 7-day grid forecast data from the NWS API for each monitored city. (3) EIA (Energy Information Administration) — weekly natural gas storage reports and Henry Hub futures pricing from the EIA v2 API. All data is sourced from public, authoritative U.S. government and market operator endpoints.",
  },
  {
    q: "Can I monitor multiple Texas locations?",
    a: "Yes. The platform monitors 8 Texas cities: Houston, Dallas, Austin, San Antonio, Midland, Odessa, Corpus Christi, and Lubbock. The Grid Map shows risk status for all 8 cities simultaneously. You can configure alerts for a specific city by setting your primary monitoring location in Alert Center preferences.",
  },
  {
    q: "What is the Confidence Score?",
    a: "The Confidence Score reflects data freshness and signal consistency across the three data sources. A score above 85% indicates all data sources are current and signals are consistent. Below 70% indicates some data latency or mixed signals — treat the risk assessment as informational awareness rather than actionable intelligence until data freshness improves.",
  },
  {
    q: "Why did my alert fire but conditions seem normal?",
    a: "Several possibilities: (1) ERCOT prices briefly spiked and recovered before you checked the dashboard — the alert fires on the change, not on sustained conditions. (2) Weather demand signals may have shifted overnight from a new NOAA forecast. (3) The confidence score may be low — check the Data Sources panel to see if any data feed is delayed. In all cases, check the current risk level on the dashboard. If it has already recovered, the event was transient.",
  },
  {
    q: "How do I set up SMS alerts?",
    a: "In Alert Center, enable SMS Alerts and enter your phone number in E.164 format (include country code — e.g. +18325551234). SMS delivery requires Twilio credentials configured on the backend. Contact your administrator if SMS is not delivering after configuration.",
  },
  {
    q: "Can I share the Morning Digest with my team?",
    a: "Yes. In Alert Center, enable Morning Digest and enter a dedicated delivery email — such as a team distribution list or group inbox. The digest will be sent to that address each morning at 7am CDT. This allows broader team awareness without requiring every team member to have platform access.",
  },
  {
    q: "What should I do if the Risk Score is High?",
    a: "Follow your organization's pre-established energy risk response protocol. As a general framework: (1) Review the Executive Recommendation and Monitoring Priorities on the dashboard. (2) Brief relevant teams — procurement, operations, and risk management. (3) Check the Scenario Modeling panel for the highest-probability escalation path. (4) Export the Energy Risk Brief for documentation. (5) Confirm alert settings are configured for continued monitoring. Do not wait for conditions to self-resolve without team awareness.",
  },
  {
    q: "How is this different from ERCOT's own data?",
    a: "ERCOT publishes raw market data. TX Energy Risk synthesizes ERCOT data alongside weather demand and natural gas supply conditions into a unified risk signal. The value is not the raw data — it is the synthesis, contextualization, and early-warning signal that helps operational teams act before conditions escalate, not after.",
  },
];

export default function FAQGuide() {
  return (
    <div>
      <h1 className="text-3xl font-black text-white mb-2">Frequently Asked Questions</h1>
      <p className="text-gray-500 text-sm mb-8">Common questions about TX Energy Risk — data sources, accuracy, alerts, and compliance.</p>

      <div className="space-y-4">
        {FAQS.map(({ q, a }) => (
          <div key={q} className="p-5 rounded-2xl bg-white/3 border border-white/8">
            <h3 className="text-sm font-bold text-white mb-3">{q}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{a}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 p-5 rounded-2xl bg-white/3 border border-white/8">
        <h3 className="text-sm font-bold text-white mb-2">Still have questions?</h3>
        <p className="text-sm text-gray-400">Review the <Link href="/docs/getting-started" className="text-orange-400 hover:text-orange-300 underline">Getting Started</Link> guide or the <Link href="/docs/workflow" className="text-orange-400 hover:text-orange-300 underline">Daily Workflow</Link> for operational guidance.</p>
      </div>

      <div className="flex flex-wrap gap-3 mt-8">
        <Link href="/dashboard" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all">
          Open Dashboard <ArrowRight className="w-4 h-4" />
        </Link>
        <Link href="/docs" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-semibold text-sm transition-all">
          Back to Help Center
        </Link>
      </div>
    </div>
  );
}
