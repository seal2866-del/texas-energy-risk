import type { Metadata } from "next";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import Link from "next/link";
import { ArrowRight, CheckCircle, AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "Data Center Power Risk Intelligence | Texas ERCOT Monitoring for Data Centers",
  description: "Real-time ERCOT price monitoring and power risk intelligence for Texas data centers, colocation facilities, and hyperscale operators managing electricity cost and grid reliability exposure.",
  keywords: ["data center power risk Texas", "ERCOT data center monitoring", "Texas data center electricity cost", "hyperscale ERCOT Texas", "colocation power risk Texas", "data center energy intelligence"],
  alternates: { canonical: "https://texasgridintel.com/datacenter-power-risk" },
  openGraph: {
    title: "Data Center Power Risk Intelligence | Texas Grid Intel",
    description: "ERCOT monitoring and power risk intelligence for Texas data centers and colocation facilities.",
    url: "https://texasgridintel.com/datacenter-power-risk",
  },
};

export default function DatacenterPowerRisk() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#080d1a] text-white">
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold mb-6">Texas Grid Intel · Data Centers</div>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-4">Data Center<br /><span className="text-orange-400">Power Risk Intelligence</span></h1>
          <p className="text-lg text-gray-300 leading-relaxed mb-8 max-w-2xl">ERCOT monitoring and grid reliability intelligence for Texas data centers, colocation facilities, and hyperscale operators managing power cost and availability risk.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/login?signup=true" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all">Start Free Monitoring <ArrowRight className="w-4 h-4" /></Link>
            <Link href="/pricing" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-semibold transition-all">View Plans</Link>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <p className="text-base text-gray-300 leading-relaxed">Texas has become one of the fastest-growing data center markets in North America, driven by land availability, fiber infrastructure, and competitive power costs. But ERCOT's real-time wholesale electricity market creates unique risks for data center operators. Unlike regulated markets with stable utility pricing, Texas data centers with index or floating rate contracts face direct ERCOT price exposure. During summer heat events, afternoon prices can spike 10-100x above baseline levels. Texas Grid Intel provides data center operations and procurement teams with continuous ERCOT monitoring, advance warning of price and demand conditions, and the operational intelligence to manage power cost risk proactively.</p>
        </section>

        <section className="border-t border-white/5 bg-[#050810]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h2 className="text-2xl font-black text-white mb-6">Data Center Power Risk Factors</h2>
            <div className="space-y-4">
              {[
                { title: "ERCOT Real-Time Price Exposure", desc: "Data centers with index or pass-through contracts face direct ERCOT real-time price exposure. During peak summer events, prices can reach $500-5,000/MWh for short periods, creating significant cost spikes for large facilities." },
                { title: "Cooling Demand During Summer Heat", desc: "Texas summer heat increases PUE as cooling systems work harder. Higher ambient temperatures increase electricity consumption for cooling precisely when ERCOT prices are highest — compounding both cost and efficiency impacts." },
                { title: "Grid Reliability and Reserve Margins", desc: "ERCOT's reserve margin — the buffer between available generation and peak demand — directly affects grid reliability. When reserve margins tighten below 10%, the risk of emergency conditions increases." },
                { title: "Procurement Contract Timing", desc: "Data center energy procurement decisions in Texas have multi-year cost implications. Understanding ERCOT conditions at the time of contracting is essential for informed fixed vs. index decisions." },
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
          <h2 className="text-2xl font-black text-white mb-4">What Texas Grid Intel Provides for Data Centers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {["Real-time ERCOT price monitoring (all load zones)","Configurable price alert thresholds","7-day weather demand forecasting","Reserve margin awareness","Henry Hub and gas supply tracking","Weekly Texas Energy Risk Brief"].map(f => (
              <div key={f} className="flex items-center gap-2 p-3 rounded-xl bg-white/3 border border-white/6">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-gray-300">{f}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-2xl mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-black text-white mb-3">Monitor Your Data Center Power Risk</h2>
          <p className="text-gray-400 mb-6">Real-time ERCOT intelligence for Texas data center operations and procurement teams.</p>
          <Link href="/login?signup=true" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all">Start Free Monitoring <ArrowRight className="w-4 h-4" /></Link>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-2">City Pages</p>
              {[{n:"Dallas Energy Risk",h:"/dallas-energy-risk"},{n:"Houston Energy Risk",h:"/houston-energy-risk"}].map(c => (
                <Link key={c.h} href={c.h} className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 mb-1"><ArrowRight className="w-3.5 h-3.5" />{c.n}</Link>
              ))}
            </div>
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-2">Related</p>
              {[{n:"Industrial Energy Risk",h:"/industrial-energy-risk"},{n:"Oil & Gas Energy Risk",h:"/oil-gas-energy-risk"}].map(c => (
                <Link key={c.h} href={c.h} className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 mb-1"><ArrowRight className="w-3.5 h-3.5" />{c.n}</Link>
              ))}
            </div>
          </div>
        </section>
        <div className="max-w-4xl mx-auto px-4 pb-12 text-center"><p className="text-xs text-gray-700">Informational intelligence only. Not financial, trading, or procurement advice. Data from ERCOT, NOAA, and EIA.</p></div>
      </main>
      <Footer />
    </>
  );
}
