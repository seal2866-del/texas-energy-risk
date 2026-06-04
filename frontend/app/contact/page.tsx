"use client";
import { useState } from "react";
import { CheckCircle, Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import type { Metadata } from "next";

export default function ContactPage() {
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [company, setCompany] = useState("");
  const [title,   setTitle]   = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");

    try {
      // Send via mailto as form submission
      const subject = encodeURIComponent(`Texas Grid Intel Enterprise Inquiry — ${company}`);
      const body    = encodeURIComponent(
        `Name: ${name}\nEmail: ${email}\nCompany: ${company}\nTitle: ${title}\n\nMessage:\n${message}`
      );
      window.location.href = `mailto:wnguyen@myinfinivue.com?subject=${subject}&body=${body}`;
      setSent(true);
    } catch {
      setError("Something went wrong. Please email us directly at wnguyen@myinfinivue.com");
    }
    setLoading(false);
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#080d1a] pt-28 pb-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">

          <Link href="/pricing" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-8">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Pricing
          </Link>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-4">
              Enterprise Inquiry
            </div>
            <h1 className="text-3xl font-black text-white mb-3">Contact Texas Grid Intel</h1>
            <p className="text-gray-400 leading-relaxed">
              Tell us about your organization and energy risk monitoring needs. We'll respond within one business day.
            </p>
          </div>

          {sent ? (
            <div className="card-glass border border-green-500/20 rounded-2xl p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-black text-white mb-2">Message Sent</h2>
              <p className="text-gray-400 text-sm mb-6">
                Your email client should have opened with your message. If it didn't, please email us directly:
              </p>
              <a href="mailto:wnguyen@myinfinivue.com" className="text-orange-400 hover:text-orange-300 font-semibold text-sm underline">
                wnguyen@myinfinivue.com
              </a>
              <div className="mt-6">
                <Link href="/pricing" className="text-xs text-gray-500 hover:text-gray-300">← Return to Pricing</Link>
              </div>
            </div>
          ) : (
            <div className="card-glass border border-white/8 rounded-2xl p-8">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">Full Name *</label>
                    <input type="text" required value={name} onChange={e => setName(e.target.value)}
                      placeholder="John Smith"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">Work Email *</label>
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="john@company.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">Company *</label>
                    <input type="text" required value={company} onChange={e => setCompany(e.target.value)}
                      placeholder="Acme Energy"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">Title</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                      placeholder="VP Operations"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">How can we help?</label>
                  <textarea rows={4} value={message} onChange={e => setMessage(e.target.value)}
                    placeholder="Tell us about your energy risk monitoring needs, team size, and any specific requirements..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40 resize-none" />
                </div>

                {error && <p className="text-xs text-red-400">{error}</p>}

                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-lg shadow-orange-500/20">
                  {loading ? "Opening email..." : "Send Message"}
                </button>

                <p className="text-[11px] text-gray-600 text-center">
                  Or email us directly: <a href="mailto:wnguyen@myinfinivue.com" className="text-blue-400 hover:text-blue-300">wnguyen@myinfinivue.com</a>
                </p>
              </form>
            </div>
          )}

          {/* What to expect */}
          <div className="mt-8 p-5 rounded-xl bg-white/3 border border-white/6">
            <h3 className="text-sm font-bold text-white mb-3">What to expect</h3>
            <div className="space-y-2">
              {[
                "Response within 1 business day",
                "15-minute executive briefing call",
                "Custom pricing for your team size",
                "Live dashboard demonstration",
              ].map(item => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-xs text-gray-300">{item}</span>
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
