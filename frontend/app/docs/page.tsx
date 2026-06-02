import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, LayoutDashboard, Map, BarChart2, Bell, FileText, CheckSquare, HelpCircle, ArrowRight, TrendingUp, Zap, CloudLightning, Flame, Building2, Radio, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Operational Intelligence Library — TX Energy Risk",
  description: "25+ articles, guides, and risk methodologies for Texas energy teams. ERCOT intelligence, natural gas market analysis, weather demand risk, procurement workflows, and platform guides.",
  keywords: ["ERCOT risk management", "Texas energy risk", "energy procurement risk", "natural gas market intelligence", "weather-driven energy demand", "operational risk monitoring", "Texas grid intelligence"],
};

const GUIDES = [
  { href: "/docs/getting-started",  icon: BookOpen,        title: "Getting Started",        desc: "What TX Energy Risk is, who it serves, and how to get operational value from day one." },
  { href: "/docs/dashboard",        icon: LayoutDashboard, title: "Dashboard Guide",         desc: "Every dashboard component explained — risk score, recommendations, scenarios, confidence." },
  { href: "/docs/grid-map",         icon: Map,             title: "Grid Map Guide",          desc: "8 Texas ERCOT zones monitored. Risk indicators, trends, and city-by-city reference." },
  { href: "/docs/analytics",        icon: BarChart2,       title: "Analytics Guide",         desc: "Predictive outlook, trajectory analysis, pattern memory, and state transition intelligence." },
  { href: "/docs/alerts",           icon: Bell,            title: "Alert Center Guide",      desc: "Email, SMS, Teams, Slack alerts. Thresholds, frequencies, and escalation protocols." },
  { href: "/docs/daily-brief",      icon: FileText,        title: "Energy Risk Brief",       desc: "Executive daily briefing — how to read and act on each section." },
  { href: "/docs/workflow",         icon: CheckSquare,     title: "Daily Workflow",          desc: "5-minute morning process for operational awareness and procurement readiness." },
  { href: "/docs/faq",              icon: HelpCircle,      title: "Frequently Asked",        desc: "Data sources, accuracy, compliance, alerts, and common platform questions." },
];

const CATEGORIES = [
  { icon: Zap,          label: "ERCOT Intelligence",          count: 8,  color: "text-orange-400 bg-orange-500/10 border-orange-500/20",  desc: "Real-time pricing, settlement points, scarcity conditions" },
  { icon: Flame,        label: "Natural Gas Intelligence",     count: 6,  color: "text-red-400 bg-red-500/10 border-red-500/20",           desc: "Henry Hub, EIA storage, gas-to-power correlations" },
  { icon: CloudLightning,label: "Weather Risk Intelligence",   count: 5,  color: "text-amber-400 bg-amber-500/10 border-amber-500/20",     desc: "NOAA demand forecasting, heat persistence, winter risk" },
  { icon: Building2,    label: "Operations & Procurement",     count: 4,  color: "text-teal-400 bg-teal-500/10 border-teal-500/20",        desc: "Procurement windows, load management, cost exposure" },
  { icon: BookOpen,     label: "Platform Guides",              count: 8,  color: "text-blue-400 bg-blue-500/10 border-blue-500/20",        desc: "Dashboard, alerts, analytics, grid map, workflow" },
  { icon: Bell,         label: "Alert Management",             count: 3,  color: "text-purple-400 bg-purple-500/10 border-purple-500/20",  desc: "Threshold configuration, delivery channels, escalation" },
  { icon: FileText,     label: "Executive Reporting",          count: 2,  color: "text-green-400 bg-green-500/10 border-green-500/20",     desc: "Daily briefs, executive summaries, PDF export" },
];

export default function DocsIndex() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Radio className="w-4 h-4 text-orange-400 animate-pulse" />
          <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">TX Energy Risk</span>
        </div>
        <h1 className="text-3xl font-black text-white mb-3">Operational Intelligence Library</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 font-mono mb-4">
          <span className="text-white font-semibold">25 Articles</span>
          <span>•</span>
          <span>8 Platform Guides</span>
          <span>•</span>
          <span>12 FAQs</span>
          <span>•</span>
          <span>Weekly Risk Brief</span>
        </div>
        <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">
          The Operational Intelligence Library provides practical guidance, risk management methodologies,
          operational workflows, and Texas energy market intelligence to help energy teams identify,
          interpret, and respond to developing operational risks.
        </p>
      </div>

      {/* Categories */}
      <section className="mb-10">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Content Categories</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CATEGORIES.map(({ icon: Icon, label, count, color, desc }) => (
            <div key={label} className="p-4 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{label}</span>
                    <span className="text-[10px] font-bold text-gray-600 bg-white/5 px-1.5 py-0.5 rounded font-mono">{count}</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Platform Guides */}
      <section className="mb-10">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Platform Guides</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GUIDES.map(({ href, icon: Icon, title, desc }) => (
            <Link key={href} href={href}
              className="group flex items-start gap-4 p-4 rounded-2xl bg-white/3 border border-white/8 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all">
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-white">{title}</h3>
                  <ArrowRight className="w-3 h-3 text-gray-600 group-hover:text-orange-400 transition-colors" />
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* SEO rich content areas */}
      <section className="mb-10">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Intelligence Areas</h2>
        <div className="space-y-3">
          {[
            { label: "ERCOT Risk Management", desc: "Real-time ERCOT HB_HOUSTON settlement pricing, scarcity conditions, reserve margin monitoring, and operational risk signals updated every 5 minutes from the ERCOT CDR.", icon: TrendingUp, color: "text-orange-400" },
            { label: "Texas Energy Risk Monitoring", desc: "Composite risk scoring across ERCOT pricing, NOAA weather demand, and EIA natural gas supply — synthesized into actionable Low/Medium/High operational risk signals for Texas energy teams.", icon: Shield, color: "text-teal-400" },
            { label: "Weather-Driven Energy Demand", desc: "NOAA grid forecast integration translates temperature data into ERCOT demand pressure signals for Houston, Dallas, Austin, San Antonio, Midland, Odessa, Corpus Christi, and Lubbock.", icon: CloudLightning, color: "text-amber-400" },
            { label: "Natural Gas Market Intelligence", desc: "Henry Hub daily pricing, EIA weekly storage benchmarked against 5-year averages, and gas-to-power correlation analysis for Texas generation cost sensitivity.", icon: Flame, color: "text-red-400" },
          ].map(({ label, desc, icon: Icon, color }) => (
            <div key={label} className="flex gap-4 p-4 rounded-xl bg-white/3 border border-white/8">
              <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${color}`} />
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">{label}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="p-5 rounded-2xl bg-teal-500/5 border border-teal-500/15">
        <p className="text-sm font-semibold text-teal-300 mb-1">New to TX Energy Risk?</p>
        <p className="text-sm text-gray-400">Start with <Link href="/docs/getting-started" className="text-orange-400 hover:text-orange-300 underline">Getting Started</Link>, then follow the <Link href="/docs/workflow" className="text-orange-400 hover:text-orange-300 underline">Daily Workflow</Link> to build your 5-minute operational monitoring routine.</p>
      </div>
    </div>
  );
}
