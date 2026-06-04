import type { Metadata } from "next";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import Link from "next/link";
import { ArrowRight, CheckCircle, AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "Oil & Gas Energy Risk Intelligence | Texas ERCOT Monitoring for O&G",
  description: "Real-time ERCOT price monitoring, natural gas supply intelligence, and operational risk alerts for Texas oil and gas operators, upstream production, and Permian Basin facilities.",
  keywords: ["oil gas energy risk Texas", "ERCOT oil gas monitoring", "Permian Basin energy intelligence", "upstream energy cost risk", "Texas oil gas ERCOT price"],
  alternates: { canonical: "https://texasgridintel.com/oil-gas-energy-risk" },
  openGraph: {
    title: "Oil & Gas Energy Risk Intelligence | Texas Grid Intel",
    description: "ERCOT monitoring and energy risk intelligence for Texas oil and gas operators.",
    url: "https://texasgridintel.com/oil-gas-energy-risk",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "How does ERCOT affect oil and gas operations?", "acceptedAnswer": { "@type": "Answer", "text": "Oil and gas operations rely on continuous electricity for ESPs, compression, water injection, processing, and SCADA systems. ERCOT price spikes increase these operating costs and can make certain high-power-intensity operations uneconomic during peak pricing periods." } },
    { "@type": "Question", "name": "What energy risks do Permian Basin operators face?", "acceptedAnswer": { "@type": "Answer", "text": "Permian Basin operators face ERCOT West zone pricing volatility, extreme summer heat that increases cooling and compression costs, transmission constraints between West Texas and the rest of ERCOT, and natural gas supply conditions that affect fuel and processing economics." } },
    { "@type": "Question", "name": "How can oil and gas operators monitor ERCOT?", "acceptedAnswer": { "@type": "Answer", "text": "Texas Grid Intel provides real-time ERCOT monitoring with configurable price alerts, weather demand forecasting, Henry Hub tracking, and escalation notifications — giving O&G operations teams advance warning before energy conditions change." } },
  ],
};

export default function OilGasEnergyRisk() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <Navbar />
      <main className="min-h-screen bg-[#080d1a] text-white">
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold mb-6">Texas Grid Intel · Oil & Gas</div>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-4">Oil & Gas<br /><span className="text-orange-400">Energy Risk Intelligence</span></h1>
          <p className="text-lg text-gray-300 leading-relaxed mb-8 max-w-2xl">ERCOT price monitoring, natural gas supply tracking, and operational risk intelligence for Texas oil and gas operators — from Permian Basin production to Gulf Coast refining.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/login?signup=true" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all">Start Free Monitoring <ArrowRight className="w-4 h-4" /></Link>
            <Link href="/pricing" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-semibold transition-all">View Plans</Link>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <p className="text-base text-gray-300 leading-relaxed">Texas oil and gas operations face a unique energy challenge. Unlike most industries where energy is a support cost, oil and gas production infrastructure — electric submersible pumps, compression stations, water disposal, gas processing, and SCADA systems — runs on continuous electricity with direct ERCOT exposure. When prices spike during summer heat events or winter storms, operating costs increase immediately. For Permian Basin operators, Gulf Coast refineries, and midstream infrastructure managers, real-time ERCOT intelligence is an operational necessity.</p>
        </section>

        <section className="border-t border-white/5 bg-[#050810]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h2 className="text-2xl font-black text-white mb-6">Energy Risk by Operation Type</h2>
            <div className="space-y-4">
              {[
                { title: "Upstream Production (ESP & Pumping)", desc: "Electric submersible pumps and artificial lift systems run continuously. ERCOT price spikes directly increase lifting costs. Real-time monitoring with configurable thresholds enables informed load management." },
                { title: "Compression & Gas Processing", desc: "Natural gas compression stations and processing plants are large, continuous electricity consumers. Both ERCOT price events and Henry Hub supply conditions affect operational economics." },
                { title: "Water Disposal & Injection", desc: "Water handling in the Permian Basin is one of the largest electricity end-uses in West Texas. Disposal well operations and water injection systems face direct ERCOT West zone exposure." },
                { title: "Downstream Refining", desc: "Gulf Coast refineries are continuous process operations with significant electricity and natural gas demand. ERCOT Houston Hub pricing and Henry Hub conditions both affect process economics." },
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
          <h2 className="text-2xl font-black text-white mb-4">What Texas Grid Intel Monitors for O&G</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {["ERCOT real-time pricing (Houston Hub & West Zone)","Henry Hub natural gas price tracking","Weather-driven demand pressure alerts","7-day NOAA demand forecast integration","Escalation alerts when thresholds are breached","Weekly Texas Energy Risk Brief email"].map(f => (
              <div key={f} className="flex items-center gap-2 p-3 rounded-xl bg-white/3 border border-white/6">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-gray-300">{f}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-white/5 bg-[#050810]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h2 className="text-2xl font-black text-white mb-8">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqSchema.mainEntity.map((f: any) => (
                <div key={f.name} className="p-5 rounded-xl bg-white/3 border border-white/6">
                  <h3 className="text-sm font-bold text-white mb-2">{f.name}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{f.acceptedAnswer.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Related Resources</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-2">City Pages</p>
              {[{name:"Houston Energy Risk",href:"/houston-energy-risk"},{name:"Midland Energy Risk",href:"/midland-energy-risk"},{name:"Odessa Energy Risk",href:"/odessa-energy-risk"},{name:"Corpus Christi Energy Risk",href:"/corpus-christi-energy-risk"}].map(c => (
                <Link key={c.href} href={c.href} className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 mb-1"><ArrowRight className="w-3.5 h-3.5" />{c.name}</Link>
              ))}
            </div>
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-2">Industries</p>
              {[{name:"Midstream Risk Monitoring",href:"/midstream-risk-monitoring"},{name:"Industrial Energy Risk",href:"/industrial-energy-risk"}].map(c => (
                <Link key={c.href} href={c.href} className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 mb-1"><ArrowRight className="w-3.5 h-3.5" />{c.name}</Link>
              ))}
            </div>
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-4 pb-12 text-center">
          <p className="text-xs text-gray-700">Texas Grid Intel provides informational energy market intelligence only. Not investment, trading, financial, or procurement advice. Data sourced from ERCOT, NOAA, and EIA public feeds.</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
