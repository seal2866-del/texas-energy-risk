"use client";
import { Radio } from "lucide-react";

interface Props {
  riskScore:    string;
  ercotPrice?:  number;
  temperature?: number;
  henryHub?:    number;
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
  dataSources?:    { ercot?: { status: string }; noaa?: { status: string }; eia?: { status: string } };
}

type Status = "Normal" | "Watching" | "Elevated";

interface Priority {
  rank:        number;
  label:       string;
  description: string;
  status:      Status;
}

function statusStyle(s: Status) {
  if (s === "Elevated") return "text-red-400 bg-red-500/10 border-red-500/20";
  if (s === "Watching") return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  return "text-green-400 bg-green-500/10 border-green-500/20";
}

export default function MonitoringPriorities({
  riskScore, ercotPrice, temperature, henryHub,
  demandPressure, supplyPressure, dataSources,
}: Props) {
  const risk   = riskScore || "low";
  const price  = ercotPrice  ?? 0;
  const temp   = temperature ?? 0;
  const hh     = henryHub    ?? 0;
  const demand = demandPressure?.level || "low";
  const supply = supplyPressure?.level || "low";

  const priorities: Priority[] = [
    {
      rank:        1,
      label:       "ERCOT Pricing — 14:00–19:00 CDT",
      description: `Current: $${price > 0 ? price.toFixed(2) : "N/A"}/MWh · Watch threshold: $75/MWh`,
      status:      price >= 75 ? "Elevated" : price >= 60 ? "Watching" : "Normal",
    },
    {
      rank:        2,
      label:       "Temperature Forecast",
      description: `Current: ${temp > 0 ? temp.toFixed(0) + "°F" : "N/A"} · Watch threshold: 100°F`,
      status:      temp >= 100 ? "Elevated" : temp >= 92 ? "Watching" : "Normal",
    },
    {
      rank:        3,
      label:       "Natural Gas Supply Conditions",
      description: `Henry Hub: ${hh > 0 ? "$" + hh.toFixed(2) + "/MMBtu" : "N/A"} · Watch threshold: $4.00/MMBtu`,
      status:      hh >= 3.0 ? "Elevated" : hh >= 2.7 ? "Watching" : "Normal",
    },
    {
      rank:        4,
      label:       "NOAA Forecast Update",
      description: "Monitor for any afternoon forecast revision above watch thresholds",
      status:      demand === "high" ? "Elevated" : demand === "medium" ? "Watching" : "Normal",
    },
    {
      rank:        5,
      label:       "Generation Availability",
      description: "Monitor for ERCOT notices or unplanned outage announcements",
      status:      risk === "high" ? "Watching" : "Normal",
    },
    {
      rank:        6,
      label:       "EIA Gas Storage Report",
      description: "Weekly EIA storage data — operating on standard reporting cadence",
      status:      supply === "high" ? "Elevated" : supply === "medium" ? "Watching" : "Normal",
    },
  ];

  // Sort by status severity
  const order: Record<Status, number> = { Elevated: 0, Watching: 1, Normal: 2 };
  const sorted = [...priorities].sort((a, b) => order[a.status] - order[b.status]);

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">
      <div className="flex items-center gap-2 mb-4">
        <Radio className="w-4 h-4 text-blue-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
          Monitoring Priorities
        </p>
        <span className="ml-auto text-[10px] text-gray-600 uppercase tracking-wide">
          Situational awareness only
        </span>
      </div>

      <div className="space-y-2">
        {sorted.map((p, i) => (
          <div key={p.label} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
            <div className="w-5 h-5 rounded-md bg-white/5 border border-white/8 flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-black text-gray-500">{i + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-200">{p.label}</p>
              <p className="text-[11px] text-gray-500">{p.description}</p>
            </div>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border flex-shrink-0 ${statusStyle(p.status)}`}>
              {p.status}
            </span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-600 mt-3">
        Monitoring priorities reflect current signal conditions. Not operational directives.
      </p>
    </div>
  );
}
