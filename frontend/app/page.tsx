import Link from "next/link";
import { Zap, TrendingUp, Bell, Shield, ChevronRight, BarChart2, Thermometer, Flame } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";

const FEATURES = [
  {
    icon: <BarChart2 className="w-5 h-5 text-orange-400" />,
    title: "ERCOT Price Monitor",
    desc:  "Real-time and day-ahead ERCOT power prices across all major Texas hubs — updated continuously.",
  },
  {
    icon: <Thermometer className="w-5 h-5 text-blue-400" />,
    title: "Weather Demand Risk",
    desc:  "7-day Texas forecast with demand risk classification. Know when extreme heat or cold may be driving grid stress.",
  },
  {
    icon: <Flame className="w-5 h-5 text-yellow-400" />,
    title: "Gas Supply Pressure",
    desc:  "EIA natural gas storage vs. 5-year averages. Monitor supply tightness before it affects prices.",
  },
  {
    icon: <Bell className="w-5 h-5 text-violet-400" />,
    title: "Smart Alerts",
    desc:  "Get notified when multiple risk signals converge. Customizable thresholds for price, temperature, and storage.",
  },
  {
    icon: <TrendingUp className="w-5 h-5 text-green-400" />,
    title: "Texas Risk Score",
    desc:  "Composite Low / Medium / High risk score updated in real time based on all active market signals.",
  },
  {
    icon: <Shield className="w-5 h-5 text-gray-400" />,
    title: "Informational Only",
    desc:  "Built with compliance in mind. No buy/sell advice — clear, contextual language for situational awareness.",
  },
];

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16">

        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-orange-500/8 rounded-full blur-3xl" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 text-center relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold mb-8">
              <Zap className="w-3 h-3" />
              Texas Energy Risk Alert Platform
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-tight max-w-4xl mx-auto">
              Monitor Texas Energy
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400 block">
                Risk in Real Time
              </span>
            </h1>

            <p className="mt-6 text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
              ERCOT price signals, Texas weather demand risk, and natural gas
              supply pressure — unified into one clear risk score.
              Informational only.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login?signup=true"
                className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-lg transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2"
              >
                Start Monitoring Free
                <ChevronRight className="w-5 h-5" />
              </Link>
              <Link
                href="/pricing"
                className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl text-lg transition-all"
              >
                View Pricing
              </Link>
            </div>

            <p className="mt-5 text-xs text-gray-600">
              Free tier available · No credit card required
            </p>
          </div>
        </section>

        {/* Risk score preview */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
            {(["low", "medium", "high"] as const).map((score) => {
              const cfg = {
                low:    { label: "LOW",    color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", icon: "🟢" },
                medium: { label: "MEDIUM", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: "🟡" },
                high:   { label: "HIGH",   color: "text-red-400",   bg: "bg-red-500/10 border-red-500/20",     icon: "🔴" },
              }[score];
              return (
                <div key={score} className={`card-glass p-4 border ${cfg.bg} text-center`}>
                  <div className="text-2xl mb-1">{cfg.icon}</div>
                  <p className={`text-xs font-black ${cfg.color}`}>{cfg.label}</p>
                  <p className="text-xs text-gray-500">RISK</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Features */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Everything Texas energy professionals need
            </h2>
            <p className="mt-4 text-gray-400 max-w-xl mx-auto">
              Built for buyers, operators, and investors who need to stay ahead
              of ERCOT conditions — not wade through raw data.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-glass p-6 border border-white/5 hover:border-white/10 transition-all">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="card-glass border border-orange-500/20 bg-orange-500/5 rounded-2xl p-12 text-center">
            <h2 className="text-3xl font-black text-white mb-4">
              Risk may be rising. Are you watching?
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Join Texas energy professionals monitoring ERCOT conditions daily.
              Free tier available.
            </p>
            <Link
              href="/login?signup=true"
              className="inline-flex items-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-lg transition-all shadow-lg shadow-orange-500/25"
            >
              Create Free Account
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
