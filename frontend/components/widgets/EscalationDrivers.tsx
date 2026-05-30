"use client";
import { TrendingUp } from "lucide-react";

interface Props {
  riskScore:    string;
  ercotPrice?:  number;
  temperature?: number;
  henryHub?:    number;
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
}

interface Driver {
  rank:        number;
  condition:   string;
  current:     string;
  threshold:   string;
  probImpact:  number;
  proximity:   number; // 0-100
}

export default function EscalationDrivers({
  riskScore, ercotPrice, temperature, henryHub, demandPressure, supplyPressure,
}: Props) {
  const price  = ercotPrice  ?? 0;
  const temp   = temperature ?? 0;
  const hh     = henryHub    ?? 0;

  const drivers: Driver[] = [
    {
      rank:       1,
      condition:  "ERCOT > $35/MWh",
      current:    price > 0 ? `$${price.toFixed(2)}/MWh` : "N/A",
      threshold:  "$35/MWh",
      probImpact: 24,
      proximity:  price > 0 ? Math.min(Math.round((price / 35) * 100), 100) : 0,
    },
    {
      rank:       2,
      condition:  "Temperature > 95°F",
      current:    temp > 0 ? `${temp.toFixed(0)}°F` : "N/A",
      threshold:  "95°F",
      probImpact: 18,
      proximity:  temp > 0 ? Math.min(Math.round((temp / 95) * 100), 100) : 0,
    },
    {
      rank:       3,
      condition:  "Henry Hub > $3.00/MMBtu",
      current:    hh > 0 ? `$${hh.toFixed(2)}/MMBtu` : "N/A",
      threshold:  "$3.00/MMBtu",
      probImpact: 12,
      proximity:  hh > 0 ? Math.min(Math.round((hh / 3.0) * 100), 100) : 0,
    },
    {
      rank:       4,
      condition:  "Multi-signal alignment",
      current:    riskScore === "high" ? "Active" : riskScore === "medium" ? "Partial" : "Not active",
      threshold:  "2+ signals triggered",
      probImpact: 31,
      proximity:  riskScore === "high" ? 90 : riskScore === "medium" ? 50 : 15,
    },
  ].sort((a, b) => b.probImpact - a.probImpact);

  function proximityColor(p: number): string {
    if (p >= 90) return "bg-red-500";
    if (p >= 70) return "bg-amber-500";
    if (p >= 50) return "bg-amber-400";
    return "bg-green-500";
  }

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5 lg:col-span-2">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-4 h-4 text-gray-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Top Escalation Drivers</p>
      </div>
      <p className="text-[10px] text-gray-600 mb-4">Conditions most likely to increase operational significance</p>

      <div className="space-y-4">
        {drivers.map((d, i) => (
          <div key={d.condition}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-gray-600">#{i + 1}</span>
                <span className="text-xs font-semibold text-gray-200">{d.condition}</span>
              </div>
              <span className="text-xs font-bold text-amber-400">+{d.probImpact}% probability impact</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${proximityColor(d.proximity)}`} style={{ width: `${d.proximity}%` }} />
              </div>
              <span className="text-[10px] text-gray-500 flex-shrink-0">
                {d.current} → {d.threshold}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-600 mt-3 border-t border-white/5 pt-2">
        Probability impact shows estimated contribution to escalation risk if threshold is reached.
      </p>
    </div>
  );
}
