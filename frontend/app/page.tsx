"use client";
import Link from "next/link";
import Image from "next/image";
import { TrendingUp, CloudLightning, Flame, Bell, Brain, ArrowRight, Shield, BarChart3, AlertTriangle } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";

const FEATURES = [
  {
    icon: <BarChart3   className="w-5 h-5 text-orange-400" />,
    title:  "Texas Energy Risk Score",
    desc:   "A single Low / Medium / High risk score updated every 5 minutes, backed by three independent signal sources and a structured time horizon outlook.",
  },
  {
    icon: <TrendingUp  className="w-5 h-5 text-blue-400" />,
    title:  "ERCOT Price Monitoring",
    desc:   "Real-time Houston Hub settlement prices from the ERCOT CDR data feed, with volatility detection, trend analysis, and confidence-weighted alerts.",
  },
  {
    icon: <CloudLightning className="w-5 h-5 text-amber-400" />,
    title:  "Weather Demand Alerts",
    desc:   "7-day NOAA forecast integrated with grid demand modeling. Triggers when forecast temperatures indicate elevated cooling or heating load on the Texas grid.",
  },
  {
    icon: <Flame       className="w-5 h-5 text-red-400" />,
    title:  "Natural Gas Supply Pressure",
    desc:   "EIA weekly storage data compared to 5-year seasonal averages. Signals when supply buffers are reduced, increasing sensitivity to demand spikes.",
  },
  {
    icon: <Bell        className="w-5 h-5 text-green-400" />,
    title:  "Email Alerts",
    desc:   "Immediate notifications when risk changes from Low to Medium or Medium to High. Configurable thresholds, frequency, and market selection.",
  },
  {
    icon: <Brain       className="w-5 h-5 text-purple-400" />,
    title:  "AI Intelligence Summary",
    desc:   "Analyst-style summaries that synthesize all three risk drivers into a single coherent narrative with short-term, near-term, and 48-hour outlook.",
  },
];

const RISK_LEVELS = [
  { level: "Low",    color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20",  desc: "All drivers within normal range. No signals active." },
  { level: "Medium", color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20",  desc: "One active driver. Monitoring is recommended." },
  { level: "High",   color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",      desc: "Multiple drivers converging. Close monitoring warranted." },
];

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">

        {/* ── Hero Banner ── */}
        <section className="relative w-full overflow-hidden" style={{ minHeight: "92vh" }}>

          {/* Background photo */}
          <Image
            src="/grid-bg.jpg"
            alt="Texas power grid at night"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />

          {/* Layered gradient overlays for readability */}
          {/* Bottom-to-top: deep navy so the page continues seamlessly */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#080d1a] via-[#080d1a]/60 to-transparent" />
          {/* Top fade so navbar blends */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#080d1a]/70 via-transparent to-transparent" />
          {/* Teal tint to echo the network lines in the photo */}
          <div className="absolute inset-0 bg-[#0d2a3a]/30" />

          {/* Hero content */}
          <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 sm:px-6 lg:px-8"
               style={{ minHeight: "92vh", paddingTop: "96px" }}>

            {/* Logo */}
            <div className="mb-8">
              <Image
                src="/logo.png"
                alt="TX Energy Risk"
                width={500}
                height={280}
                className="h-20 w-auto object-contain drop-shadow-2xl"
                priority
              />
            </div>

            {/* Live indicator */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/15 border border-teal-400/30 text-teal-300 text-xs font-semibold mb-6 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              Live Texas Grid Monitoring
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-tight mb-6 drop-shadow-xl">
              Real-Time Texas<br />
              <span className="text-orange-400">Energy Risk</span> Intelligence
            </h1>

            <p className="text-base sm:text-lg font-semibold text-teal-300/90 italic mb-6 drop-shadow-md tracking-wide">
              Don&rsquo;t Get Caught at the Wrong Time &mdash; Detect Risk Before It Impacts Cost.
            </p>

            <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed drop-shadow-md">
              Monitor ERCOT pricing, weather-driven demand, and natural gas supply pressure
              before risk turns into cost.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login?signup=true"
                className="flex items-center gap-2 px-8 py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-base transition-all shadow-lg shadow-orange-500/30"
              >
                Start Monitoring Free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/pricing"
                className="flex items-center gap-2 px-8 py-4 rounded-xl backdrop-blur-sm bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-base transition-all"
              >
                View Pricing
              </Link>
            </div>

            <p className="mt-6 text-xs text-gray-500">
              Free tier available &middot; No credit card required &middot; Informational data only
            </p>

            {/* Risk level pills — anchored near bottom of hero */}
            <div className="mt-16 grid grid-cols-3 gap-3 w-full max-w-lg">
              {RISK_LEVELS.map(({ level, color, bg }) => (
                <div key={level}
                     className={`backdrop-blur-sm border rounded-xl py-2.5 text-center ${bg}`}>
                  <p className={`text-xl font-black ${color}`}>{level}</p>
                  <p className="text-[10px] text-gray-400 font-medium tracking-wide uppercase mt-0.5">Risk</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Problem ── */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <div className="card-glass border border-white/5 rounded-2xl p-10">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-4" />
            <h2 className="text-3xl font-black text-white mb-4">The Problem</h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Energy buyers often react after market conditions change. By the time a price spike appears
              on an invoice, the window to monitor, prepare, or escalate has already passed.
            </p>
            <p className="text-base text-gray-500 max-w-xl mx-auto mt-4 leading-relaxed">
              Texas energy markets move fast. ERCOT prices can shift significantly within hours.
              Weather-driven demand and gas supply pressure compound quickly -- and most teams
              are watching the wrong signals, too late.
            </p>
          </div>
        </section>

        {/* ── Solution ── */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-6">
            <Shield className="w-3.5 h-3.5" />
            The Solution
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">
            Early risk signals across<br className="hidden sm:block" /> power, weather, and gas markets
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed mb-4">
            TX Energy Risk detects early risk signals across ERCOT power prices, Texas weather demand,
            and natural gas supply -- unified into one clear risk score with a structured time horizon outlook.
          </p>
          <p className="text-base text-gray-500 max-w-xl mx-auto leading-relaxed">
            Not a trading tool. Not investment advice. A situational awareness platform
            that tells you when to pay closer attention.
          </p>
        </section>

        {/* ── Features ── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">What you get</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Three independent signal sources. One unified risk score. Built for Texas energy markets.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-glass border border-white/5 rounded-xl p-6">
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="text-sm font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 text-center">
          <div className="card-glass border border-orange-500/20 bg-orange-500/5 rounded-2xl p-10">
            <h2 className="text-3xl font-black text-white mb-4">
              Start monitoring Texas energy risk
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Free tier available. No credit card required.
              Upgrade to Pro for email alerts and full intelligence access.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login?signup=true"
                className="flex items-center gap-2 px-8 py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all shadow-lg shadow-orange-500/25"
              >
                Start Monitoring Free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/pricing"
                className="px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-semibold transition-all"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </section>

        {/* ── Disclaimer ── */}
        <section className="max-w-3xl mx-auto px-4 pb-16 text-center">
          <p className="text-xs text-gray-600 leading-relaxed">
            Informational analytics only. Not investment, trading, or procurement advice.
            All data is sourced from publicly available ERCOT, NOAA, and EIA data feeds.
            Risk indicators are probabilistic and do not guarantee any particular market outcome.
            Consult qualified advisors before making energy procurement or financial decisions.
          </p>
        </section>

      </main>
      <Footer />
    </>
  );
}
