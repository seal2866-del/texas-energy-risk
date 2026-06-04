"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Zap, ChevronRight, Loader2, Building2, Mail } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { supabase } from "@/lib/supabase";

const TIERS = [
  {
    id:       "free",
    name:     "Free",
    price:    "$0",
    period:   "/month",
    note:     "No credit card required",
    highlight: false,
    features: [
      "Texas Energy Risk Score (Low/Medium/High)",
      "ERCOT price monitor — 24h history",
      "Weather demand risk widget",
      "Natural gas supply overview",
      "AI-generated risk summary",
      "1 Texas market location",
      "Dashboard auto-refresh every 5 min",
    ],
    cta:    "Get started free",
    ctaHref: "/login?signup=true",
  },
  {
    id:       "pro",
    name:     "Professional",
    price:    "$499",
    period:   "/month",
    note:     "Cancel anytime",
    highlight: true,
    badge:    "Most Popular",
    priceId:  process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
    features: [
      "Everything in Free, plus:",
      "Real-time email alerts when signals trigger",
      "Recommended Actions panel",
      "Executive Brief — operational intelligence",
      "Escalation Triggers with live thresholds",
      "Operational Watch List",
      "All 8 Texas market locations",
      "Grid Map access",
      "Historical analytics — 90 days",
      "Export operational brief (PDF)",
      "Custom price & temperature thresholds",
      "Assessment Reliability dashboard",
    ],
    cta:     "Start Professional",
    ctaAction: "checkout",
  },
  {
    id:       "business",
    name:     "Business",
    price:    "$1,199",
    period:   "/month",
    note:     "Billed monthly",
    highlight: false,
    priceId:  process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID,
    features: [
      "Everything in Professional, plus:",
      "Multi-site exposure monitoring",
      "Team alert routing (up to 5 users)",
      "Morning operational briefing email",
      "Executive PDF reporting — daily",
      "Alert acknowledgment workflow",
      "Teams / Slack alert integrations",
      "Procurement exposure module",
      "Weekly market conditions digest",
      "Priority support",
      "Dedicated onboarding",
    ],
    cta:     "Start Business",
    ctaAction: "checkout",
  },
];

const ENTERPRISE_FEATURES = [
  "API access for custom integrations",
  "SSO / enterprise authentication",
  "Custom ERCOT zone monitoring",
  "Dedicated account manager",
  "SLA & uptime guarantee",
  "Custom data integrations",
  "Procurement intelligence dashboard",
  "Dedicated onboarding & training",
];

const FAQ = [
  {
    q: "Is this investment or trading advice?",
    a: "No. All information on this platform is for situational awareness only. We do not provide investment, trading, financial, or procurement advice. Risk indicators may show 'risk may be rising' — this is never a buy, sell, or lock-price signal.",
  },
  {
    q: "Where does the data come from?",
    a: "Data sources include ERCOT (real-time power prices), NOAA/NWS (weather forecasts), and the EIA (natural gas storage). All sources are publicly available government and market data feeds.",
  },
  {
    q: "How do email alerts work?",
    a: "Pro users receive email alerts when risk changes from Low to Medium or Medium to High, or when a new primary driver appears. Alerts include risk level, primary driver, ERCOT price, weather conditions, and a disclaimer.",
  },
  {
    q: "Can I cancel my subscription?",
    a: "Yes. Cancel any time from your account settings. Your access continues until the end of the current billing period.",
  },
  {
    q: "How often is data refreshed?",
    a: "The dashboard auto-refreshes every 5 minutes. ERCOT prices update as fast as the CDR data feed allows, typically every 15 minutes. Weather and gas data refresh on their respective source schedules.",
  },
  {
    q: "What is the confidence score?",
    a: "Confidence reflects signal alignment, data freshness, and persistence. 1 active driver yields ~70%, 2 drivers ~80%, 3 drivers ~87%. Stale data reduces confidence; unavailable sources reduce it further.",
  },
];

export default function PricingPage() {
  const [loading,      setLoading]      = useState(false);
  const [upgradeError, setUpgradeError] = useState("");

  const handleCheckout = async (priceId?: string) => {
    setLoading(true);
    setUpgradeError("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { window.location.href = "/login?signup=true"; return; }

      const apiUrl  = process.env.NEXT_PUBLIC_API_URL;
      const pid     = priceId ?? process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID;

      if (!apiUrl || !pid) { setUpgradeError("Configuration error: missing API URL or Price ID."); return; }

      const res = await fetch(`${apiUrl}/api/stripe/create-checkout`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({
          price_id:    pid,
          success_url: `${window.location.origin}/dashboard?upgraded=true`,
          cancel_url:  `${window.location.origin}/pricing`,
        }),
      });

      if (!res.ok) { setUpgradeError(`Server error ${res.status}: ${await res.text()}`); return; }
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      else setUpgradeError("No checkout URL returned. Please try again.");
    } catch (err: any) {
      setUpgradeError(`Network error: ${err.message ?? "Could not reach server."}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="pt-24 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

          {/* Header */}
          <div className="text-center mb-14">
            <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
              Simple, transparent pricing
            </h1>
            <p className="text-gray-400 max-w-xl mx-auto text-lg">
              Start monitoring Texas energy risk for free.
              Upgrade for real-time alerts, full intelligence, and team access.
            </p>
          </div>

          {/* 3-tier grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {TIERS.map((tier) => (
              <div
                key={tier.id}
                className={`relative card-glass rounded-2xl p-8 flex flex-col ${
                  tier.highlight
                    ? "border-2 border-orange-500/50 bg-orange-500/5"
                    : "border border-white/8"
                }`}
              >
                {tier.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 rounded-full bg-orange-500 text-white text-xs font-black uppercase tracking-widest">
                      {tier.badge}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <p className={`text-xs font-semibold uppercase tracking-widest ${tier.highlight ? "text-orange-400" : "text-gray-400"}`}>
                      {tier.name}
                    </p>
                    {tier.highlight && <Zap className="w-3.5 h-3.5 text-orange-400" />}
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="text-5xl font-black text-white">{tier.price}</span>
                    <span className="text-gray-500 mb-2">{tier.period}</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-2">{tier.note}</p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((f) => (
                    <li
                      key={f}
                      className={`flex items-start gap-2.5 text-sm ${
                        f.startsWith("Everything") ? "text-gray-400 font-semibold" : "text-gray-200"
                      }`}
                    >
                      {!f.startsWith("Everything") && (
                        <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${tier.highlight ? "text-orange-400" : "text-green-500"}`} />
                      )}
                      {f.startsWith("Everything") ? <span className="ml-6">{f}</span> : f}
                    </li>
                  ))}
                </ul>

                {upgradeError && tier.ctaAction && (
                  <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    {upgradeError}
                  </div>
                )}

                {tier.ctaHref ? (
                  <Link
                    href={tier.ctaHref}
                    className={`block text-center py-3 rounded-xl border font-semibold transition-all ${
                      tier.highlight
                        ? "bg-orange-500 hover:bg-orange-600 border-transparent text-white shadow-lg shadow-orange-500/25"
                        : "border-white/15 text-white hover:bg-white/5"
                    }`}
                  >
                    {tier.cta}
                  </Link>
                ) : (
                  <button
                    onClick={() => handleCheckout(tier.priceId)}
                    disabled={loading}
                    className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold transition-all ${
                      tier.highlight
                        ? "bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/25"
                        : "bg-white/5 hover:bg-white/10 border border-white/15 text-white"
                    }`}
                  >
                    {loading && tier.highlight && <Loader2 className="w-4 h-4 animate-spin" />}
                    {tier.cta}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Enterprise */}
          <div className="card-glass border border-white/8 rounded-2xl p-8 mb-16">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-1">Enterprise</p>
                  <h3 className="text-xl font-black text-white mb-2">Custom pricing for large teams</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 mt-3">
                    {ENTERPRISE_FEATURES.map((f) => (
                      <div key={f} className="flex items-center gap-2 text-sm text-gray-300">
                        <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <a
                href="/contact"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 font-semibold transition-all whitespace-nowrap flex-shrink-0"
              >
                <Mail className="w-4 h-4" />
                Contact for Enterprise
              </a>
            </div>
          </div>

          {/* FAQ */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-black text-white text-center mb-8">Common questions</h2>
            <div className="space-y-4">
              {FAQ.map(({ q, a }) => (
                <div key={q} className="card-glass border border-white/5 p-5 rounded-xl">
                  <p className="font-semibold text-white text-sm mb-2">{q}</p>
                  <p className="text-sm text-gray-400 leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <p className="mt-12 text-center text-xs text-gray-600 max-w-2xl mx-auto leading-relaxed">
            All data and risk signals are for informational and situational awareness purposes only.
            They do not constitute investment, trading, financial, or procurement advice.
            Consult qualified advisors before making energy procurement or financial decisions.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
