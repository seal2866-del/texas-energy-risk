"use client";
import { useEffect, useState } from "react";
import { Zap, AlertTriangle, CheckCircle, RefreshCw, Activity, Wind, Sun } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "https://texas-energy-risk-production.up.railway.app";

interface EEALevel {
  level:       number;
  label:       string;
  color:       string;
  description: string;
  triggered:   boolean;
}

interface SystemData {
  demand_mw:     number | null;
  capacity_mw:   number | null;
  reserve_mw:    number | null;
  reserve_pct:   number | null;
  wind_mw:       number | null;
  solar_mw:      number | null;
  wind_pct:      number | null;
  solar_pct:     number | null;
  renewable_pct: number | null;
  frequency:     number | null;
  eea:           EEALevel;
}

interface GridData {
  computed_at: string;
  system:      SystemData;
  error?:      string;
}

const EEA_STEPS = [
  { key: "NORMAL",      label: "Normal",      color: "#22c55e" },
  { key: "WATCH",       label: "EEA Watch",   color: "#f59e0b" },
  { key: "WARNING",     label: "EEA Warning", color: "#f97316" },
  { key: "EMERGENCY 1", label: "Emergency 1", color: "#ef4444" },
  { key: "EMERGENCY 2", label: "Emergency 2", color: "#dc2626" },
  { key: "EMERGENCY 3", label: "Emergency 3", color: "#7c3aed" },
];

export default function EEATracker() {
  const [data, setData]       = useState<GridData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/ercot/grid`);
      if (r.ok) setData(await r.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const sys  = data?.system;
  const eea  = sys?.eea;
  const triggered = eea?.triggered ?? false;
  const borderColor = triggered ? "border-red-500/30" : "border-white/8";
  const bgColor     = triggered ? "bg-red-500/5" : "";

  const stepIndex = eea
    ? eea.level === -2 ? 0 : eea.level === -1 ? 1 : eea.level === 0 ? 2
      : eea.level === 1 ? 3 : eea.level === 2 ? 4 : 5
    : 0;

  return (
    <div className={`card-glass rounded-2xl border overflow-hidden ${borderColor} ${bgColor}`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${triggered ? "text-red-400" : "text-green-400"}`} />
          <div>
            <h3 className="text-sm font-bold text-white">ERCOT Grid Status</h3>
            <p className="text-[10px] text-gray-500">Reserve margin · Emergency level · Generation mix</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {eea && (
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-black border"
              style={{ color: eea.color, borderColor: eea.color + "40", backgroundColor: eea.color + "15" }}>
              {eea.label}
            </span>
          )}
          <button onClick={load} disabled={loading}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
            <RefreshCw className={`w-3 h-3 text-gray-400 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="px-4 pb-4 space-y-2 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-8 bg-white/5 rounded-xl" />)}
        </div>
      )}

      {sys && (
        <div className="px-4 pb-4 space-y-3">
          {/* EEA description */}
          {eea && (
            <div className="rounded-xl border p-3 flex items-start gap-2"
              style={{ borderColor: eea.color + "30", backgroundColor: eea.color + "08" }}>
              {triggered
                ? <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: eea.color }} />
                : <CheckCircle  className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: eea.color }} />
              }
              <p className="text-xs text-gray-300">{eea.description}</p>
            </div>
          )}

          {/* EEA escalation ladder */}
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Emergency Level</p>
            <div className="flex gap-1">
              {EEA_STEPS.map((step, i) => (
                <div key={step.key} className="flex-1 h-2 rounded-full transition-all"
                  style={{
                    backgroundColor: i <= stepIndex ? step.color : "#ffffff10",
                    opacity: i === stepIndex ? 1 : i < stepIndex ? 0.7 : 0.2,
                  }} />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-gray-600">Normal</span>
              <span className="text-[9px] text-gray-600">Emergency 3</span>
            </div>
          </div>

          {/* Reserve margin */}
          {sys.reserve_mw !== null && sys.capacity_mw !== null && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white/3 border border-white/8 p-2.5 text-center">
                <p className="text-[10px] text-gray-500 mb-1">Demand</p>
                <p className="text-sm font-black text-white">
                  {sys.demand_mw ? (sys.demand_mw / 1000).toFixed(1) : "—"}
                  <span className="text-[10px] text-gray-500 font-normal ml-0.5">GW</span>
                </p>
              </div>
              <div className="rounded-xl bg-white/3 border border-white/8 p-2.5 text-center">
                <p className="text-[10px] text-gray-500 mb-1">Reserve</p>
                <p className={`text-sm font-black ${(sys.reserve_pct ?? 0) < 5 ? "text-red-400" : (sys.reserve_pct ?? 0) < 10 ? "text-amber-400" : "text-green-400"}`}>
                  {sys.reserve_pct?.toFixed(1) ?? "—"}
                  <span className="text-[10px] font-normal text-gray-500 ml-0.5">%</span>
                </p>
              </div>
              <div className="rounded-xl bg-white/3 border border-white/8 p-2.5 text-center">
                <p className="text-[10px] text-gray-500 mb-1">Capacity</p>
                <p className="text-sm font-black text-white">
                  {sys.capacity_mw ? (sys.capacity_mw / 1000).toFixed(1) : "—"}
                  <span className="text-[10px] text-gray-500 font-normal ml-0.5">GW</span>
                </p>
              </div>
            </div>
          )}

          {/* Generation mix */}
          {(sys.wind_pct !== null || sys.solar_pct !== null) && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Generation Mix</p>
              <div className="grid grid-cols-2 gap-2">
                {sys.wind_pct !== null && (
                  <div className="rounded-xl bg-blue-500/5 border border-blue-500/15 p-2.5 flex items-center gap-2">
                    <Wind className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-500">Wind</p>
                      <p className="text-sm font-black text-blue-400">{sys.wind_pct}%
                        <span className="text-[10px] text-gray-500 font-normal ml-1">of load</span>
                      </p>
                    </div>
                  </div>
                )}
                {sys.solar_pct !== null && (
                  <div className="rounded-xl bg-yellow-500/5 border border-yellow-500/15 p-2.5 flex items-center gap-2">
                    <Sun className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-500">Solar</p>
                      <p className="text-sm font-black text-yellow-400">{sys.solar_pct}%
                        <span className="text-[10px] text-gray-500 font-normal ml-1">of load</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {sys.wind_pct !== null && sys.wind_pct < 15 && (
                <p className="text-[10px] text-amber-400 mt-1.5">
                  ⚡ Low wind generation — price spike risk elevated
                </p>
              )}
            </div>
          )}

          {/* Frequency */}
          {sys.frequency && (
            <div className="flex items-center justify-between text-[10px] text-gray-500">
              <span>Grid Frequency</span>
              <span className={`font-mono font-bold ${Math.abs(sys.frequency - 60) > 0.1 ? "text-amber-400" : "text-green-400"}`}>
                {sys.frequency.toFixed(3)} Hz
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
