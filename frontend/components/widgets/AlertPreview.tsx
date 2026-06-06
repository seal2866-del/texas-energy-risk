"use client";
import { Bell } from "lucide-react";

interface Props {
  riskScore:    string;
  riskDirection: string;
  ercotPrice?:  number;
  temperature?: number;
  henryHub?:    number;
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
}

interface PotentialAlert {
  condition:   string;
  probability: string;
  window:      string;
  probColor:   string;
  severity:    number;
}

export default function AlertPreview({
  riskScore, riskDirection, ercotPrice, temperature, henryHub,
  demandPressure, supplyPressure,
}: Props) {
  const price  = ercotPrice  ?? 0;
  const temp   = temperature ?? 0;
  const hh     = henryHub    ?? 0;
  const demand = demandPressure?.level || "low";
  const supply = supplyPressure?.level || "low";
  const rising = riskDirection === "increasing";

  const alerts: PotentialAlert[] = [];

  // Temperature alert
  const tempDist = 95 - temp;
  if (temp >= 88) {
    alerts.push({
      condition:   "Temperature > 95°F",
      probability: temp >= 92 ? "High" : "Moderate",
      window:      temp >= 92 ? "2–6 hours" : "6–12 hours",
      probColor:   temp >= 92 ? "text-red-400" : "text-amber-400",
      severity:    temp >= 92 ? 3 : 2,
    });
  }

  // ERCOT price alert
  const priceDist = 75 - price;
  if (price >= 25 || demand === "medium" || demand === "high") {
    alerts.push({
      condition:   "ERCOT LMP > $75/MWh",
      probability: price >= 30 ? "Moderate" : "Low",
      window:      price >= 30 ? "Peak window (14:00–19:00 CDT)" : "If demand spikes",
      probColor:   price >= 30 ? "text-amber-400" : "text-gray-400",
      severity:    price >= 30 ? 2 : 1,
    });
  }

  // Henry Hub alert
  if (hh >= 2.7) {
    alerts.push({
      condition:   "Henry Hub > $3.00/MMBtu",
      probability: hh >= 2.85 ? "Moderate" : "Low",
      window:      "Next EIA report",
      probColor:   hh >= 2.85 ? "text-amber-400" : "text-gray-400",
      severity:    hh >= 2.85 ? 2 : 1,
    });
  }

  // Risk escalation alert
  if (rising || riskScore === "medium") {
    alerts.push({
      condition:   "Risk escalation to Medium/High",
      probability: riskScore === "medium" ? "Moderate" : "Low",
      window:      "Next 6–24 hours",
      probColor:   riskScore === "medium" ? "text-amber-400" : "text-gray-400",
      severity:    riskScore === "medium" ? 2 : 1,
    });
  }

  // Sort by severity
  alerts.sort((a, b) => b.severity - a.severity);

  const top = alerts[0];

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-4 h-4 text-gray-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
          Next Possible Alert
        </p>
      </div>

      {top ? (
        <>
          <div className="bg-white/5 border border-white/8 rounded-xl p-4 mb-3">
            <p className="text-sm font-bold text-gray-200 mb-2">{top.condition}</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wide">Probability</p>
                <p className={`text-xs font-bold ${top.probColor}`}>{top.probability}</p>
              </div>
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wide">Expected Window</p>
                <p className="text-xs font-semibold text-gray-300">{top.window}</p>
              </div>
            </div>
          </div>

          {alerts.length > 1 && (
            <div>
              <p className="text-[9px] text-gray-600 uppercase tracking-wide mb-1">Also watching:</p>
              {alerts.slice(1, 3).map((a, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                  <span className="text-[11px] text-gray-400">{a.condition}</span>
                  <span className={`text-[10px] font-semibold ${a.probColor}`}>{a.probability}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-4 text-center">
          <p className="text-sm font-bold text-green-400 mb-1">No Alerts Anticipated</p>
          <p className="text-xs text-gray-400">All metrics well within normal thresholds. No escalation expected.</p>
        </div>
      )}
    </div>
  );
}
