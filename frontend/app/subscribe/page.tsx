"use client";
import { useState } from "react";
import Link from "next/link";
import { Mail, Zap, Shield, TrendingUp, Bell, CheckCircle2, Loader2, ArrowRight } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "https://texas-energy-risk-production.up.railway.app";

const INDUSTRIES = [
  "Oil & Gas", "Manufacturing", "Chemical / Petrochemical", "Data Centers",
  "Midstream / Pipeline", "Refining", "Industrial", "Energy Trading",
  "Power Generation", "Energy Procurement", "Other",
];

const FEATURES = [
  { icon: Bell,        label: "Weekly Risk Brief",     desc: "Every Monday — ERCOT conditions, Henry Hub, grid status" },
  { icon: TrendingUp,  label: "Live Price Signals",    desc: "ERCOT price levels, DAM vs RT, hub spread alerts" },
  { icon: Zap,         label: "Early Warning Signals", desc: "Heat waves, EEA risk, supply constraints — before they hit" },
  { icon: Shield,      label: "Operational Intel",     desc: "Actionable guidance — not financial advice, just what to watch" },
];

export default function SubscribePage() {
  const [email,     setEmail]     = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [company,   setCompany]   = useState("");
  const [title,     setTitle]     = useState("");
  const [industry,  setIndustry]  = useState("");
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !firstName) { setError("Email and first name are required."); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API}/api/newsletter/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          first_name: firstName,
          last_name:  lastName,
          company,
          title,
          industry,
          source: "subscribe_page",
        }),
      });
      const d = await r.json();
      if (r.ok || d.status === "already_subscribed" || d.status === "resubscribed") {
        setDone(true);
      } else {
        setError(d.detail || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Connection error. Please try again.");
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#080d1a] flex flex-col">

      {/* Top bar */}
      <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-black text-white">Texas Grid Intel</span>
        </Link>
        <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-200 transition-all flex items-center gap-1">
          View Dashboard <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg">

          {done ? (
            /* ── SUCCESS STATE ── */
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <h1 className="text-2xl font-black text-white mb-2">You're subscribed ✓</h1>
              <p className="text-gray-400 text-sm mb-2">
                Welcome to the <strong className="text-white">Texas Energy Risk Brief</strong>.
              </p>
              <p className="text-gray-500 text-sm mb-8">
                You'll receive your first issue next Monday morning. In the meantime, check the live dashboard for real-time ERCOT conditions.
              </p>
              <Link href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl text-sm font-bold text-white transition-all">
                View Live Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

          ) : (
            <>
              {/* ── HEADER ── */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-xs font-semibold text-orange-400 mb-4">
                  <Mail className="w-3 h-3" /> Free Weekly Newsletter
                </div>
                <h1 className="text-3xl font-black text-white mb-3 leading-tight">
                  Texas Energy Risk Brief
                </h1>
                <p className="text-gray-400 text-sm leading-relaxed max-w-sm mx-auto">
                  Weekly ERCOT intelligence for Texas energy managers, traders, and operations teams. Know what's happening — before it affects your facility.
                </p>
              </div>

              {/* ── FEATURE PILLS ── */}
              <div className="grid grid-cols-2 gap-2 mb-8">
                {FEATURES.map(f => (
                  <div key={f.label} className="bg-white/3 border border-white/8 rounded-xl p-3 flex gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <f.icon className="w-3.5 h-3.5 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{f.label}</p>
                      <p className="text-[10px] text-gray-500 leading-snug mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── FORM ── */}
              <form onSubmit={submit} className="bg-white/3 border border-white/8 rounded-2xl p-6 space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4">Subscribe — it's free</p>

                {/* Name row */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">First Name *</label>
                    <input value={firstName} onChange={e => setFirstName(e.target.value)} required
                      placeholder="Nathan"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">Last Name</label>
                    <input value={lastName} onChange={e => setLastName(e.target.value)}
                      placeholder="Moore"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50" />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">Work Email *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    placeholder="you@company.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50" />
                </div>

                {/* Company + Title */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">Company</label>
                    <input value={company} onChange={e => setCompany(e.target.value)}
                      placeholder="SM Energy"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">Job Title</label>
                    <input value={title} onChange={e => setTitle(e.target.value)}
                      placeholder="Operations Manager"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50" />
                  </div>
                </div>

                {/* Industry */}
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">Industry</label>
                  <select value={industry} onChange={e => setIndustry(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-orange-500/50">
                    <option value="" className="bg-gray-900">Select your industry</option>
                    {INDUSTRIES.map(i => <option key={i} value={i} className="bg-gray-900">{i}</option>)}
                  </select>
                </div>

                {error && <p className="text-xs text-red-400">{error}</p>}

                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-xl text-sm font-bold text-white transition-all mt-2">
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Subscribing...</>
                    : <><Mail className="w-4 h-4" /> Subscribe to Weekly Brief</>
                  }
                </button>

                <p className="text-[10px] text-gray-600 text-center leading-snug pt-1">
                  Free. No spam. Unsubscribe any time.<br />
                  Operational intelligence only — not financial advice.
                </p>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/5 px-6 py-4 text-center">
        <p className="text-[10px] text-gray-600">
          © 2026 Texas Grid Intel · <Link href="/dashboard" className="hover:text-gray-400">Dashboard</Link> · <Link href="/pricing" className="hover:text-gray-400">Pricing</Link>
        </p>
      </div>

    </main>
  );
}
