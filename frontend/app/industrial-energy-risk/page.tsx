import type { Metadata } from "next";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import Link from "next/link";
import { ArrowRight, CheckCircle, AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "Industrial Energy Risk Intelligence | Texas Manufacturing & Facilities ERCOT Monitoring",
  description: "Real-time ERCOT price monitoring and energy risk intelligence for Texas industrial manufacturers, large facilities, and energy-intensive operations managing electricity cost exposure.",
  keywords: ["industrial energy risk Texas", "manufacturing ERCOT monitoring", "Texas industrial electricity cost", "large facility energy risk", "industrial energy procurement Texas", "Texas manufacturing energy intelligence"],
  alternates: { canonical: "https://texasgridintel.com/industrial-energy-risk" },
  openGraph: {
    title: "Industrial Energy Risk Intelligence | Texas Grid Intel",
    description: "ERCOT monitoring and energy risk intelligence for Texas industrial manufacturers and large facilities.",
    url: "https://texasgridintel.com/industrial-energy-risk",
  },
};

export default function IndustrialEnergyRisk() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#080d1a] text-white">
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-6">Texas Grid Intel · Industrial</div>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-4">Industrial Energy<br /><span className="text-orange-400">Risk Intelligence</span></h1>
          <p className="text-lg text-gray-300 leading-relaxed mb-8 max-w-2xl">ERCOT price monitoring and operational energy risk intelligence for Texas industrial manufacturers, large facilities, and energy-intensive operations.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/login?signup=true" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all">Start Free Monitoring <ArrowRight className="w-4 h-4" /></Link>
            <Link href="/pricing" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-semibold transition-all">View Plans</Link>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <p className="text-base text-gray-300 leading-relaxed">For Texas industrial manufacturers and large facility operators, electricity is not just a utility cost — it is a primary operating expense that directly affects production economics. When ERCOT prices spike during summer heat events or grid stress conditions, energy-intensive operations face immediate cost pressure. Unlike small commercial customers with limited exposure, large industrial facilities with multi-megawatt loads face material financial impact from ERCOT price volatility. Texas Grid Intel provides industrial operations teams with the real-time monitoring, advance warning, and operational intelligence needed to manage this exposure.</p>
        </section>

        <section className="border-t border-white/5 bg-[#050810]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h2 className="text-2xl font-black text-white mb-6">Industrial Energy Risk Factors</h2>
            <div className="space-y-4">
              {[
                { title: "Continuous Process Operations", desc: "Manufacturing facilities and industrial plants that run continuously face 24/7 ERCOT exposure. Any price spike during operational hours directly increases costs with no ability to defer demand." },
                { title: "Summer Peak Demand Exposure", desc: "Industrial cooling loads combine with statewide commercial demand during Texas summer heat events, pushing ERCOT prices to their highest levels. Facilities with large HVAC or process cooling loads face compounded exposure." },
                { title: "Energy Procurement Timing", desc: "Industrial-scale energy buyers face significant procurement timing risk. Entering fixed-price contracts or index exposure during volatile ERCOT conditions has multi-year financial implications." },
                { title: "Operational Continuity vs. Cost Management", desc: "Industrial facilities must balance operational continuity against energy cost management. Real-time monitoring with advance warning enables informed decisions about optional load, scheduling, and demand response participation." },
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
          <h2 className="text-2xl font-black text-white mb-6">Industries We Serve</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {["Chemical Manufacturing","Food & Beverage Processing","Steel & Metal Production","Cement & Building Materials","Automotive Manufacturing","Plastics & Rubber","Paper & Pulp","Glass Manufacturing","Textile Production","Electronics Manufacturing"].map(ind => (
              <div key={ind} className="flex items-center gap-2 p-3 rounded-xl bg-white/3 border border-white/6">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="text-xs text-gray-300">{ind}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-2xl mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-black text-white mb-3">Monitor Your Industrial Energy Exposure</h2>
          <p className="text-gray-400 mb-6">Real-time ERCOT intelligence and operational risk alerts for Texas industrial facilities.</p>
          <Link href="/login?signup=true" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all">Start Free Monitoring <ArrowRight className="w-4 h-4" /></Link>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-2">City Pages</p>
              {[{n:"Houston",h:"/houston-energy-risk"},{n:"Dallas",h:"/dallas-energy-risk"},{n:"Midland",h:"/midland-energy-risk"}].map(c => (
                <Link key={c.h} href={c.h} className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 mb-1"><ArrowRight className="w-3.5 h-3.5" />{c.n} Energy Risk</Link>
              ))}
            </div>
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-2">Related</p>
              {[{n:"Data Center Power Risk",h:"/datacenter-power-risk"},{n:"Oil & Gas Energy Risk",h:"/oil-gas-energy-risk"}].map(c => (
                <Link key={c.h} href={c.h} className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 mb-1"><ArrowRight className="w-3.5 h-3.5" />{c.n}</Link>
              ))}
            </div>
          </div>
        </section>
        <div className="max-w-4xl mx-auto px-4 pb-12 text-center"><p className="text-xs text-gray-700">Informational intelligence only. Not financial, trading, or procurement advice.</p></div>
      </main>
      <Footer />
    </>
  );
}
