import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Daily Workflow — TX Energy Risk Help Center",
  description: "A 5-minute daily monitoring process for operational teams.",
};

const STEPS = [
  {
    step: 1,
    time: "1 min",
    title: "Review the Dashboard Risk Score",
    desc: "Check the Current Risk Level. If Low and stable — note the confidence score and move on. If Medium or High — stay on the dashboard and review the full assessment.",
    action: "Low = proceed to Step 2. Medium/High = review Executive Recommendation first.",
    color: "bg-green-500/10 border-green-500/20 text-green-400",
  },
  {
    step: 2,
    time: "1 min",
    title: "Read the Executive Recommendation",
    desc: "The AI-synthesized recommendation tells you the current operational posture based on all active signal channels. It translates data into action-oriented language.",
    action: "If the recommendation includes 'no action required' language, proceed to Step 3. If it includes monitoring or procurement guidance, flag it for your team.",
    color: "bg-orange-500/10 border-orange-500/20 text-orange-400",
  },
  {
    step: 3,
    time: "1 min",
    title: "Review Monitoring Priorities",
    desc: "The top 3 active signals tell you where to direct team attention for the day. Assign each priority to the appropriate team member or workstream.",
    action: "Weather Demand → Operations. ERCOT Pricing → Procurement. Gas Supply → Supply chain or risk management.",
    color: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  },
  {
    step: 4,
    time: "1 min",
    title: "Check Alert Settings",
    desc: "Confirm your alert threshold matches today's operational context. If conditions are Medium and you're in a critical procurement window, consider switching to 'Any risk change' for the day.",
    action: "Navigate to Alert Center to verify threshold and delivery channels are configured correctly for current conditions.",
    color: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  },
  {
    step: 5,
    time: "1 min",
    title: "Review the Analytics Predictive Outlook",
    desc: "Check the 24–48h predictive outlook. If conditions are stable or improving, standard monitoring is sufficient. If the outlook shows escalating trajectory or high escalation probability, brief relevant teams.",
    action: "Low trajectory + stable = no action. Escalating trajectory = brief procurement and operations. High escalation probability = activate pre-planned response protocols.",
    color: "bg-teal-500/10 border-teal-500/20 text-teal-400",
  },
];

export default function WorkflowGuide() {
  return (
    <div>
      <h1 className="text-3xl font-black text-white mb-2">Recommended Daily Workflow</h1>
      <p className="text-gray-500 text-sm mb-3">A 5-minute morning process for operational awareness. Run this each morning before your first meeting.</p>
      <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/15 mb-8">
        <p className="text-sm text-orange-300 font-semibold">Total time: 5 minutes</p>
        <p className="text-xs text-gray-400 mt-1">Designed for operations managers, procurement leads, and energy risk teams who need daily situational awareness without spending 30 minutes on market data.</p>
      </div>

      <div className="space-y-4">
        {STEPS.map(({ step, time, title, desc, action, color }) => (
          <div key={step} className="p-5 rounded-2xl bg-white/3 border border-white/8">
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${color}`}>
                <span className="text-sm font-black">{step}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h3 className="text-sm font-bold text-white">{title}</h3>
                  <span className="text-[10px] font-mono text-gray-600 bg-white/5 px-2 py-0.5 rounded flex-shrink-0">{time}</span>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed mb-3">{desc}</p>
                <div className="p-3 rounded-lg bg-white/3 border border-white/5">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Decision Rule</p>
                  <p className="text-xs text-gray-300 leading-relaxed">{action}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="mt-10 mb-6">
        <h2 className="text-xl font-black text-white mb-4 pb-2 border-b border-white/8">During the Day</h2>
        <div className="space-y-3 text-sm text-gray-300">
          <p>After your morning review, the platform monitors conditions continuously. Your alerts handle the rest:</p>
          <ul className="space-y-2">
            {[
              "If you receive a Medium alert → review the dashboard within 15 minutes. Brief relevant teams if the escalation probability is above 40%.",
              "If you receive a High alert → immediate dashboard review. Activate pre-planned response protocols. Do not wait for the next scheduled review.",
              "If the risk level recovers (High→Medium, Medium→Low) → confirm with the Analytics predictive outlook before standing down elevated monitoring.",
              "End of day → optionally review the Analytics 24h history to understand the day's conditions for documentation or reporting.",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-orange-400 mt-1 flex-shrink-0">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-black text-white mb-4 pb-2 border-b border-white/8">Procurement Window Protocol</h2>
        <div className="space-y-3 text-sm text-gray-300">
          <p>For teams with active procurement decisions, add this step before any procurement window opens:</p>
          <div className="p-4 rounded-xl bg-white/3 border border-white/8">
            <ol className="space-y-2">
              {[
                "Check the current ERCOT price on the dashboard",
                "Review the 6-hour predictive outlook — is pricing trending up or stable?",
                "Check the Scenario Modeling panel for any high-probability escalation scenarios",
                "If risk is Low and trajectory is stable → procurement window conditions are normal",
                "If risk is Medium or trajectory is escalating → consider deferring or accelerating based on your price-risk tradeoff",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-orange-500/15 text-orange-400 text-xs flex items-center justify-center flex-shrink-0 font-bold mt-0.5">{i + 1}</span>
                  {item}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 mt-8">
        <Link href="/docs/faq" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all">
          FAQ <ArrowRight className="w-4 h-4" />
        </Link>
        <Link href="/dashboard" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-semibold text-sm transition-all">
          Open Dashboard <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
