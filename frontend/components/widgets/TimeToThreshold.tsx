"use client";
import { Timer } from "lucide-react";

interface Props {
  ercotPrice?:  number;
  temperature?: number;
  henryHub?:    number;
}

interface Metric {
  label:       string;
  current:     number;
  watch:       number;
  critical:    number;
  unit:        string;
  format:      (v: number) => string;
  timeEstimate: string;
}

function distancePct(current: number, watch: number): number {
  if (current <= 0 || watch <= 0) return 0;
  return Math.round((current / watch) * 100);
}

function distanceAbs(current: number, watch: number, format: (v: number) => string): string {
  const diff = watch - current;
  if (diff <= 0) return "EXCEEDED";
  return `${format(diff)} away`;
}

function getTimeEstimate(current: number, watch: number, label: string): string {
  const pct = (current / watch) * 100;
  if (pct >= 100)  return "Exceeded now";
  if (pct >= 95)   return "< 1 hour";
  if (pct >= 90)   return "1–3 hours";
  if (pct >= 80)   {
    if (label === "Temperature") return "6–12 hours";
    return "2–6 hours";
  }
  if (pct >= 70)   return "Not expected today";
  return "Not expected";
}

function barColor(pct: number): string {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 85)  return "bg-amber-500";
  if (pct >= 70)  return "bg-amber-400";
  return "bg-green-500";
}

export default function TimeToThreshold({ ercotPrice, temperature, henryHub }: Props) {
  const metrics: Metric[] = [
    {
      label:        "ERCOT LMP",
      current:      ercotPrice  ?? 0,
      watch:        35,
      critical:     50,
      unit:         "$/MWh",
      format:       (v) => `$${v.toFixed(2)}`,
      timeEstimate: getTimeEstimate(ercotPrice ?? 0, 35, "ERCOT"),
    },
    {
      label:        "Temperature",
      current:      temperature ?? 0,
      watch:        95,
      critical:     100,
      unit:         "°F",
      format:       (v) => `${v.toFixed(0)}°F`,
      timeEstimate: getTimeEstimate(temperature ?? 0, 95, "Temperature"),
    },
    {
      label:        "Henry Hub",
      current:      henryHub   ?? 0,
      watch:        3.0,
      critical:     4.0,
      unit:         "$/MMBtu",
      format:       (v) => `$${v.toFixed(2)}`,
      timeEstimate: getTimeEstimate(henryHub ?? 0, 3.0, "Henry Hub"),
    },
  ];

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Timer className="w-4 h-4 text-gray-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
          Time to Threshold
        </p>
      </div>

      <div className="space-y-4">
        {metrics.map((m) => {
          const pct      = distancePct(m.current, m.watch);
          const distance = distanceAbs(m.current, m.watch, m.format);
          const bar      = barColor(pct);
          const exceeded = m.current >= m.watch;

          return (
            <div key={m.label}>
              {/* Header row */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-gray-300">{m.label}</span>
                <span className={`text-[10px] font-bold uppercase ${exceeded ? "text-red-400" : pct >= 85 ? "text-amber-400" : "text-gray-500"}`}>
                  {exceeded ? "EXCEEDED" : `${pct}% to watch`}
                </span>
              </div>

              {/* Bar */}
              <div className="h-1.5 bg-white/8 rounded-full overflow-hidden mb-2">
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>

              {/* Values grid */}
              <div className="grid grid-cols-3 gap-1 text-center">
                <div>
                  <p className="text-[9px] text-gray-600 uppercase">Current</p>
                  <p className="text-xs font-bold text-white">{m.format(m.current)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-amber-500/70 uppercase">Watch</p>
                  <p className="text-xs font-semibold text-amber-400">{m.format(m.watch)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-600 uppercase">Est. Time</p>
                  <p className="text-[10px] font-semibold text-gray-300">{m.timeEstimate}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
