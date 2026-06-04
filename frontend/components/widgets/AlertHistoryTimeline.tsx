"use client";
import { Bell, Filter, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "https://texas-energy-risk-production.up.railway.app";

interface AlertLog {
  id:           string;
  alert_type:   string;
  risk_level:   string;
  trigger_reason: string;
  message:      string;
  ercot_price:  number;
  risk_score:   string;
  sent_at:      string;
  acknowledged_at?: string;
  location?:    string;
}

function riskColor(level: string): string {
  if (level === "high")   return "text-red-400";
  if (level === "medium") return "text-amber-400";
  return "text-green-400";
}

function riskBg(level: string): string {
  if (level === "high")   return "border-red-500/20 bg-red-500/5";
  if (level === "medium") return "border-amber-500/20 bg-amber-500/5";
  return "border-green-500/15 bg-green-500/3";
}

function RiskIcon({ level }: { level: string }) {
  if (level === "high")   return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
  if (level === "medium") return <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />;
  return <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.round(diff / 60000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function AlertHistoryTimeline() {
  const [alerts,      setAlerts]      = useState<AlertLog[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filterLevel, setFilterLevel] = useState("");
  const [dateRange,   setDateRange]   = useState("7d");

  useEffect(() => {
    const fetchAlerts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (filterLevel) params.set("risk_level", filterLevel);
        const r = await fetch(`${API}/api/alerts/logs/recent?${params}`);
        if (r.ok) {
          const data = await r.json();
          setAlerts(Array.isArray(data) ? data : data.logs || []);
        }
      } catch (e) {
        console.error("Alert history fetch failed", e);
      }
      setLoading(false);
    };
    fetchAlerts();
  }, [filterLevel, dateRange]);

  const filtered = alerts.filter(a => {
    if (filterLevel && a.risk_level !== filterLevel) return false;
    const daysMap: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30 };
    const cutoff = Date.now() - (daysMap[dateRange] || 7) * 86400000;
    return new Date(a.sent_at).getTime() >= cutoff;
  });

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-400" />
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Alert History Timeline</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3 h-3 text-gray-500" />
          <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-gray-300 focus:outline-none">
            <option value="" className="bg-gray-900">All levels</option>
            <option value="high" className="bg-gray-900">High</option>
            <option value="medium" className="bg-gray-900">Medium</option>
            <option value="low" className="bg-gray-900">Low</option>
          </select>
          <select value={dateRange} onChange={e => setDateRange(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-gray-300 focus:outline-none">
            <option value="1d" className="bg-gray-900">Last 24h</option>
            <option value="7d" className="bg-gray-900">Last 7 days</option>
            <option value="30d" className="bg-gray-900">Last 30 days</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-xs text-gray-500">Loading alert history...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8">
          <Bell className="w-8 h-8 text-gray-700 mx-auto mb-2" />
          <p className="text-xs text-gray-500">No alerts in this period.</p>
          <p className="text-[10px] text-gray-700 mt-1">Alerts fire when risk level changes or thresholds are breached.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((alert) => (
            <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-xl border ${riskBg(alert.risk_level)}`}>
              <RiskIcon level={alert.risk_level} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-[10px] font-bold uppercase ${riskColor(alert.risk_level)}`}>
                    {alert.risk_level.toUpperCase()} RISK
                    {alert.location ? ` · ${alert.location}` : ""}
                  </span>
                  <span className="text-[9px] text-gray-600">{timeAgo(alert.sent_at)}</span>
                </div>
                <p className="text-xs font-medium text-gray-200 mb-0.5">
                  {alert.trigger_reason || alert.alert_type || "Risk condition change"}
                </p>
                {alert.message && (
                  <p className="text-[10px] text-gray-400 leading-relaxed line-clamp-2">{alert.message}</p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  {alert.ercot_price > 0 && (
                    <span className="text-[9px] text-gray-500">ERCOT: ${alert.ercot_price.toFixed(2)}/MWh</span>
                  )}
                  <span className={`text-[9px] font-semibold ${alert.acknowledged_at ? "text-green-400" : "text-gray-500"}`}>
                    {alert.acknowledged_at ? "✓ Resolved" : "Active"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
