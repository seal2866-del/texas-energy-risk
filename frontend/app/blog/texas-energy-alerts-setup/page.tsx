import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: "How to Set Up Texas Energy Alerts for Your Facility | TX Energy Risk",
  description: "For Texas facilities and operations teams, the challenge is not finding energy data — it is knowing when to act on it. A step-by-step guide to configuring effective ERCOT energy alerts.",
  keywords: ["ERCOT energy alert setup", "Texas energy notification", "facility energy monitoring", "ERCOT price alert system", "Texas energy risk alerts"],
};

export default function Article() {
  return (
    <article>
      <div className="mb-2">
        <Link href="/blog" className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-6">
          <ArrowLeft className="w-3 h-3" />Back to Intelligence Library
        </Link>
        <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Operations & Procurement</span>
      </div>
      <h1 className="text-3xl font-black text-white mb-4 leading-tight">How to Set Up Texas Energy Alerts for Your Facility</h1>
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-8 pb-6 border-b border-white/8">
        <Calendar className="w-3 h-3" />
        <span>June 2026</span>
        <span>·</span>
        <span>TX Energy Risk Intelligence</span>
      </div>
      <div className="prose-dark">
      <h2 className="text-xl font-black text-white mt-10 mb-4 pb-2 border-b border-white/8">Step 1: Define What You Are Monitoring</h2>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">Texas energy risk comes from three sources. Before setting up alerts, decide which matters most to your operations: ERCOT price volatility, weather demand risk, or natural gas supply pressure.</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">If your facility has real-time pricing exposure, direct pass-through contracts, or index-based procurement, ERCOT price spikes directly affect your energy costs. If your facility consumes significant electricity for cooling or production, weather-driven demand events create both price risk and potential supply constraints.</p>

      <h2 className="text-xl font-black text-white mt-10 mb-4 pb-2 border-b border-white/8">Step 2: Choose Your Alert Threshold</h2>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">Any risk change: Alerts when conditions shift from Low to Medium or Medium to High. Best for active procurement decisions where early information has direct value.</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">Medium and above: Alerts only when ERCOT risk reaches elevated levels. Appropriate for operations teams that only need to act when conditions become material.</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">High only: Alerts only at maximum risk. Appropriate for operations with limited flexibility that only need to act at extreme conditions.</p>

      <h2 className="text-xl font-black text-white mt-10 mb-4 pb-2 border-b border-white/8">Step 3: Configure Delivery Channels</h2>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">Email is best for informational awareness and documentation. Email alerts create a record of when risk conditions occurred, useful for post-event cost analysis and reporting.</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">SMS is essential for time-sensitive response. If your team needs to take action within 30–60 minutes of a risk event — adjusting load, contacting your energy manager, or deferring operations — SMS is the only channel that reliably reaches people during off-hours or away from their desk.</p>

      <h2 className="text-xl font-black text-white mt-10 mb-4 pb-2 border-b border-white/8">Step 4: Test Before You Need It</h2>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">Before an ERCOT event creates real operational pressure, verify your alert system is working: use the test alert button to confirm email delivery, verify SMS delivery to each configured phone number, and confirm the right team members are on the distribution list.</p>
      <p className="text-sm text-gray-300 leading-relaxed mb-4">A Texas energy alert that works but does not drive action is as useless as one that does not deliver. The test run ensures your team has agreed on the response before the alert fires in a real event.</p>

      </div>
      <div className="mt-10 pt-6 border-t border-white/8">
        <p className="text-xs text-gray-600 leading-relaxed mb-6">TX Energy Risk provides operational intelligence and situational awareness only. This article does not constitute investment, trading, financial, legal, or procurement advice.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all">
            View Live Risk Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/blog" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-semibold text-sm transition-all">
            More Articles
          </Link>
        </div>
      </div>
    </article>
  );
}
