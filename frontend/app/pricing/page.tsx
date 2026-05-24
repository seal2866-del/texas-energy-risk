"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Zap, ChevronRight, Loader2 } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { supabase } from "@/lib/supabase";

const FREE_FEATURES = [
  "Texas Energy Risk Score (Low/Medium/High)",
  "ERCOT price monitor — 24h history",
  "Weather demand risk widget",
  "Natural gas supply pressure overview",
  "In-app risk summary",
  "1 Texas location",
];

const PRO_FEATURES = [
  "Everything in Free, plus:",
  "Real-time email alerts when signals trigger",
  "Custom price & temperature thresholds",
  "All 4 Texas locations",
  "7-day weather demand forecast",
  "8-week gas storage history",
  "Alert log & acknowledgment",
  "Priority data refresh (5 min)",
];

export default function PricingPage() {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.href = "/login?signup=true";
        return;
      }

      // Call your API to create a Stripe Checkout session
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/stripe/create-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            Authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({
            price_id:     process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
            success_url:  `${window.location.origin}/dashboard?upgraded=true`,
            cancel_url:   `${window.location.origin}/pricing`,
          }),
        }
      );
      const json = await res.json();
      if (json.url) window.location.href = json.url;
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="pt-20 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

          {/* Header */}
          <div className="text-center mb-14">
            <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
              Simple, transparent pricing
            </h1>
            <p className="text-gray-400 max-w-xl mx-auto">
              Start monitoring Texas energy risk conditions for free.
              Upgrade to Pro for real-time alerts and full access.
            </p>
          </div>

          {/* Plans */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">

            {/* Free */}
            <div className="card-glass border border-white/8 p-8 rounded-2xl flex flex-col">
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Free</p>
                <div className="flex items-end gap-1">
                  <span className="text-5xl font-black text-white">$0</span>
                  <span className="text-gray-500 mb-2">/month</span>
                </div>
                <p className="text-sm text-gray-400 mt-2">No credit card required</p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/login?signup=true"
                className="block text-center py-3 rounded-xl border border-white/15 text-white font-semibold hover:bg-white/5 transition-all"
              >
                Get started free
              </Link>
            </div>

            {/* Pro */}
            <div className="relative card-glass border-2 border-orange-500/50 p-8 rounded-2xl flex flex-col bg-orange-500/5">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1 rounded-full bg-orange-500 text-white text-xs font-black uppercase tracking-widest">
                  Most Popular
                </span>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest">Pro</p>
                  <Zap className="w-3.5 h-3.5 text-orange-400" />
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-5xl font-black text-white">$49</span>
                  <span className="text-gray-500 mb-2">/month</span>
                </div>
                <p className="text-sm text-gray-400 mt-2">Cancel anytime</p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {PRO_FEATURES.map((f) => (
                  <li
                    key={f}
                    className={`flex items-start gap-2.5 text-sm ${
                      f.startsWith("Everything") ? "text-gray-400 font-semibold" : "text-gray-200"
                    }`}
                  >
                    {!f.startsWith("Everything") && (
                      <Check className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                    )}
                    {f.startsWith("Everything") ? <span className="ml-6">{f}</span> : f}
                  </li>
                ))}
              </ul>

              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-base transition-all shadow-lg shadow-orange-500/25"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Upgrade to Pro
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-20 max-w-2xl mx-auto">
            <h2 className="text-2xl font-black text-white text-center mb-8">Common questions</h2>
            <div className="space-y-5">
              {[
                {
                  q: "Is this investment advice?",
                  a: "No. All information on this platform is for situational awareness only. We do not provide investment, trading, financial, or procurement advice. Risk indicators may show 'risk may be rising' — never buy, sell, or lock prices.",
                },
                {
                  q: "Where does the data come from?",
                  a: "Data sources include ERCOT (power prices), NOAA/NWS (weather forecasts), and the EIA (natural gas storage). During development, the platform uses realistic mock data with the same structure as live feeds.",
                },
                {
                  q: "Can I cancel my Pro subscription?",
                  a: "Yes. Cancel any time from your account settings. Your access continues until the end of the current billing period.",
                },
                {
                  q: "How often is data refreshed?",
                  a: "The dashboard auto-refreshes every 5 minutes on Pro. Free tier refreshes on page load. Real-time ERCOT prices update as fast as the ERCOT data feed allows.",
                },
              ].map(({ q, a }) => (
                <div key={q} className="card-glass border border-white/5 p-5 rounded-xl">
                  <p className="font-semibold text-white text-sm mb-2">{q}</p>
                  <p className="text-sm text-gray-400 leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
