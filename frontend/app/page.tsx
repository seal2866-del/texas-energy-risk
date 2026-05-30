"use client";
import Link from "next/link";
import Image from "next/image";
import {
  Activity, Zap, CloudLightning, Flame, Bell, Brain, ArrowRight, Shield,
  BarChart3, Building2, Factory, Truck, Cpu, TrendingUp, AlertTriangle,
  CheckCircle2, Server, Radio, Eye, Clock, DollarSign, Database, Gauge
} from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";

// ── What happens when conditions change ───────────────────────────────────────
const CONSEQUENCE_CARDS = [
  {
    icon:  <Zap className="w-5 h-5 text-orange-400" />,
    title: "ERCOT Price Volatility",
    desc:  "ERCOT pricing can move rapidly during periods of grid stress, increasing operational energy costs with little warning.",
    color: "border-orange-500/15 hover:border-orange-500/25",
  },
  {
    icon:  <CloudLightning className="w-5 h-5 text-amber-400" />,
    title: "Extreme Heat Events",
    desc:  "High temperatures drive electricity demand higher and can tighten reserve margins across the Texas grid.",
    color: "border-amber-500/15 hover:border-amber-500/25",
  },
  {
    icon:  <Flame className="w-5 h-5 text-red-400" />,
    title: "Natural Gas Constraints",
    desc:  "Storage declines, pipeline disruptions, or supply pressure can create downstream operational risk across energy-intensive operations.",
    color: "border-red-500/15 hover:border-red-500/25",
  },
  {
    icon:  <DollarSign className="w-5 h-5 text-yellow-400" />,
    title: "Procurement Cost Escalation",
    desc:  "Energy procurement teams may face higher costs when market conditions deteriorate faster than expected.",
    color: "border-yellow-500/15 hover:border-yellow-500/25",
  },
  {
    icon:  <AlertTriangle className="w-5 h-5 text-gray-400" />,
    title: "Reactive Operations",
    desc:  "Without forward visibility, organizations often respond after conditions have already escalated — limiting available options.",
    color: "border-gray-500/15 hover:border-gray-500/25",
  },
];

// ── What you get ──────────────────────────────────────────────────────────────
const WHAT_YOU_GET = [
  {
    icon:  <Gauge className="w-5 h-5 text-orange-400" />,
    title: "Energy Risk Score",
    desc:  "Continuous Low / Medium / High operational risk score synthesized from ERCOT pricing, weather demand, and gas supply. Updated every 5 minutes.",
  },
  {
    icon:  <BarChart3 className="w-5 h-5 text-blue-400" />,
    title: "ERCOT Price Intelligence",
    desc:  "Real-time Houston Hub settlement prices with volatility detection and threshold alerts. Know before your procurement window closes.",
  },
  {
    icon:  <CloudLightning className="w-5 h-5 text-amber-400" />,
    title: "Weather Demand Monitoring",
    desc:  "7-day NOAA forecast integrated with grid demand modeling. Know when temperatures will pressure grid load before it happens.",
  },
  {
    icon:  <Flame className="w-5 h-5 text-red-400" />,
    title: "Natural Gas Analysis",
    desc:  "EIA weekly storage benchmarked against 5-year averages. Signals when supply buffers are reduced and generation cost sensitivity is elevated.",
  },
  {
    icon:  <Brain className="w-5 h-5 text-teal-400" />,
    title: "Executive AI Briefs",
    desc:  "Operational intelligence synthesized into executive-ready summaries. Recommended actions, escalation triggers, and cost exposure — in plain language.",
  },
  {
    icon:  <Bell className="w-5 h-5 text-green-400" />,
    title: "Real-Time Alerts",
    desc:  "Configurable email alerts when risk conditions shift. Know immediately when thresholds are approached or exceeded.",
  },
];

// ── ROI section ───────────────────────────────────────────────────────────────
const ROI_CARDS = [
  {
    icon:  <Clock className="w-5 h-5 text-blue-400" />,
    title: "Reduce Monitoring Time",
    desc:  "Continuous analysis replaces manual monitoring across ERCOT, NOAA, and EIA. One operational view instead of three data sources.",
  },
  {
    icon:  <Eye className="w-5 h-5 text-amber-400" />,
    title: "Identify Escalation Earlier",
    desc:  "Spot developing risk conditions before they become operational constraints. Act on awareness, not reaction.",
  },
  {
    icon:  <Activity className="w-5 h-5 text-green-400" />,
    title: "Improve Operational Awareness",
    desc:  "Single operational view across pricing, demand, and supply conditions. Executives and analysts see the same picture.",
  },
  {
    icon:  <TrendingUp className="w-5 h-5 text-orange-400" />,
    title: "Support Faster Decisions",
    desc:  "Executive-ready summaries and escalation triggers reduce the time from data to decision. Built for operations teams, not analysts.",
  },
];

// ── Industries ────────────────────────────────────────────────────────────────
const INDUSTRIES = [
  { icon: <Factory className="w-4 h-4 text-orange-400" />,      label: "Oil & Gas Operators" },
  { icon: <Truck className="w-4 h-4 text-blue-400" />,          label: "Midstream Infrastructure" },
  { icon: <Building2 className="w-4 h-4 text-amber-400" />,     label: "Industrial Energy Consumers" },
  { icon: <Cpu className="w-4 h-4 text-teal-400" />,            label: "Energy Procurement Teams" },
  { icon: <Server className="w-4 h-4 text-purple-400" />,       label: "Data Centers" },
  { icon: <Gauge className="w-4 h-4 text-red-400" />,           label: "Manufacturing Operations" },
  { icon: <Activity className="w-4 h-4 text-green-400" />,      label: "Utility Service Providers" },
  { icon: <Database className="w-4 h-4 text-gray-400" />,       label: "Facilities Management" },
];

// ── Data sources ──────────────────────────────────────────────────────────────
const DATA_SOURCES = [
  { name: "ERCOT",  sub: "Real-Time Settlement Prices",    color: "text-orange-400" },
  { name: "NOAA",   sub: "National Weather Service",       color: "text-blue-400" },
  { name: "NWS",    sub: "Forecast & Demand Modeling",     color: "text-teal-400" },
  { name: "EIA",    sub: "Natural Gas Storage & Pricing",  color: "text-amber-400" },
];

// ── Coming soon ───────────────────────────────────────────────────────────────
const COMING_SOON = [
  "Regional Heat Maps",
  "Procurement Risk Forecasting",
  "Multi-Site Monitoring",
  "Operational Alert Routing",
  "Executive Daily Briefs",
  "Custom Thresholds",
  "Energy Cost Forecast Models",
  "API Access",
];

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="relative w-full overflow-hidden" style={{ minHeight: "92vh" }}>
          <Image
            src="/grid-bg.jpg"
            alt="Texas power grid infrastructure"
            fill priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080d1a] via-[#080d1a]/65 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#080d1a]/70 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-[#0a1a2a]/35" />

          <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 sm:px-6 lg:px-8"
               style={{ minHeight: "92vh", paddingTop: "96px" }}>

            <div className="mb-8">
              <Image src="/logo.png" alt="TX Energy Risk"
                width={500} height={280}
                className="h-20 w-auto object-contain drop-shadow-2xl" priority />
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/15 border border-teal-400/30 text-teal-300 text-xs font-semibold mb-7 backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-400" />
              </span>
              Continuous ERCOT Monitoring · Texas Operations
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white leading-tight mb-6 drop-shadow-xl max-w-5xl mx-auto">
              Know When Texas Energy<br className="hidden sm:block" />
              <span className="text-orange-400">Becomes Operational Risk</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-8 leading-relaxed drop-shadow-md">
              Monitor ERCOT pricing, weather-driven demand, and natural gas supply conditions
              before volatility impacts operations, procurement, energy costs, and infrastructure planning.
            </p>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 mb-10">
              {["Real-time Monitoring", "Predictive Analytics", "AI-Assisted Interpretation"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-gray-300">
                  <span className="text-green-400 font-bold">✓</span>
                  {item}
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login?signup=true"
                className="flex items-center gap-2 px-8 py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-base transition-all shadow-lg shadow-orange-500/30">
                Start Monitoring
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/dashboard"
                className="flex items-center gap-2 px-8 py-4 rounded-xl backdrop-blur-sm bg-white/8 hover:bg-white/15 border border-white/20 text-white font-semibold text-base transition-all">
                View Live Conditions
              </Link>
            </div>

            <p className="mt-6 text-xs text-gray-600">
              ERCOT · NOAA · EIA · Informational intelligence platform
            </p>

            {/* Data sources strip */}
            <div className="mt-16 flex flex-wrap items-center justify-center gap-6">
              {[
                { label: "ERCOT Pricing",  color: "text-orange-400", dot: "bg-orange-400" },
                { label: "Weather Demand", color: "text-amber-400",  dot: "bg-amber-400" },
                { label: "Gas Supply",     color: "text-blue-400",   dot: "bg-blue-400" },
                { label: "AI Reasoning",   color: "text-teal-400",   dot: "bg-teal-400" },
              ].map(({ label, color, dot }) => (
                <div key={label} className="flex items-center gap-1.5 backdrop-blur-sm">
                  <span className={`w-1.5 h-1.5 rounded-full ${dot} opacity-80`} />
                  <span className={`text-xs font-semibold ${color} opacity-80`}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Live Market Conditions Widget ─────────────────────────────────── */}
        <section className="bg-[#050810] border-t border-white/5">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="card-glass border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-0.5">
                    Today's Texas Conditions
                  </p>
                  <p className="text-xs text-gray-500">Live data — updated every 5 minutes</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <span className="text-[10px] text-green-400 font-semibold uppercase tracking-wide">Live</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: "Current Risk",         value: "LOW",             color: "text-green-400" },
                  { label: "ERCOT Houston Hub",    value: "Live on dashboard", color: "text-orange-400" },
                  { label: "Weather Demand",       value: "NOMINAL",         color: "text-blue-400" },
                  { label: "Gas Supply",           value: "STABLE",          color: "text-teal-400" },
                  { label: "Operational Outlook",  value: "No action required", color: "text-green-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                    <p className={`text-xs font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-center">
                <Link href="/dashboard"
                  className="text-xs text-orange-400 hover:text-orange-300 font-semibold transition-colors">
                  View full operational dashboard →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── What Happens When Conditions Change ───────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold mb-5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Operational Context
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              What Happens When Conditions Change?
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Texas energy markets can shift rapidly. Operational teams often discover problems only after
              costs, supply conditions, or demand pressures have already escalated.
            </p>
          </div>

          {/* 5 scenario cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {CONSEQUENCE_CARDS.map((c) => (
              <div key={c.title} className={`bg-white/3 border rounded-xl p-5 transition-colors ${c.color}`}>
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center mb-3">
                  {c.icon}
                </div>
                <h3 className="text-sm font-bold text-white mb-2">{c.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>

          {/* How TX Energy Risk Helps */}
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-6 sm:p-8">
            <h3 className="text-lg font-black text-orange-300 mb-3">How TX Energy Risk Helps</h3>
            <p className="text-sm text-gray-300 leading-relaxed mb-3">
              TX Energy Risk continuously monitors ERCOT pricing, weather demand pressure, and natural gas
              conditions to identify developing operational risk before escalation impacts planning,
              procurement, or infrastructure operations.
            </p>
            <p className="text-sm text-gray-400 leading-relaxed">
              The platform is designed to provide early visibility, operational context, and actionable
              intelligence so teams can make informed decisions before conditions become constraints.
            </p>
          </div>
        </section>

        {/* ── What You Get ─────────────────────────────────────────────────── */}
        <section className="border-t border-white/5 bg-[#050810]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold mb-5">
                <Brain className="w-3.5 h-3.5" />
                Platform Capabilities
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                What You Get
              </h2>
              <p className="text-gray-400 max-w-xl mx-auto">
                Six integrated intelligence channels — unified into one operational picture.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {WHAT_YOU_GET.map((m) => (
                <div key={m.title} className="card-glass border border-white/5 rounded-xl p-6">
                  <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center mb-4">
                    {m.icon}
                  </div>
                  <h3 className="text-sm font-bold text-white mb-2">{m.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why Teams Use TX Energy Risk (ROI) ───────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-5">
              <TrendingUp className="w-3.5 h-3.5" />
              Operational Value
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              Why Teams Use TX Energy Risk
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Built for organizations that need operational awareness, not another data dashboard.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ROI_CARDS.map((c) => (
              <div key={c.title} className="card-glass border border-white/5 rounded-xl p-6">
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center mb-4">
                  {c.icon}
                </div>
                <h3 className="text-sm font-bold text-white mb-2">{c.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Who Uses TX Energy Risk ───────────────────────────────────────── */}
        <section className="border-t border-white/5 bg-[#050810]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold mb-5">
                <Building2 className="w-3.5 h-3.5" />
                Industries
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                Who Uses TX Energy Risk
              </h2>
              <p className="text-gray-400 max-w-xl mx-auto">
                Designed for organizations with direct operational exposure to Texas energy markets.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {INDUSTRIES.map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-3 p-4 rounded-xl bg-white/3 border border-white/6 hover:bg-white/5 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center flex-shrink-0">
                    {icon}
                  </div>
                  <span className="text-xs font-semibold text-gray-300">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Built on Trusted Data ─────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-500/10 border border-gray-500/20 text-gray-400 text-xs font-semibold mb-6">
            <Shield className="w-3.5 h-3.5" />
            Data Reliability
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
            Built on Trusted Energy Data Sources
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto text-sm mb-10 leading-relaxed">
            Continuously monitored and validated. All data sourced from public government
            and market feeds — no third-party aggregators.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {DATA_SOURCES.map(({ name, sub, color }) => (
              <div key={name} className="p-5 rounded-xl bg-white/3 border border-white/6 text-center">
                <p className={`text-xl font-black mb-1 ${color}`}>{name}</p>
                <p className="text-[10px] text-gray-500 leading-snug">{sub}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-gray-600">
            Continuously monitored and validated. Confidence scores reflect data freshness and signal alignment.
          </p>
        </section>

        {/* ── Operational Cost Exposure ─────────────────────────────────────── */}
        <section className="border-t border-white/5 bg-[#050810]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-6">
              <Activity className="w-3.5 h-3.5" />
              Cost Awareness
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">
              Operational Cost Exposure
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto leading-relaxed mb-10">
              TX Energy Risk translates market conditions into operational exposure signals —
              giving your team forward awareness before energy costs escalate.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              {[
                { level: "Low Exposure",      color: "text-green-400", bg: "bg-green-500/8 border-green-500/20",  desc: "Conditions stable. Operational energy costs within normal range." },
                { level: "Moderate Exposure", color: "text-amber-400", bg: "bg-amber-500/8 border-amber-500/20", desc: "Weather or supply pressure detected. Elevated cost sensitivity possible." },
                { level: "Elevated Exposure", color: "text-red-400",   bg: "bg-red-500/8 border-red-500/20",     desc: "Multiple conditions reinforcing. Operations may face material energy cost escalation." },
              ].map(({ level, color, bg, desc }) => (
                <div key={level} className={`rounded-xl border p-5 text-left ${bg}`}>
                  <p className={`text-sm font-black mb-2 ${color}`}>{level}</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
            <Link href="/login?signup=true"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all shadow-lg shadow-orange-500/25">
              Monitor Your Exposure
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* ── Coming Soon ───────────────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-500/10 border border-gray-500/20 text-gray-400 text-xs font-semibold mb-5">
              <Server className="w-3.5 h-3.5" />
              Roadmap
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
              Coming Soon
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-sm">
              Premium features in development for enterprise operational deployment.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {COMING_SOON.map((f) => (
              <div key={f} className="flex items-center gap-2 p-3 rounded-lg bg-white/3 border border-white/6">
                <CheckCircle2 className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                <span className="text-xs text-gray-500">{f}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────────────── */}
        <section className="border-t border-white/5 bg-[#050810]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
            <div className="inline-flex items-center gap-2 mb-4">
              <Radio className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs font-semibold text-green-400 uppercase tracking-wide">Systems Operational</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-5">
              Stop reacting to energy conditions.<br className="hidden sm:block" />
              <span className="text-orange-400">Start monitoring them.</span>
            </h2>
            <p className="text-gray-400 mb-10 max-w-lg mx-auto leading-relaxed">
              Join operations and procurement teams using TX Energy Risk to maintain
              continuous visibility into Texas energy conditions — before volatility impacts operations.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login?signup=true"
                className="flex items-center gap-2 px-8 py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all shadow-lg shadow-orange-500/25">
                Start Monitoring
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/pricing"
                className="px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-semibold transition-all">
                View Plans
              </Link>
            </div>
          </div>
        </section>

        {/* ── Disclaimer ────────────────────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-4 pb-16 text-center">
          <p className="text-xs text-gray-700 leading-relaxed">
            Informational analytics only. Not investment, trading, financial, or procurement advice.
            Data sourced from ERCOT, NOAA, and EIA public feeds. Risk indicators are probabilistic
            and do not guarantee any market outcome. Consult qualified advisors before making
            energy procurement or operational decisions.
          </p>
        </section>

      </main>
      <Footer />
    </>
  );
}
