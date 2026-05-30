"use client";
import { useState } from "react";
import { Mail, CheckCircle } from "lucide-react";

const INDUSTRIES = [
  "Oil & Gas Operations",
  "Midstream Infrastructure",
  "Industrial Energy",
  "Energy Procurement",
  "Data Center Operations",
  "Manufacturing",
  "Facilities Management",
  "Energy Consulting",
  "Utility / Infrastructure",
  "Other",
];

export default function NewsletterSignup() {
  const [email,    setEmail]    = useState("");
  const [company,  setCompany]  = useState("");
  const [title,    setTitle]    = useState("");
  const [city,     setCity]     = useState("");
  const [industry, setIndustry] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [error,    setError]    = useState("");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://texas-energy-risk-production.up.railway.app";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${apiUrl}/api/newsletter/subscribe`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company, title, city, industry, source: "homepage" }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.detail || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
        <p className="text-lg font-bold text-white mb-1">You're subscribed.</p>
        <p className="text-sm text-gray-400">You'll receive the Texas Energy Risk Brief every Monday morning.</p>
      </div>
    );
  }

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-2">
        <Mail className="w-5 h-5 text-orange-400 flex-shrink-0" />
        <h3 className="text-lg font-black text-white">Get the Weekly Texas Energy Risk Brief</h3>
      </div>
      <p className="text-sm text-gray-400 mb-6 ml-8">
        Weekly operational intelligence for ERCOT pricing, weather demand, and natural gas supply conditions.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="email" required
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email address *"
            className="col-span-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40"
          />
          <input
            type="text"
            value={company} onChange={e => setCompany(e.target.value)}
            placeholder="Company"
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40"
          />
          <input
            type="text"
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Role / Title"
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40"
          />
          <input
            type="text"
            value={city} onChange={e => setCity(e.target.value)}
            placeholder="City (e.g. Houston, Midland)"
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40"
          />
          <select
            value={industry} onChange={e => setIndustry(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-300 focus:outline-none focus:border-orange-500/40"
          >
            <option value="" className="bg-gray-900">Industry</option>
            {INDUSTRIES.map(i => (
              <option key={i} value={i} className="bg-gray-900">{i}</option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-xs text-red-400 px-1">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-sm transition-all"
        >
          {loading ? "Subscribing..." : "Subscribe to Brief"}
        </button>

        <p className="text-[10px] text-gray-600 text-center leading-relaxed">
          By subscribing, you agree to receive weekly operational energy intelligence from TX Energy Risk.
          You may unsubscribe at any time. Not investment or procurement advice.
        </p>
      </form>
    </div>
  );
}
