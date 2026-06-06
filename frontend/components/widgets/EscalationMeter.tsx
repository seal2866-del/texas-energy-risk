"use client";

interface Props {
  riskScore:            string;
  riskDirection:        string;
  escalationProbability?: number;
  activeSignals?:       number;
  ercotPrice?:          number;
  temperature?:         number;
}

function computePosition(
  risk: string,
  direction: string,
  escalation: number,
  activeSignals: number,
  price: number,
  temp: number,
): number {
  // Base from risk score
  let base = risk === "high" ? 65 : risk === "medium" ? 35 : 10;

  // Adjust for escalation probability
  if (escalation > 0) base = Math.max(base, escalation);

  // Adjust for direction
  if (direction === "increasing") base = Math.min(base + 10, 95);
  if (direction === "decreasing") base = Math.max(base - 5, 2);

  // Adjust for proximity to thresholds
  if (price >= 75) base = Math.min(base + 15, 95);
  if (temp >= 100) base = Math.min(base + 10, 95);

  return Math.min(Math.max(Math.round(base), 2), 98);
}

function getZone(pct: number): { label: string; color: string; bg: string } {
  if (pct >= 75) return { label: "CRITICAL",  color: "text-red-400",   bg: "bg-red-500" };
  if (pct >= 50) return { label: "ELEVATED",  color: "text-orange-400", bg: "bg-orange-500" };
  if (pct >= 25) return { label: "WATCH",     color: "text-amber-400", bg: "bg-amber-500" };
  return              { label: "NORMAL",    color: "text-green-400", bg: "bg-green-500" };
}

const ZONES = [
  { label: "NORMAL",   from: 0,   to: 25,  color: "bg-green-500/40" },
  { label: "WATCH",    from: 25,  to: 50,  color: "bg-amber-500/40" },
  { label: "ELEVATED", from: 50,  to: 75,  color: "bg-orange-500/40" },
  { label: "CRITICAL", from: 75,  to: 100, color: "bg-red-500/40" },
];

export default function EscalationMeter({
  riskScore, riskDirection, escalationProbability = 0,
  activeSignals = 0, ercotPrice, temperature,
}: Props) {
  const price = ercotPrice  ?? 0;
  const temp  = temperature ?? 0;
  const pct   = computePosition(riskScore, riskDirection, escalationProbability, activeSignals, price, temp);
  const zone  = getZone(pct);

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
        Risk Escalation Probability
      </p>
      <p className="text-xs text-gray-500 mb-4">
        How close current conditions are to elevated operational significance
      </p>

      {/* Main meter */}
      <div className="mb-3">
        {/* Zone labels */}
        <div className="grid grid-cols-4 mb-1">
          {ZONES.map((z) => (
            <p key={z.label} className="text-[9px] text-gray-600 uppercase text-center">{z.label}</p>
          ))}
        </div>

        {/* Bar */}
        <div className="relative h-4 rounded-full overflow-hidden flex">
          {ZONES.map((z) => (
            <div key={z.label} className={`${z.color}`} style={{ width: "25%" }} />
          ))}

          {/* Indicator */}
          <div
            className="absolute top-0 bottom-0 w-1 rounded-full bg-white shadow-lg shadow-white/30 transition-all duration-500"
            style={{ left: `calc(${pct}% - 2px)` }}
          />
        </div>

        {/* Percentage label */}
        <div className="relative mt-1" style={{ paddingLeft: `${pct}%` }}>
          <div className="absolute" style={{ transform: "translateX(-50%)" }}>
            <p className={`text-[10px] font-black ${zone.color}`}>{pct}%</p>
          </div>
        </div>
      </div>

      {/* Current zone */}
      <div className="mt-5 flex items-center justify-between">
        <div>
          <p className="text-[9px] text-gray-500 uppercase tracking-wide">Current Position</p>
          <p className={`text-sm font-black ${zone.color}`}>{zone.label}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-gray-500 uppercase tracking-wide">Escalation Risk</p>
          <p className={`text-sm font-black ${zone.color}`}>{pct}%</p>
        </div>
      </div>

      <p className="text-[10px] text-gray-600 mt-3 border-t border-white/5 pt-2">
        Probabilistic indicator only. Not a forecast or guarantee of future conditions.
      </p>
    </div>
  );
}
