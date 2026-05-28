"use client";
/**
 * /app/map/page.tsx
 * Phase 7 — Statewide Grid Intelligence Map
 * Live ERCOT zone risk overview across all 8 monitored Texas locations.
 */
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, MapPin, Zap, Activity, Shield } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import TexasGridMap from "@/components/widgets/TexasGridMap";
import { getGridOverview, type GridZoneEntry, type GridSummary } from "@/lib/api";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const EMPTY_SUMMARY: GridSummary = {
  total_locations:   8,
  reporting_count:   0,
  high_risk_count:   0,
  medium_risk_count: 0,
  statewide_status:  "low",
  worst_location:    null,
  computed_at:       new Date().toISOString(),
};

function ZoneDetailCard({ zone }: { zone: GridZoneEntry }) {
  const risk   = zone.risk_score;
  const border = risk === "high" ? "border-red-500/30" : risk === "medium" ? "border-amber-500/30" : "border-green-500/15";
  const bg     = risk === "high" ? "bg-red-500/5"      : risk === "medium" ? "bg-amber-500/5"     : "bg-green-500/3";
  const text   = risk === "high" ? "text-red-400"      : risk === "medium" ? "text-amber-400"     : "text-green-400";

  return (
    <div className={cn("rounded-xl border p-4 space-y-2 transition-all", border, bg)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-sm font-bold text-white">{zone.location}</span>
        </div>
        <span className={cn("text-xs font-bold uppercase", text)}>{zone.risk_score}</span>
      </div>

      <p className="text-xs text-gray-600">{zone.ercot_zone}</p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {zone.ercot_price != null && (
          <span className="text-gray-500">Price: <span className="text-gray-300">${zone.ercot_price.toFixed(2)}/MWh</span></span>
        )}
        {zone.confidence != null && (
          <span className="text-gray-500">Conf: <span className="text-gray-300">{zone.confidence}%</span></span>
        )}
        {zone.risk_direction && (
          <span className="text-gray-500">Trend: <span className="text-gray-300 capitalize">{zone.risk_direction}</span></span>
        )}
      </div>

      {zone.primary_driver && (
        <p className="text-xs text-gray-500 leading-snug border-t border-white/5 pt-1.5">
          {zone.primary_driver}
        </p>
      )}

      {zone.is_stale && (
        <p className="text-xs text-amber-600">⚠ Data stale — last seen {zone.computed_at
          ? new Date(zone.computed_at).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit" }) + " CDT"
          : "unknown"
        }</p>
      )}
    </div>
  );
}

export default function GridMapPage() {
  const router = useRouter();
  const [user,    setUser]    = useState<any>(null);
  const [zones,   setZones]   = useState<GridZoneEntry[]>([]);
  const [summary, setSummary] = useState<GridSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace("/login"); return; }
      setUser(data.user);
    });
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getGridOverview();
      setZones(data.zones);
      setSummary(data.summary);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
      const interval = setInterval(fetchData, 5 * 60 * 1000); // refresh every 5 min
      return () => clearInterval(interval);
    }
  }, [user, fetchData]);

  if (!user) return null;

  const highZones   = zones.filter(z => z.risk_score === "high");
  const mediumZones = zones.filter(z => z.risk_score === "medium");

  return (
    <>
      <Navbar />
      <main className="pt-24 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-orange-400" />
              <h1 className="text-2xl font-black text-white">Texas Grid Intelligence</h1>
            </div>
            <p className="text-sm text-gray-500">
              Real-time risk overview across all 8 monitored ERCOT zones. Updates every 5 minutes.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-red-500/8 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">Unable to load grid data. Retrying automatically.</p>
              <button onClick={fetchData} className="ml-auto text-xs text-red-400 hover:text-red-300 underline">
                Retry now
              </button>
            </div>
          )}

          {/* Statewide summary bar */}
          {!loading && !error && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { icon: <Shield className="w-4 h-4" />, label: "Statewide Status", value: summary.statewide_status.toUpperCase(),
                  cls: summary.statewide_status === "high" ? "text-red-400" : summary.statewide_status === "medium" ? "text-amber-400" : "text-green-400" },
                { icon: <AlertTriangle className="w-4 h-4 text-red-400" />, label: "High Risk Zones", value: String(summary.high_risk_count), cls: "text-red-400" },
                { icon: <AlertTriangle className="w-4 h-4 text-amber-400" />, label: "Medium Risk Zones", value: String(summary.medium_risk_count), cls: "text-amber-400" },
                { icon: <Zap className="w-4 h-4 text-gray-400" />, label: "Zones Reporting", value: `${summary.reporting_count}/${summary.total_locations}`, cls: "text-gray-300" },
              ].map(({ icon, label, value, cls }) => (
                <div key={label} className="card-glass border border-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2 text-gray-500">{icon}<span className="text-xs">{label}</span></div>
                  <p className={cn("text-xl font-black", cls)}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Main map */}
          <div className="mb-8">
            <TexasGridMap
              zones={zones}
              summary={summary}
              loading={loading}
              onRefresh={fetchData}
            />
          </div>

          {/* Elevated zones detail */}
          {(highZones.length > 0 || mediumZones.length > 0) && (
            <div className="mb-8">
              <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Elevated Zones
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...highZones, ...mediumZones].map(zone => (
                  <ZoneDetailCard key={zone.location} zone={zone} />
                ))}
              </div>
            </div>
          )}

          {/* All zones grid */}
          <div>
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              All Monitored Locations
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {zones.map(zone => (
                <ZoneDetailCard key={zone.location} zone={zone} />
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-10 px-4 py-3 rounded-xl bg-white/2 border border-white/5">
            <p className="text-xs text-gray-600 leading-relaxed">
              TX Energy Risk grid intelligence is for informational purposes only. Risk assessments
              are probabilistic and do not constitute investment, trading, procurement, or operational advice.
              ERCOT zone boundaries are approximate. Always consult qualified professionals before operational decisions.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
