"use client";
import { useEffect, useState } from "react";
import { TrendingUp, Clock, AlertTriangle, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "https://texas-energy-risk-production.up.railway.app";

interface Horizon {
  horizon:      string;
  label:        string;
  risk:         string;
  risk_label:   string;
  color:        string;
  primary_driver: string;
  drivers:      string[];
  confidence:   number;
}

interface ForecastData {
  computed_at:    string;
  location:       string;
  overall_risk:   string;
  overall_label:  string;
  overall_color:  string;
  horizons:       Horizon[];
  narrative:      string;
  disclaimer:     string;
}

const RISK_STYLES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  low:      { bg: "bg-green-500/8",   border: "border-green-500/20",  text: "text-green-400",  badge: "bg-green-500/15 border-green-500/25 text-green-300" },
  watch:    { bg: "bg-amber-500/8",   border: "border-amber-500/20",  text: "text-amber-400",  badge: "bg-amber-500/15 border-amber-500/25 text-amber-300" },
  elevated: { bg: "bg-orange-500/8",  border: "border-orange-500/20", text: "text-orange-400", badge: "bg-orange-500/15 border-orange-500/25 text-orange-300" },
  high:     { bg: "bg-red-500/8",     border: "border-red-500/20",    text: "text-red-400",    badge: "bg-red-500/15 border-red-500/25 text-red-300" },
};

function RiskBadge({ risk, label }: { risk: string; label: string }) {
  const s = RISK_STYLES[risk] || RISK_STYLES.low;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-black tracking-widest ${s.badge}`}>
      {label}
    </span>
  );
}

function ConfidenceBar({ value, risk }: { value: number; risk: string }) {
  const s = RISK_STYLES[risk] || RISK_STYLES.low;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${s.text.replace("text-", "bg-")}`}
          style={{ width: `${value}%`, opacity: 0.7 }} />
      </div>
      <span className="text-[10px] text-gray-500 font-mono w-8 text-right">{value}%</span>
    </div>
  );
}

function HorizonCard({ h, expanded, onToggle }: { h: Horizon; expanded: boolean; onToggle: () => void }) {
  const s = RISK_STYLES[h.risk] || RISK_STYLES.low;
  const icons: Record<string, string> = { "24h": "24H", "72h": "72H", "7d": "7D" };

  return (
    <div className={`rounded-xl border transition-all ${s.bg} ${s.border}`}>
      <button onClick={onToggle} className="w-full p-3.5 flex items-center gap-3 text-left">
        {/* Time label */}
        <div className={`w-10 h-10 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-[11px] font-black ${s.text}`}>
          {icons[h.horizon]}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-400 font-medium mb-0.5">{h.label} Outlook</p>
          <p className="text-xs text-gray-300 truncate">{h.primary_driver}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <RiskBadge risk={h.risk} label={h.risk_label} />
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-2.5">
          <div className="h-px bg-white/5" />
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">Risk Drivers</p>
            <ul className="space-y-1">
              {h.drivers.length > 0 ? h.drivers.map((d, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-gray-300">
                  <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.text.replace("text-", "bg-")}`} />
                  {d}
                </li>
              )) : (
                <li className="text-xs text-gray-500">No significant drivers detected</li>
              )}
            </ul>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Model Confidence</p>
            <ConfidenceBar value={h.confidence} risk={h.risk} />
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  location?: string;
}

export default function ForecastRiskOutlook({ location = "Houston" }: Props) {
  const [data,     setData]     = useState<ForecastData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<string>("24h"); // default first open
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetch_ = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/signals/forecast?location=${encodeURIComponent(location)}`);
      if (r.ok) {
        setData(await r.json());
        setLastFetch(new Date());
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, [location]);

  // Auto-refresh every 15 minutes
  useEffect(() => {
    const t = setInterval(fetch_, 15 * 60 * 1000);
    return () => clearInterval(t);
  }, [location]);

  const overall = data ? (RISK_STYLES[data.overall_risk] || RISK_STYLES.low) : RISK_STYLES.low;
  const age = lastFetch ? Math.floor((Date.now() - lastFetch.getTime()) / 60000) : null;

  return (
    <div className={`card-glass rounded-2xl border overflow-hidden ${data ? overall.border : "border-white/8"}`}>
      {/* Header */}
      <div className={`px-4 pt-4 pb-3 ${data ? overall.bg : ""}`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className={`w-4 h-4 ${data ? overall.text : "text-gray-400"}`} />
            <div>
              <h3 className="text-sm font-bold text-white">Forecast Risk Outlook</h3>
              <p className="text-[10px] text-gray-500">AI-generated · {location}, TX</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data && <RiskBadge risk={data.overall_risk} label={data.overall_label} />}
            <button onClick={fetch_} disabled={loading}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all disabled:opacity-40"
              title="Refresh forecast">
              <RefreshCw className={`w-3 h-3 text-gray-400 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Overall risk summary strip */}
        {data && (
          <div className="flex items-center gap-2 mb-3">
            {data.horizons.map(h => {
              const hs = RISK_STYLES[h.risk] || RISK_STYLES.low;
              return (
                <div key={h.horizon} className={`flex-1 rounded-lg border py-1.5 text-center ${hs.bg} ${hs.border}`}>
                  <p className="text-[9px] text-gray-500 font-medium">{h.label}</p>
                  <p className={`text-[11px] font-black ${hs.text}`}>{h.risk_label}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* AI Narrative */}
        {loading && !data && (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-white/5 rounded w-full" />
            <div className="h-3 bg-white/5 rounded w-5/6" />
            <div className="h-3 bg-white/5 rounded w-4/6" />
          </div>
        )}
        {data?.narrative && (
          <div className={`rounded-xl border p-3 ${overall.bg} ${overall.border}`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className={`w-3 h-3 ${overall.text}`} />
              <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wide">What Happens Next</p>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">{data.narrative}</p>
          </div>
        )}
      </div>

      {/* Horizon cards */}
      {data && (
        <div className="px-4 pb-4 space-y-2">
          {data.horizons.map(h => (
            <HorizonCard
              key={h.horizon}
              h={h}
              expanded={expanded === h.horizon}
              onToggle={() => setExpanded(prev => prev === h.horizon ? "" : h.horizon)}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      {data && (
        <div className="px-4 pb-3 flex items-center justify-between">
          {age !== null && (
            <div className="flex items-center gap-1 text-[10px] text-gray-600">
              <Clock className="w-3 h-3" />
              {age === 0 ? "Just updated" : `Updated ${age}m ago`}
            </div>
          )}
          <p className="text-[10px] text-gray-600 italic">{data.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
