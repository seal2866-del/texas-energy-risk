import type { Metadata } from "next";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import Link from "next/link";
import { ArrowRight, CheckCircle, AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "Midstream Risk Monitoring | Pipeline & Gas Infrastructure Energy Intelligence",
  description: "Real-time ERCOT and Henry Hub monitoring for Texas midstream pipeline operators, gas processing plants, compression stations, and NGL infrastructure managing energy cost exposure.",
  keywords: ["midstream energy risk Texas", "pipeline energy monitoring", "gas processing ERCOT risk", "midstream Henry Hub monitoring", "Texas pipeline energy cost", "NGL midstream energy risk"],
  alternates: { canonical: "https://texasgridintel.com/midstream-risk-monitoring" },
  openGraph: {
    title: "Midstream Risk Monitoring | Texas Grid Intel",
    description: "ERCOT and Henry Hub monitoring for Texas midstream pipeline and gas processing operations.",
    url: "https://texasgridintel.com/midstream-risk-monitoring",
  },
};

export default function MidstreamRiskMonitoring() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#080d1a] text-white">
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-6">Texas Grid Intel · Midstream</div>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-4">Midstream Risk<br /><span className="text-orange-400">Monitoring</span></h1>
          <p className="text-lg text-gray-300 leading-relaxed mb-8 max-w-2xl">ERCOT price intelligence and Henry Hub supply monitoring for Texas pipeline operators, gas processing plants, compression stations, and NGL infrastructure.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/login?signup=true" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all">Start Free Monitoring <ArrowRight className="w-4 h-4" /></Link>
            <Link href="/pricing" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-semibold transition-all">View Plans</Link>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <p className="text-base text-gray-300 leading-relaxed">Texas midstream infrastructure sits at the intersection of natural gas supply, pipeline capacity, and electricity markets. Compression stations, gas processing plants, fractionation facilities, and pipeline operations all rely on continuous electricity supply with direct ERCOT cost exposure. At the same time, Henry Hub pricing and storage conditions directly affect the economics of gathering, processing, and marketing natural gas. Texas Grid Intel provides midstream operations teams with integrated ERCOT and Henry Hub monitoring — the two key market signals that determine midstream operational economics.</p>
        </section>

        <section className="border-t border-white/5 bg-[#050810]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h2 className="text-2xl font-black text-white mb-6">Midstream Energy Risk Factors</h2>
            <div className="space-y-4">
              {[
                { title: "Compression Station Power Costs", desc: "Natural gas compression is one of the most electricity-intensive midstream operations. ERCOT price spikes during peak periods directly increase compression costs across gathering and transmission systems." },
                { title: "Gas Processing Plant Economics", desc: "Processing plant operations — separation, treating, fractionation — require significant continuous power. Both ERCOT electricity prices and Henry Hub natural gas prices affect plant economics simultaneously." },
                { title: "Henry Hub Price Sensitivity", desc: "Midstream margins are closely tied to Henry Hub price levels. Storage draws, supply disruptions, or demand surges that move Henry Hub materially affect gathering throughput economics and keep-whole contract values." },
                { title: "NGL Market Exposure", desc: "NGL fractionation and marketing operations face combined ERCOT power cost exposure and NGL price volatility tied to natural gas markets. Monitoring both in real time is essential for operational planning." },
              ].map(item => (
                <div key={item.title} className="flex items-start gap-4 p-5 rounded-xl bg-white/3 border border-white/6">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-black text-white mb-4">What Texas Grid Intel Monitors for Midstream</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {["ERCOT real-time pricing across all load zones","Henry Hub daily and weekly price tracking","EIA natural gas storage vs 5-year average","Weather demand pressure on compression loads","Configurable escalation alerts for price thresholds","Weekly Texas Energy Risk Brief for operations teams"].map(f => (
              <div key={f} className="flex items-center gap-2 p-3 rounded-xl bg-white/3 border border-white/6">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-gray-300">{f}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-2xl mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-black text-white mb-3">Monitor Midstream Energy Conditions</h2>
          <p className="text-gray-400 mb-6">Real-time ERCOT and Henry Hub intelligence for Texas midstream operations teams.</p>
          <Link href="/login?signup=true" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all">Start Free Monitoring <ArrowRight className="w-4 h-4" /></Link>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-2">City Pages</p>
              {[{n:"Houston Energy Risk",h:"/houston-energy-risk"},{n:"Midland Energy Risk",h:"/midland-energy-risk"},{n:"Corpus Christi Energy Risk",h:"/corpus-christi-energy-risk"}].map(c => (
                <Link key={c.h} href={c.h} className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 mb-1"><ArrowRight className="w-3.5 h-3.5" />{c.n}</Link>
              ))}
            </div>
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-2">Related Industries</p>
              {[{n:"Oil & Gas Energy Risk",h:"/oil-gas-energy-risk"},{n:"Industrial Energy Risk",h:"/industrial-energy-risk"}].map(c => (
                <Link key={c.h} href={c.h} className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 mb-1"><ArrowRight className="w-3.5 h-3.5" />{c.n}</Link>
              ))}
            </div>
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-4 pb-12 text-center">
          <p className="text-xs text-gray-700">Informational intelligence only. Not financial, trading, or procurement advice. Data from ERCOT, NOAA, and EIA public feeds.</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
