import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, TrendingUp, GitBranch, Repeat, Brain } from "lucide-react";

export const metadata: Metadata = {
  title: "Analytics Guide — TX Energy Risk Help Center",
  description: "Predictive outlook, trajectory, pattern memory, and transition analysis explained.",
};

function ExampleBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 p-3 rounded-lg bg-teal-500/5 border border-teal-500/15">
      <p className="text-[10px] font-bold text-teal-400 uppercase tracking-widest mb-1.5">{label}</p>
      <div className="text-xs text-gray-300 leading-relaxed">{children}</div>
    </div>
  );
}

export default function AnalyticsGuide() {
  return (
    <div>
      <h1 className="text-3xl font-black text-white mb-2">Analytics Guide</h1>
      <p className="text-gray-500 text-sm mb-8">The Analytics page provides historical context, predictive outlooks, and pattern intelligence to help you anticipate — not just react to — developing energy risk.</p>

      <section className="mb-10">
        <div className="flex items-center gap-3 mb-4 pb-2 border-b border-white/8">
          <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Brain className="w-4 h-4 text-orange-400" />
          </div>
          <h2 className="text-xl font-black text-white">Predictive Outlook</h2>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">The Predictive Outlook synthesizes trajectory analysis, instability scoring, and historical pattern matching into forward-looking risk forecasts across three time horizons.</p>
        <div className="space-y-4">
          {[
            { horizon: "0–6 Hours", label: "WHY", desc: "The primary driver of current conditions and the basis for the near-term risk assessment. Answers: why is the current risk score what it is?" },
            { horizon: "6–24 Hours", label: "WHAT", desc: "The dominant signal determining near-term direction. Typically the factor most likely to change conditions within the next operational day." },
            { horizon: "24–48 Hours", label: "WATCH", desc: "Developing conditions that could escalate into material risk. Not yet at elevated levels — but trending in a direction that warrants awareness." },
          ].map(({ horizon, label, desc }) => (
            <div key={horizon} className="p-4 rounded-xl bg-white/3 border border-white/8">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold text-orange-400 uppercase tracking-widest">{label}</span>
                <span className="text-xs text-gray-500 font-mono">{horizon}</span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{desc}</p>
            </div>
          ))}
          <div className="p-4 rounded-xl bg-white/3 border border-white/8">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-bold text-green-400 uppercase tracking-widest">NEXT</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">The recommended next action based on current trajectory and horizon forecasts. This is the platform's operational suggestion — not a directive. Apply your own judgment and context.</p>
          </div>
        </div>
        <ExampleBox label="Example">
          <strong className="text-white">WHY:</strong> Risk is currently Low, primarily driven by weather demand. Current risk score: 2.1/10. Trajectory is stable.<br />
          <strong className="text-white">WHAT:</strong> Dominant signal is weather demand. Momentum low.<br />
          <strong className="text-white">WATCH:</strong> Watch for another failed recovery pattern. Monitor for repeated escalation-recovery cycling.<br />
          <strong className="text-white">NEXT:</strong> Risk expected to remain at low levels through the near-term outlook. Historical patterns support continued stability.
        </ExampleBox>
      </section>

      <section className="mb-10">
        <div className="flex items-center gap-3 mb-4 pb-2 border-b border-white/8">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-teal-400" />
          </div>
          <h2 className="text-xl font-black text-white">Risk Trajectory</h2>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed mb-3">The Risk Momentum Chart shows the historical risk score over the selected time window (24h, 48h, or 7d). The OLS trend line shows the direction of conditions over time — not just the current snapshot.</p>
        <div className="space-y-3">
          {[
            { label: "Escalating", desc: "Risk score trending upward. Even if current score is Low or Medium, an escalating trajectory indicates building pressure that may reach higher levels." },
            { label: "Stable", desc: "Risk score flat or minor variation. Conditions are holding at current levels. Standard monitoring appropriate." },
            { label: "Recovering", desc: "Risk score declining from a recent elevated level. Conditions are improving, but watch for failed recoveries that reverse." },
            { label: "Volatile", desc: "Frequent oscillation between risk levels. Indicates unstable grid conditions — a common precursor to sustained High risk events." },
          ].map(({ label, desc }) => (
            <div key={label} className="flex gap-3 text-sm">
              <span className="text-orange-400 font-bold flex-shrink-0 w-24">{label}</span>
              <span className="text-gray-400">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-center gap-3 mb-4 pb-2 border-b border-white/8">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <GitBranch className="w-4 h-4 text-amber-400" />
          </div>
          <h2 className="text-xl font-black text-white">State Transitions</h2>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed mb-3">The Transitions tab shows every risk level change (Low↔Medium↔High) over the historical window, with instability scoring and pattern detection.</p>
        <div className="p-4 rounded-xl bg-white/3 border border-white/8 mb-3">
          <p className="text-sm font-semibold text-white mb-1">Instability Score (0–100)</p>
          <p className="text-xs text-gray-400 leading-relaxed">Measures how often and severely conditions have oscillated. High instability (60+) indicates a market environment prone to rapid escalation. Low instability (below 30) indicates stable, predictable conditions.</p>
        </div>
        <ExampleBox label="Example — Reading Transition Patterns">
          If the Transitions panel shows 3 escalations and 3 recoveries within 24 hours with an instability score of 75, conditions are volatile. A sustained escalation may be building. Consider tightening alert thresholds and reviewing procurement exposure.
        </ExampleBox>
      </section>

      <section className="mb-10">
        <div className="flex items-center gap-3 mb-4 pb-2 border-b border-white/8">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <Repeat className="w-4 h-4 text-purple-400" />
          </div>
          <h2 className="text-xl font-black text-white">Pattern Memory</h2>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed mb-3">Pattern Memory compares current conditions to all historical snapshots — finding the closest matches and showing what happened next.</p>
        <p className="text-sm text-gray-300 leading-relaxed mb-3">The matching considers risk level, ERCOT price, demand pressure, and primary driver simultaneously. Each match is scored by similarity percentage.</p>
        <ExampleBox label="Example — Using Pattern Memory">
          Pattern Memory shows current conditions match historical snapshots from June 2024 with 87% similarity. In those historical cases, conditions escalated to Medium risk within 4 hours 3 out of 5 times. This context supports a more cautious operational posture even if the current score is Low.
        </ExampleBox>
      </section>

      <div className="flex flex-wrap gap-3 mt-8">
        <Link href="/docs/alerts" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all">
          Alert Center <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
