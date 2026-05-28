"use client";
import Link from "next/link";
import Image from "next/image";
import {
  Activity, Zap, CloudLightning, Flame, Bell, Brain, ArrowRight, Shield,
  BarChart3, Building2, Factory, Truck, Cpu, TrendingUp, AlertTriangle,
  CheckCircle2, Server, Radio, Eye
} from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";

// ── Built For cards ───────────────────────────────────────────────────────────
const BUILT_FOR = [
  {
    icon: <Factory className="w-5 h-5 text-orange-400" />,
    title: "Oil & Gas Operators",
    desc:  "Monitor operational energy exposure impacting field infrastructure and production continuity across Texas basins.",
  },
  {
    icon: <Truck className="w-5 h-5 text-blue-400" />,
    title: "Midstream & Gas Infrastructure",
    desc:  "Track gas-to-power conditions and operational pressure across Texas energy systems and pipeline networks.",
  },
  {
    icon: <Building2 className="w-5 h-5 text-amber-400" />,
    title: "Industrial Energy Buyers",
    desc:  "Detect demand-driven pricing pressure before operational energy costs escalate during peak conditions.",
  },
  {
    icon: <Cpu className="w-5 h-5 text-teal-400" />,
    title: "Energy Procurement Teams",
    desc:  "Monitor ERCOT market conditions and operational energy risk in real time across Texas regions.",
  },
];

// ── Intelligence modules ──────────────────────────────────────────────────────
const INTELLIGENCE_MODULES = [
  {
    icon: <BarChart3   className="w-5 h-5 text-orange-400" />,
    title:  "Energy Risk Score",
    desc:   "Unified Low / Medium / High operational risk score updated continuously, synthesized from ERCOT pricing, weather demand, and gas supply pressure.",
  },
  {
    icon: <TrendingUp  className="w-5 h-5 text-blue-400" />,
    title:  "ERCOT Price Intelligence",
    desc:   "Real-time Houston Hub settlement prices with volatility detection, trend analysis, and confidence-weighted signal generation.",
  },
  {
    icon: <CloudLightning className="w-5 h-5 text-amber-400" />,
    title:  "Weather Demand Monitoring",
    desc:   "7-day NOAA forecast integrated with grid demand modeling. Triggers when temperatures indicate elevated load pressure on Texas infrastructure.",
  },
  {
    icon: <Flame       className="w-5 h-5 text-red-400" />,
    title:  "Gas Supply Pressure",
    desc:   "EIA weekly storage data benchmarked against 5-year seasonal averages. Signals when supply buffers are reduced.",
  },
  {
    icon: <Brain       className="w-5 h-5 text-teal-400" />,
    title:  "AI Market Reasoning",
    desc:   "Claude AI synthesizes all three risk channels into institutional-quality operational intelligence with executive summaries and escalation watch.",
  },
  {
    icon: <Bell        className="w-5 h-5 text-green-400" />,
    title:  "Operational Alerts",
    desc:   "Immediate notifications when risk conditions shift. Configurable thresholds, quiet hours, and operational escalation logic.",
  },
];

// ── Why conditions matter ─────────────────────────────────────────────────────
const WHY_ITEMS = [
  {
    icon: <Zap className="w-4 h-4 text-orange-400" />,
    title: "Heat-Driven Demand Spikes",
    desc:  "Extreme Texas temperatures drive rapid grid load increases that compress reserve margins and trigger ERCOT pricing volatility within hours.",
  },
  {
    icon: <Activity className="w-4 h-4 text-red-400" />,
    title: "Reserve Margin Tightening",
    desc:  "When available generation approaches peak demand, ERCOT prices escalate nonlinearly. Early detection is operationally critical.",
  },
  {
    icon: <Flame className="w-4 h-4 text-amber-400" />,
    title: "Gas Supply Sensitivity",
    desc:  "Natural gas powers over 40% of Texas generation. Storage shortfalls and pipeline pressure create cascading operational exposure.",
  },
  {
    icon: <TrendingUp className="w-4 h-4 text-blue-400" />,
    title: "Operational Cost Escalation",
    desc:  "Energy-intensive operations face direct cost exposure during peak conditions. Awareness before escalation enables operational preparation.",
  },
  {
    icon: <Shield className="w-4 h-4 text-teal-400" />,
    title: "Infrastructure Strain",
    desc:  "Coincident weather and supply stress events create compounding infrastructure sensitivity across generation, transmission, and distribution.",
  },
  {
    icon: <Eye className="w-4 h-4 text-purple-400" />,
    title: "Operational Visibility Gap",
    desc:  "Most operators react after conditions change. TX Energy Risk provides continuous forward awareness — before volatility impacts operations.",
  },
];

// ── Future enterprise features ────────────────────────────────────────────────
const FUTURE_FEATURES = [
  "Multi-site operational monitoring",
  "API integrations & data export",
  "Custom operational alert thresholds",
  "Regional ERCOT hub intelligence",
  "Reserve margin monitoring",
  "Historical event comparisons",
  "Escalation forecasting engine",
  "Infrastructure stability scoring",
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

            {/* Operational badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/15 border border-teal-400/30 text-teal-300 text-xs font-semibold mb-7 backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-400" />
              </span>
              Continuous ERCOT Monitoring · Texas Operations
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white leading-tight mb-6 drop-shadow-xl max-w-5xl mx-auto">
              AI Energy Intelligence<br className="hidden sm:block" />
              <span className="text-orange-400">for Texas Operations</span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed drop-shadow-md">
              Monitor ERCOT pricing, weather-driven demand, and natural gas supply conditions
              before energy volatility impacts operations, infrastructure, and cost.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login?signup=true"
                className="flex items-center gap-2 px-8 py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-base transition-all shadow-lg shadow-orange-500/30">
                Start Monitoring
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/pricing"
                className="flex items-center gap-2 px-8 py-4 rounded-xl backdrop-blur-sm bg-white/8 hover:bg-white/15 border border-white/20 text-white font-semibold text-base transition-all">
                Request Enterprise Demo
              </Link>
            </div>

            <p className="mt-6 text-xs text-gray-600">
              ERCOT · NOAA · EIA · Informational intelligence platform
            </p>

            {/* Operational status strip */}
            <div className="mt-16 flex flex-wrap items-center justify-center gap-6">
              {[
                { label: "ERCOT Pricing",    color: "text-orange-400", dot: "bg-orange-400" },
                { label: "Weather Demand",   color: "text-amber-400",  dot: "bg-amber-400" },
                { label: "Gas Supply",       color: "text-blue-400",   dot: "bg-blue-400" },
                { label: "AI Reasoning",     color: "text-teal-400",   dot: "bg-teal-400" },
              ].map(({ label, color, dot }) => (
                <div key={label} className="flex items-center gap-1.5 backdrop-blur-sm">
                  <span className={`w-1.5 h-1.5 rounded-full ${dot} opacity-80`} />
                  <span className={`text-xs font-semibold ${color} opacity-80`}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Built For ─────────────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold mb-5">
              <Building2 className="w-3.5 h-3.5" />
              Enterprise Operations
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              Built for Texas Energy Operations
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Designed for organizations with direct operational exposure to Texas energy markets —
              not retail investors.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {BUILT_FOR.map((item) => (
              <div key={item.title}
                className="group card-glass border border-white/5 hover:border-white/12 rounded-xl p-6 transition-all duration-300 flex flex-col gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center group-hover:bg-white/8 transition-colors flex-shrink-0">
                  {item.icon}
                </div>
                <h3 className="text-sm font-bold text-white">{item.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed flex-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Why Energy Conditions Matter ──────────────────────────────────── */}
        <section className="border-t border-white/5 bg-[#050810]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Operational Context
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                Why Energy Conditions Matter
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto leading-relaxed">
                Texas energy markets respond to overlapping physical conditions.
                Understanding the mechanisms helps operational teams stay ahead of escalation.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {WHY_ITEMS.map((item) => (
                <div key={item.title} className="flex items-start gap-3 p-5 rounded-xl bg-white/3 border border-white/6 hover:bg-white/5 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
                    <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Intelligence Modules ──────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold mb-5">
              <Brain className="w-3.5 h-3.5" />
              Platform Intelligence
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              Operational Intelligence Modules
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Six integrated intelligence channels — unified into one operational risk picture.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {INTELLIGENCE_MODULES.map((m) => (
              <div key={m.title} className="card-glass border border-white/5 rounded-xl p-6">
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center mb-4">
                  {m.icon}
                </div>
                <h3 className="text-sm font-bold text-white mb-2">{m.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Operational Cost Exposure ─────────────────────────────────────── */}
        <section className="border-t border-white/5 bg-[#050810]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-6">
              <Activity className="w-3.5 h-3.5" />
              Operational Awareness
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
                { level: "Low Exposure",      color: "text-green-400",  bg: "bg-green-500/8  border-green-500/20",  desc: "Conditions stable. Operational energy costs within normal range." },
                { level: "Moderate Exposure", color: "text-amber-400",  bg: "bg-amber-500/8  border-amber-500/20",  desc: "Weather or supply pressure detected. Elevated cost sensitivity possible." },
                { level: "Elevated Exposure", color: "text-red-400",    bg: "bg-red-500/8    border-red-500/20",    desc: "Multiple conditions reinforcing. Operations may face material energy cost escalation." },
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

        {/* ── Future Enterprise Features ────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-500/10 border border-gray-500/20 text-gray-400 text-xs font-semibold mb-5">
              <Server className="w-3.5 h-3.5" />
              Enterprise Roadmap
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
              Expanding Enterprise Capabilities
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-sm">
              Additional enterprise intelligence features in development for institutional and operational deployment.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {FUTURE_FEATURES.map((f) => (
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
              Begin operational monitoring<br className="hidden sm:block" /> of Texas energy conditions
            </h2>
            <p className="text-gray-400 mb-10 max-w-lg mx-auto leading-relaxed">
              Join operators and procurement teams using TX Energy Risk to maintain
              continuous visibility into ERCOT market conditions.
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
