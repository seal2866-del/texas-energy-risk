"use client";
import { Sparkles, Shield } from "lucide-react";

interface Props {
  riskScore:      string;
  riskDirection:  string;
  primaryDriver?: string;
  confidence?:    number | null;
  ercotPrice?:    number;
  temperature?:   number;
  henryHub?:      number;
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
  marketReaction?: { level: string };
  activeSignals?:  number;
  computedAt?:     string;
}

function confColor(c?: number | null): string {
  if (!c) return "text-amber-400";
  if (c >= 80) return "text-green-400";
  if (c >= 60) return "text-amber-400";
  return "text-red-400";
}

function confLabel(c?: number | null): string {
  if (!c) return "Moderate";
  if (c >= 80) return "High";
  if (c >= 60) return "Moderate";
  return "Low";
}

export default function AIExecutiveSummary({
  riskScore, riskDirection, primaryDriver, confidence,
  ercotPrice, temperature, henryHub, demandPressure, supplyPressure, marketReaction,
  activeSignals = 0, computedAt,
}: Props) {
  const risk   = riskScore || "low";
  const demand = demandPressure?.level  || "low";
  const supply = supplyPressure?.level  || "low";
  const market = marketReaction?.level  || "low";
  const price  = ercotPrice  ?? 0;
  const temp   = temperature ?? 0;
  const hh     = henryHub    ?? 0;
  const rising = riskDirection === "increasing";

  const riskColor = risk === "high" ? "text-red-400" : risk === "medium" ? "text-amber-400" : "text-green-400";
  const riskBg    = risk === "high"
    ? "border-red-500/25 bg-red-500/5"
    : risk === "medium"
    ? "border-amber-500/25 bg-amber-500/5"
    : "border-white/10 bg-white/3";

  // Current conditions — business language
  const currentConditions =
    risk === "high" && activeSignals >= 2
      ? "Multiple risk signals are elevated simultaneously. Texas grid and market conditions warrant immediate operational review."
      : risk === "high"
      ? "Texas energy market conditions are elevated. Grid demand, pricing, or supply signals are outside normal operating parameters."
      : risk === "medium"
      ? `Texas grid conditions show moderate market pressure${demand !== "low" ? " driven by weather-related demand" : ""}. Conditions are within manageable range.`
      : rising
      ? "Texas grid and market conditions are stable but trending upward. Conditions may develop over the next 6–24 hours."
      : "Texas grid and market conditions remain stable. No material risk signals are currently active across monitored indicators.";

  // Primary driver — business language
  const driverMap: Record<string, string> = {
    weather_demand:   `Weather-driven demand pressure${temp > 0 ? ` — temperatures of ${temp.toFixed(0)}°F` : ""} increasing grid load`,
    price_volatility: `ERCOT market pricing sensitivity${price > 0 ? ` — Houston Hub at $${price.toFixed(2)}/MWh` : ""}`,
    gas_supply:       `Natural gas supply conditions${hh > 0 ? ` — Henry Hub at $${hh.toFixed(2)}/MMBtu` : ""} affecting generation costs`,
  };
  const primaryDriverStr = driverMap[primaryDriver || ""]
    || (price > 0 ? `Normal ERCOT market activity — Houston Hub at $${price.toFixed(2)}/MWh within expected range` : "All monitored risk drivers within normal operating parameters");

  // Operational impact — business-focused
  const operationalImpact =
    risk === "high"
      ? "Elevated operational and financial exposure is possible. Energy-intensive operations should review current market positions and contingency protocols."
      : risk === "medium"
      ? `Moderate cost sensitivity is possible during afternoon peak demand (14:00–19:00 CDT)${price >= 30 ? `. Current ERCOT pricing at $${price.toFixed(2)}/MWh is approaching watch thresholds.` : "."}`
      : demand !== "low"
      ? `Weather conditions may increase grid load costs during afternoon peak hours. No material financial exposure is expected at current pricing levels.`
      : "No material operational or financial exposure expected during the next 24 hours. Standard operating conditions apply.";

  // 24-hour outlook
  const outlook =
    risk === "high"
      ? "Elevated market conditions are expected to persist through the next 24 hours. Continued management visibility is warranted."
      : risk === "medium"
      ? `Market risk expected to remain ${rising ? "elevated or increase" : "moderate"} over the next 24 hours based on current signal trajectory.`
      : rising
      ? "Risk outlook is trending upward. Conditions may become elevated within 6–24 hours if current demand and pricing drivers persist."
      : "Low-risk market conditions are expected to continue through the next 24 hours. No significant market disruptions are anticipated.";

  // Recommended action — operational language
  const action =
    risk === "high"
      ? "Initiate internal review of operational exposure. Increase ERCOT monitoring frequency. Confirm contingency protocols are ready for activation."
      : risk === "medium"
      ? "Monitor ERCOT pricing during the afternoon peak demand window (14:00–19:00 CDT). Review operational schedules for energy-intensive activities according to internal procedures."
      : "Continue standard monitoring procedures. Reassess conditions at the next scheduled review window. No operational changes are currently indicated.";

  const conf     = confidence ?? 70;
  const confPct  = `${conf}%`;
  const confText = confLabel(confidence);
  const confClr  = confColor(confidence);

  const timeStr = computedAt
    ? new Date(computedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/Chicago" }) + " CDT"
    : "Just now";

  const rows = [
    { label: "Current Conditions",    value: currentConditions },
    { label: "Primary Driver",         value: primaryDriverStr },
    { label: "Operational Impact",     value: operationalImpact },
    { label: "24-Hour Outlook",        value: outlook },
    { label: "Recommended Action",     value: action },
  ];

  return (
    <div className={`rounded-2xl border p-6 lg:col-span-2 ${riskBg}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">AI Executive Summary</p>
            <p className="text-[10px] text-gray-600">Generated {timeStr} · Informational only</p>
          </div>
        </div>

        {/* Risk + Confidence badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-xl px-3 py-1.5">
            <Shield className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] text-gray-500">Confidence</span>
            <span className={`text-xs font-black ${confClr}`}>{confPct}</span>
            <span className={`text-[9px] font-semibold ${confClr}`}>· {confText}</span>
          </div>
          <div className={`px-3 py-1.5 rounded-xl border text-xs font-black uppercase ${
            risk === "high"   ? "bg-red-500/15 border-red-500/25 text-red-300" :
            risk === "medium" ? "bg-amber-500/15 border-amber-500/25 text-amber-300" :
                                "bg-green-500/10 border-green-500/20 text-green-300"
          }`}>
            {risk.toUpperCase()} RISK
          </div>
        </div>
      </div>

      {/* Content rows */}
      <div className="space-y-4">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex gap-4 pb-4 border-b border-white/5 last:border-0 last:pb-0">
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest w-40 flex-shrink-0 pt-0.5 leading-relaxed">
              {label}
            </span>
            <p className="text-sm text-gray-200 leading-relaxed flex-1">{value}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-700 mt-4 pt-3 border-t border-white/5">
        Operational awareness only. Not financial, trading, investment, or procurement advice. Users are responsible for their own decisions.
      </p>
    </div>
  );
}
