import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail, MessageSquare, Bell, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Alert Center Guide — TX Energy Risk Help Center",
  description: "Email, SMS, Teams, and Slack alerts. Thresholds and frequencies explained.",
};

export default function AlertsGuide() {
  return (
    <div>
      <h1 className="text-3xl font-black text-white mb-2">Alert Center Guide</h1>
      <p className="text-gray-500 text-sm mb-8">Configure your alert delivery channels, risk thresholds, and monitoring preferences to ensure your team is notified when conditions matter.</p>

      <section className="mb-10">
        <h2 className="text-xl font-black text-white mb-4 pb-2 border-b border-white/8">Delivery Channels</h2>
        <div className="space-y-4">
          {[
            { icon: Mail, label: "Email Alerts", color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
              desc: "HTML-formatted email sent to your account email address. Includes current risk level, primary driver, ERCOT price, weather conditions, and a direct link to the dashboard. Email is best for documentation and non-urgent awareness." },
            { icon: MessageSquare, label: "SMS Alerts", color: "text-green-400 bg-green-500/10 border-green-500/20",
              desc: "Text message to your verified phone number (E.164 format — include country code, e.g. +18325551234). SMS is essential for time-sensitive response when you or your team may not be at a desk. Requires phone number verification in Twilio trial accounts." },
            { icon: Bell, label: "Slack Notifications", color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
              desc: "Post alerts to a Slack channel via incoming webhook. Ideal for team-wide awareness — everyone monitoring the same channel sees the same alerts simultaneously. Configure the webhook URL in your Slack workspace settings." },
            { icon: Bell, label: "Microsoft Teams Notifications", color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
              desc: "Post alerts to a Teams channel via incoming webhook. Same team-wide awareness benefit as Slack, but for Microsoft Teams environments. Configure the webhook URL in your Teams channel connector settings." },
          ].map(({ icon: Icon, label, color, desc }) => (
            <div key={label} className="p-5 rounded-2xl bg-white/3 border border-white/8">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">{label}</h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-black text-white mb-4 pb-2 border-b border-white/8">Risk Thresholds</h2>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">Thresholds control when alerts fire. Choose based on how much lead time your team needs and how much alert volume is acceptable.</p>
        <div className="space-y-3">
          {[
            { label: "Any Risk Change", desc: "Alert fires on any risk level transition — Low→Medium, Medium→High, and also High→Medium, Medium→Low (recovering). Best for procurement teams that want maximum visibility and early warning on both escalation and de-escalation.", recommended: "Procurement managers" },
            { label: "Medium & Above", desc: "Alert fires when conditions reach Medium or High risk. Skips Low-risk transitions. Best for operations teams that only need to act when conditions are materially elevated.", recommended: "Operations managers, facilities" },
            { label: "High Only", desc: "Alert fires only when conditions reach High risk. Minimizes alert volume but sacrifices lead time. Best for teams with limited flexibility that only act at extreme conditions.", recommended: "Executive escalation only" },
          ].map(({ label, desc, recommended }) => (
            <div key={label} className="p-4 rounded-xl bg-white/3 border border-white/8">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="text-sm font-bold text-white">{label}</h3>
                <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded font-mono flex-shrink-0">{recommended}</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-black text-white mb-4 pb-2 border-b border-white/8">Alert Frequencies</h2>
        <div className="space-y-3">
          {[
            { icon: Bell, label: "Immediate", desc: "Alert sent the moment risk level changes. No delay. This is the standard setting for operational teams that need real-time awareness." },
            { icon: Clock, label: "Daily Summary", desc: "One digest each morning at 7am CDT covering current conditions and the prior day's events. Best for senior leadership that wants situational awareness without intraday interruption." },
            { icon: Clock, label: "Weekly Summary", desc: "Monday morning weekly risk digest. Appropriate for executive reporting — not operational monitoring." },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex gap-3 p-4 rounded-xl bg-white/3 border border-white/8">
              <Icon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-white mb-1">{label}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-black text-white mb-4 pb-2 border-b border-white/8">Escalation Alerts</h2>
        <p className="text-sm text-gray-300 leading-relaxed mb-3">Escalation alerts re-send High risk notifications if the alert is not acknowledged within a defined window (default: 30 minutes).</p>
        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">When to Enable</p>
          <p className="text-sm text-gray-300">Enable escalation alerts for 24/7 operations where a single on-call contact may not always be immediately available. Escalation ensures critical High risk conditions don't go unnoticed during shift changes or off-hours.</p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-black text-white mb-4 pb-2 border-b border-white/8">Morning Digest</h2>
        <p className="text-sm text-gray-300 leading-relaxed">Separate from real-time alerts, the Morning Digest delivers a structured daily briefing at 7am CDT. Configure a dedicated digest email (e.g. a distribution list) to share daily risk awareness with a broader team without giving everyone platform access.</p>
      </section>

      <div className="flex flex-wrap gap-3 mt-8">
        <Link href="/docs/workflow" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all">
          Daily Workflow <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
