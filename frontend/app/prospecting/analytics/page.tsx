"use client";
import { useEffect, useState } from "react";
import { ArrowRight, TrendingUp, Users, Mail, MousePointer, Calendar, Star } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "https://texas-energy-risk-production.up.railway.app";

interface Analytics {
  funnel: Record<string, number>;
  rates:  Record<string, number>;
  by_industry: Record<string, number>;
  by_region:   Record<string, number>;
  top_prospects: any[];
  recent_demos:  any[];
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-xs text-gray-400 text-right flex-shrink-0">{label}</div>
      <div className="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden relative">
        <div className={`h-full rounded-lg ${color} transition-all`} style={{ width: `${pct}%` }} />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
          {value}
        </span>
      </div>
      <div className="w-10 text-xs text-gray-500 flex-shrink-0">{pct}%</div>
    </div>
  );
}

export default function ProspectingAnalytics() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch(`${API}/api/prospecting/analytics`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data) return (
    <>
      <Navbar />
      <main className="pt-24 min-h-screen bg-[#080d1a] flex items-center justify-center">
        <p className="text-gray-400">Loading analytics...</p>
      </main>
    </>
  );

  const funnel   = data.funnel;
  const rates    = data.rates;
  const maxFunnel = funnel.total || 1;

  const funnelSteps = [
    { label: "Total Prospects",    key: "total",            color: "bg-blue-500" },
    { label: "Newsletter Added",   key: "newsletter_added", color: "bg-purple-500" },
    { label: "Opened",             key: "opened",           color: "bg-cyan-500" },
    { label: "Clicked",            key: "clicked",          color: "bg-teal-500" },
    { label: "Demo Requested",     key: "demo_requested",   color: "bg-amber-500" },
    { label: "Qualified",          key: "qualified",        color: "bg-orange-500" },
    { label: "Customers",          key: "customers",        color: "bg-green-500" },
  ];

  return (
    <>
      <Navbar />
      <main className="pt-24 min-h-screen bg-[#080d1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black text-white">Prospect Analytics</h1>
              <p className="text-sm text-gray-400">Conversion funnel and engagement metrics</p>
            </div>
            <Link href="/prospecting"
              className="text-xs text-orange-400 hover:text-orange-300 font-semibold">
              ← Back to Prospecting
            </Link>
          </div>

          {/* Rate KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {[
              { label: "Newsletter Rate", value: `${rates.newsletter_rate}%`, icon: Mail,         color: "text-purple-400" },
              { label: "Open Rate",       value: `${rates.open_rate}%`,       icon: TrendingUp,   color: "text-cyan-400" },
              { label: "Click Rate",      value: `${rates.click_rate}%`,      icon: MousePointer, color: "text-teal-400" },
              { label: "Demo Rate",       value: `${rates.demo_rate}%`,       icon: Calendar,     color: "text-amber-400" },
              { label: "Conversion",      value: `${rates.conversion_rate}%`, icon: Star,         color: "text-green-400" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card-glass border border-white/8 rounded-xl p-4 text-center">
                <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
                <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                <p className={`text-xl font-black ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Funnel */}
            <div className="card-glass border border-white/8 rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">Conversion Funnel</p>
              <div className="space-y-2">
                {funnelSteps.map(s => (
                  <FunnelBar
                    key={s.key}
                    label={s.label}
                    value={funnel[s.key] || 0}
                    max={maxFunnel}
                    color={s.color}
                  />
                ))}
              </div>
            </div>

            {/* By Industry + Region */}
            <div className="space-y-4">
              <div className="card-glass border border-white/8 rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Top Industries</p>
                <div className="space-y-1.5">
                  {Object.entries(data.by_industry).slice(0, 6).map(([ind, count]) => (
                    <div key={ind} className="flex items-center justify-between">
                      <span className="text-xs text-gray-300 truncate">{ind || "Unknown"}</span>
                      <span className="text-xs font-bold text-gray-400 flex-shrink-0 ml-2">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card-glass border border-white/8 rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Top Regions</p>
                <div className="space-y-1.5">
                  {Object.entries(data.by_region).slice(0, 6).map(([reg, count]) => (
                    <div key={reg} className="flex items-center justify-between">
                      <span className="text-xs text-gray-300">{reg || "Unknown"}</span>
                      <span className="text-xs font-bold text-gray-400">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Top Prospects + Recent Demos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card-glass border border-white/8 rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Highest Scoring Prospects</p>
              <div className="space-y-2">
                {data.top_prospects.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                    <span className={`text-sm font-black ${p.lead_score >= 65 ? "text-red-400" : p.lead_score >= 40 ? "text-amber-400" : "text-green-400"}`}>
                      {p.lead_score}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-200 truncate">{p.company_name}</p>
                      <p className="text-[10px] text-gray-500">{p.contact_title}</p>
                    </div>
                    <span className="text-[9px] text-gray-600">{p.state}</span>
                  </div>
                ))}
                {data.top_prospects.length === 0 && (
                  <p className="text-xs text-gray-600 text-center py-4">No prospects yet</p>
                )}
              </div>
            </div>

            <div className="card-glass border border-white/8 rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Recent Demo Requests</p>
              <div className="space-y-2">
                {data.recent_demos.map((d: any) => (
                  <div key={d.id} className="py-1.5 border-b border-white/5 last:border-0">
                    <p className="text-xs font-semibold text-gray-200">{d.company_name}</p>
                    <p className="text-[10px] text-gray-500">{d.contact_name} · {new Date(d.requested_at).toLocaleDateString()}</p>
                  </div>
                ))}
                {data.recent_demos.length === 0 && (
                  <p className="text-xs text-gray-600 text-center py-4">No demo requests yet</p>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
