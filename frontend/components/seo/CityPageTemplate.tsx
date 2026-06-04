import Link from "next/link";
import { ArrowRight, CheckCircle, AlertTriangle } from "lucide-react";

interface FAQ { q: string; a: string; }
interface RiskFactor { title: string; desc: string; }

interface CityPageProps {
  city:           string;
  state:          string;
  tagline:        string;
  description:    string;
  intro:          string;
  keyIndustries:  string[];
  riskFactors:    RiskFactor[];
  whyMatters:     string;
  platformValue:  string;
  faqs:           FAQ[];
  relatedCities:  { name: string; href: string }[];
  relatedIndustries: { name: string; href: string }[];
}

export default function CityPageTemplate({
  city, state, tagline, description, intro,
  keyIndustries, riskFactors, whyMatters, platformValue,
  faqs, relatedCities, relatedIndustries,
}: CityPageProps) {

  // JSON-LD FAQ schema
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <main className="min-h-screen bg-[#080d1a] text-white">

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            Texas Grid Intel · {city}, {state}
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-4">
            {city} Energy Risk<br />
            <span className="text-orange-400">Intelligence</span>
          </h1>
          <p className="text-lg text-gray-300 leading-relaxed mb-8 max-w-2xl">{tagline}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/login?signup=true"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all shadow-lg shadow-orange-500/25">
              Start Free Monitoring <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/pricing"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-semibold transition-all">
              View Plans
            </Link>
          </div>
        </section>

        {/* Intro */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="prose prose-invert max-w-none">
            <p className="text-base text-gray-300 leading-relaxed">{intro}</p>
          </div>
        </section>

        {/* Key Industries */}
        <section className="border-t border-white/5 bg-[#050810]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h2 className="text-2xl font-black text-white mb-6">Key Industries in {city}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {keyIndustries.map(ind => (
                <div key={ind} className="flex items-center gap-2 p-3 rounded-xl bg-white/3 border border-white/6">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-gray-300">{ind}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Risk Factors */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-black text-white mb-3">Energy Risk Factors in {city}</h2>
          <p className="text-gray-400 mb-8">{whyMatters}</p>
          <div className="space-y-4">
            {riskFactors.map((r, i) => (
              <div key={i} className="flex items-start gap-4 p-5 rounded-xl bg-white/3 border border-white/6">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">{r.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Platform Value */}
        <section className="border-t border-white/5 bg-[#050810]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h2 className="text-2xl font-black text-white mb-4">How Texas Grid Intel Helps {city} Operations</h2>
            <p className="text-base text-gray-300 leading-relaxed mb-8">{platformValue}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { title: "Real-Time ERCOT Monitoring", desc: "Live Houston Hub pricing with escalation alerts when thresholds are breached." },
                { title: "Weather Demand Intelligence", desc: "7-day NOAA forecast integrated with grid demand modeling for advance warning." },
                { title: "Natural Gas Supply Tracking", desc: "Henry Hub and EIA storage data to monitor fuel supply conditions before they tighten." },
              ].map(f => (
                <div key={f.title} className="p-5 rounded-xl bg-white/3 border border-white/6">
                  <h3 className="text-sm font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Newsletter CTA */}
        <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl font-black text-white mb-3">Get the Weekly {city} Energy Brief</h2>
          <p className="text-gray-400 mb-6">
            Weekly ERCOT outlook, weather demand forecast, and natural gas supply conditions for {city} operations teams.
          </p>
          <Link href="/login?signup=true"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all shadow-lg shadow-orange-500/25">
            Start Free Monitoring <ArrowRight className="w-4 h-4" />
          </Link>
        </section>

        {/* FAQ */}
        <section className="border-t border-white/5 bg-[#050810]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h2 className="text-2xl font-black text-white mb-8">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <div key={i} className="p-5 rounded-xl bg-white/3 border border-white/6">
                  <h3 className="text-sm font-bold text-white mb-2">{faq.q}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Internal Links */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {relatedCities.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Other Texas Cities</h3>
                <div className="space-y-2">
                  {relatedCities.map(c => (
                    <Link key={c.href} href={c.href} className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300">
                      <ArrowRight className="w-3.5 h-3.5" /> {c.name} Energy Risk Intelligence
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {relatedIndustries.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">By Industry</h3>
                <div className="space-y-2">
                  {relatedIndustries.map(ind => (
                    <Link key={ind.href} href={ind.href} className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300">
                      <ArrowRight className="w-3.5 h-3.5" /> {ind.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Disclaimer */}
        <div className="max-w-4xl mx-auto px-4 pb-12 text-center">
          <p className="text-xs text-gray-700 leading-relaxed">
            Texas Grid Intel provides informational energy market intelligence only. Not investment, trading, financial, or procurement advice.
            Data sourced from ERCOT, NOAA, and EIA public feeds.
          </p>
        </div>

      </main>
    </>
  );
}
