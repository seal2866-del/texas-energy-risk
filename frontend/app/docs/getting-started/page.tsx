import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Getting Started — TX Energy Risk Help Center",
  description: "What TX Energy Risk is, who it is designed for, and how to get started.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-black text-white mb-4 pb-2 border-b border-white/8">{title}</h2>
      <div className="space-y-4 text-gray-300 leading-relaxed">{children}</div>
    </section>
  );
}

function InfoBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/15">
      <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-2">{label}</p>
      <div className="text-sm text-gray-300 leading-relaxed">{children}</div>
    </div>
  );
}

export default function GettingStarted() {
  return (
    <div>
      <h1 className="text-3xl font-black text-white mb-2">Getting Started</h1>
      <p className="text-gray-500 text-sm mb-8">Learn what TX Energy Risk is, who it serves, and how to use it effectively from day one.</p>

      <Section title="What is TX Energy Risk?">
        <InfoBox label="Platform Definition">
          TX Energy Risk is an operational risk intelligence platform that continuously monitors ERCOT pricing, weather demand pressure, natural gas conditions, and operational signals to identify developing risk before conditions escalate.
        </InfoBox>
        <p>Unlike static market dashboards, TX Energy Risk synthesizes three live data streams — ERCOT power prices, NOAA weather forecasts, and EIA natural gas storage — into a single composite risk signal that updates every 5 minutes.</p>
        <p>The platform does not predict markets or provide trading recommendations. It surfaces developing operational conditions so energy teams can make informed decisions with more lead time than reactive monitoring allows.</p>
      </Section>

      <Section title="Who It Is Designed For">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { role: "Energy Procurement Managers", desc: "Monitor ERCOT conditions before procurement windows open. Identify cost-risk periods in advance." },
            { role: "Operations Managers", desc: "Track grid conditions that affect facility energy costs and operational continuity." },
            { role: "Industrial Operators", desc: "Stay ahead of Texas energy market events that create procurement or cost constraints." },
            { role: "Risk Management Teams", desc: "Unified view of operational energy exposure across ERCOT, weather, and gas supply channels." },
            { role: "Energy Traders", desc: "Real-time ERCOT price monitoring with multi-factor context across weather and gas channels." },
            { role: "Facilities Directors", desc: "Early warning for conditions that require load management or energy strategy adjustments." },
          ].map(({ role, desc }) => (
            <div key={role} className="p-4 rounded-xl bg-white/3 border border-white/8">
              <p className="text-sm font-semibold text-white mb-1">{role}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="How It Complements Existing Systems">
        <p>TX Energy Risk is designed to work alongside — not replace — existing ETRM systems, trading platforms, and operational tools.</p>
        <div className="space-y-3">
          {[
            { label: "ETRM / Trading Platforms", desc: "TX Energy Risk surfaces early-warning signals that trading systems do not provide. While your ETRM handles transaction management, TX Energy Risk monitors the underlying conditions that create pricing pressure." },
            { label: "Operations & EMS Systems", desc: "Energy Management Systems manage real-time load. TX Energy Risk provides the market context — upcoming price spikes, demand windows, supply constraints — that operational teams need before those events reach their EMS." },
            { label: "Weather Services", desc: "TX Energy Risk translates NOAA forecast data into demand-risk scores specific to Texas grid conditions. It connects weather patterns to grid load impact, which standard weather services do not do." },
          ].map(({ label, desc }) => (
            <div key={label} className="flex gap-3">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-1" />
              <div>
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="What to Expect During Daily Use">
        <p>Most users spend 5 minutes each morning reviewing the platform and receive real-time alerts throughout the day if conditions change.</p>
        <div className="space-y-2">
          {[
            "Morning: Review the Dashboard risk score and Executive Recommendation",
            "Morning: Check the Analytics predictive outlook for the next 48 hours",
            "During the day: Receive email or SMS alerts if risk level changes",
            "As needed: Review Grid Map for city-specific conditions",
            "Procurement windows: Check ERCOT pricing and scenario modeling",
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 text-sm text-gray-300">
              <span className="w-5 h-5 rounded-full bg-orange-500/15 border border-orange-500/20 text-orange-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">{i + 1}</span>
              {item}
            </div>
          ))}
        </div>
      </Section>

      <div className="flex flex-wrap gap-3 mt-8">
        <Link href="/docs/dashboard"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all">
          Dashboard Guide <ArrowRight className="w-4 h-4" />
        </Link>
        <Link href="/docs/workflow"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-semibold text-sm transition-all">
          Daily Workflow <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
