"use client";
/**
 * TexasGridMap.tsx
 * Phase 7 — Multi-Location Grid Intelligence
 * SVG Texas ERCOT zone map with live risk coloring per zone.
 */
import { useState } from "react";
import { AlertTriangle, RefreshCw, MapPin, Zap, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GridZoneEntry, GridSummary, RiskScore } from "@/lib/api";

interface Props {
  zones:       GridZoneEntry[];
  summary:     GridSummary;
  loading?:    boolean;
  onRefresh?:  () => void;
}

// Risk color palette
const RISK_COLORS = {
  high:    { fill: "rgba(239,68,68,0.25)",  stroke: "rgba(239,68,68,0.7)",  label: "#ef4444", badge: "bg-red-500/20 border-red-500/40 text-red-300" },
  medium:  { fill: "rgba(245,158,11,0.25)", stroke: "rgba(245,158,11,0.7)", label: "#f59e0b", badge: "bg-amber-500/20 border-amber-500/40 text-amber-300" },
  low:     { fill: "rgba(34,197,94,0.20)",  stroke: "rgba(34,197,94,0.5)",  label: "#22c55e", badge: "bg-green-500/20 border-green-500/40 text-green-300" },
  unknown: { fill: "rgba(255,255,255,0.04)", stroke: "rgba(255,255,255,0.15)", label: "#6b7280", badge: "bg-white/5 border-white/10 text-gray-500" },
};

function riskColor(risk: string) {
  return RISK_COLORS[risk as keyof typeof RISK_COLORS] ?? RISK_COLORS.unknown;
}

// ERCOT zones as simplified SVG paths within a ~400×440 Texas viewBox.
// Each path roughly traces the ERCOT load-zone boundary.
const ZONE_PATHS: Record<string, { path: string; labelX: number; labelY: number; name: string }> = {
  LZ_HOUSTON: {
    path: "M 255 300 L 320 280 L 345 310 L 355 360 L 310 390 L 260 380 L 240 340 Z",
    labelX: 295, labelY: 335, name: "HOUSTON",
  },
  LZ_NORTH: {
    path: "M 170 80 L 280 80 L 295 180 L 260 200 L 200 195 L 155 160 Z",
    labelX: 222, labelY: 140, name: "NORTH",
  },
  LZ_SOUTH: {
    path: "M 155 160 L 200 195 L 260 200 L 255 300 L 240 340 L 200 355 L 140 340 L 110 280 L 120 210 Z",
    labelX: 185, labelY: 255, name: "SOUTH",
  },
  LZ_WEST: {
    path: "M 40 80 L 170 80 L 155 160 L 120 210 L 60 230 L 30 200 L 35 120 Z",
    labelX: 95, labelY: 155, name: "WEST",
  },
};

// City dot positions on the SVG canvas
const CITY_DOTS: Record<string, { x: number; y: number }> = {
  "Houston":        { x: 290, y: 340 },
  "Dallas":         { x: 235, y: 130 },
  "Austin":         { x: 195, y: 270 },
  "San Antonio":    { x: 175, y: 315 },
  "Midland":        { x: 90,  y: 195 },
  "Odessa":         { x: 75,  y: 210 },
  "Corpus Christi": { x: 215, y: 375 },
  "Lubbock":        { x: 95,  y: 110 },
};

// Map city → ERCOT zone
const CITY_ZONE: Record<string, string> = {
  "Houston":        "LZ_HOUSTON",
  "Dallas":         "LZ_NORTH",
  "Austin":         "LZ_SOUTH",
  "San Antonio":    "LZ_SOUTH",
  "Midland":        "LZ_WEST",
  "Odessa":         "LZ_WEST",
  "Corpus Christi": "LZ_SOUTH",
  "Lubbock":        "LZ_WEST",
};

function statewideBadgeClass(status: "low" | "medium" | "high") {
  return status === "high"   ? "bg-red-500/20 border-red-500/40 text-red-300" :
         status === "medium" ? "bg-amber-500/20 border-amber-500/40 text-amber-300" :
                               "bg-green-500/20 border-green-500/40 text-green-300";
}

export default function TexasGridMap({ zones, summary, loading, onRefresh }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  // Build zone-level risk: take worst risk among cities in each zone
  const zoneRisk: Record<string, string> = {};
  for (const zone of zones) {
    const z = CITY_ZONE[zone.location];
    if (!z) continue;
    const current = zoneRisk[z];
    const order   = { high: 3, medium: 2, low: 1, unknown: 0 };
    const inOrder = (r: string) => order[r as keyof typeof order] ?? 0;
    if (!current || inOrder(zone.risk_score) > inOrder(current)) {
      zoneRisk[z] = zone.risk_score;
    }
  }

  const hoveredZone = hovered ? zones.find(z => z.location === hovered) : null;

  return (
    <div className="card-glass border border-white/8 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <MapPin className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-bold text-white">Texas ERCOT Grid Map</span>
          <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold border", statewideBadgeClass(summary.statewide_status))}>
            {summary.statewide_status.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>{summary.reporting_count}/{summary.total_locations} reporting</span>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* SVG Map */}
        <div className="flex-1 p-4 flex items-center justify-center min-h-[280px]">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
              <p className="text-xs text-gray-600">Loading grid data…</p>
            </div>
          ) : (
            <svg
              viewBox="20 60 340 360"
              className="w-full max-w-sm"
              style={{ filter: "drop-shadow(0 4px 24px rgba(0,0,0,0.5))" }}
            >
              {/* Zone fills */}
              {Object.entries(ZONE_PATHS).map(([zoneId, zone]) => {
                const risk  = zoneRisk[zoneId] ?? "unknown";
                const color = riskColor(risk);
                const isHov = hovered ? CITY_ZONE[hovered] === zoneId : false;
                return (
                  <path
                    key={zoneId}
                    d={zone.path}
                    fill={color.fill}
                    stroke={color.stroke}
                    strokeWidth={isHov ? 2.5 : 1.5}
                    style={{ transition: "all 0.2s", opacity: isHov ? 1 : 0.85 }}
                  />
                );
              })}

              {/* Zone labels */}
              {Object.entries(ZONE_PATHS).map(([zoneId, zone]) => {
                const risk = zoneRisk[zoneId] ?? "unknown";
                return (
                  <text
                    key={`lbl-${zoneId}`}
                    x={zone.labelX} y={zone.labelY}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="700"
                    fill={riskColor(risk).label}
                    opacity={0.75}
                    style={{ fontFamily: "system-ui, sans-serif", letterSpacing: "0.08em" }}
                  >
                    {zone.name}
                  </text>
                );
              })}

              {/* City dots */}
              {zones.map(zone => {
                const pos = CITY_DOTS[zone.location];
                if (!pos) return null;
                const color = riskColor(zone.risk_score);
                const isHov = hovered === zone.location;
                return (
                  <g
                    key={zone.location}
                    onMouseEnter={() => setHovered(zone.location)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Pulse ring for high risk */}
                    {zone.risk_score === "high" && (
                      <circle
                        cx={pos.x} cy={pos.y} r={isHov ? 9 : 7}
                        fill="none"
                        stroke={color.stroke}
                        strokeWidth="1"
                        opacity="0.4"
                        style={{ animation: "pulse 2s infinite" }}
                      />
                    )}
                    <circle
                      cx={pos.x} cy={pos.y} r={isHov ? 6 : 4.5}
                      fill={color.fill}
                      stroke={color.stroke}
                      strokeWidth={isHov ? 2 : 1.5}
                      style={{ transition: "all 0.15s" }}
                    />
                    {isHov && (
                      <text
                        x={pos.x} y={pos.y - 9}
                        textAnchor="middle"
                        fontSize="7.5"
                        fontWeight="700"
                        fill="#f3f4f6"
                        style={{ fontFamily: "system-ui, sans-serif" }}
                      >
                        {zone.location}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Side panel */}
        <div className="w-full lg:w-64 border-t lg:border-t-0 lg:border-l border-white/5 p-4 space-y-3">
          {/* Hover tooltip */}
          {hoveredZone ? (
            <div className="rounded-xl border border-white/10 bg-white/3 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white">{hoveredZone.location}</p>
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold border", riskColor(hoveredZone.risk_score).badge)}>
                  {hoveredZone.risk_score.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-gray-500">{hoveredZone.ercot_zone}</p>
              {hoveredZone.ercot_price != null && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span className="text-gray-400">${hoveredZone.ercot_price.toFixed(2)}/MWh</span>
                </div>
              )}
              {hoveredZone.primary_driver && (
                <p className="text-xs text-gray-500 leading-snug">{hoveredZone.primary_driver}</p>
              )}
              <div className="flex items-center gap-1.5">
                {hoveredZone.is_stale
                  ? <WifiOff className="w-3 h-3 text-gray-600" />
                  : <Wifi className="w-3 h-3 text-green-500" />}
                <span className="text-xs text-gray-600">{hoveredZone.is_stale ? "Stale" : "Live"}</span>
                {hoveredZone.confidence != null && (
                  <span className="text-xs text-gray-600 ml-auto">{hoveredZone.confidence}% conf.</span>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/5 bg-white/2 p-3 text-center">
              <p className="text-xs text-gray-600">Hover a city to see details</p>
            </div>
          )}

          {/* City list */}
          <div className="space-y-1">
            {zones.map(zone => {
              const color = riskColor(zone.risk_score);
              return (
                <div
                  key={zone.location}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors",
                    hovered === zone.location ? "bg-white/8" : "hover:bg-white/4",
                  )}
                  onMouseEnter={() => setHovered(zone.location)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color.label, boxShadow: zone.risk_score === "high" ? `0 0 6px ${color.label}` : undefined }}
                    />
                    <span className="text-xs text-gray-300 font-medium">{zone.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {zone.ercot_price != null && (
                      <span className="text-xs text-gray-600">${zone.ercot_price.toFixed(0)}</span>
                    )}
                    <span className="text-xs font-semibold capitalize" style={{ color: color.label }}>
                      {zone.risk_score}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 pt-2 border-t border-white/5">
            {(["low", "medium", "high"] as const).map(r => (
              <div key={r} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: riskColor(r).label }} />
                <span className="text-xs text-gray-600 capitalize">{r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer stats */}
      <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between gap-4 text-xs text-gray-600">
        <span>
          {summary.high_risk_count > 0 && <span className="text-red-400 font-semibold">{summary.high_risk_count} HIGH</span>}
          {summary.high_risk_count > 0 && summary.medium_risk_count > 0 && " · "}
          {summary.medium_risk_count > 0 && <span className="text-amber-400 font-semibold">{summary.medium_risk_count} MEDIUM</span>}
          {summary.high_risk_count === 0 && summary.medium_risk_count === 0 && <span className="text-green-400 font-semibold">All zones LOW</span>}
        </span>
        {summary.worst_location && (
          <span>Highest risk: <span className="text-gray-400">{summary.worst_location}</span></span>
        )}
        <span className="text-gray-700">Updated {new Date(summary.computed_at).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit" })} CDT</span>
      </div>
    </div>
  );
}
