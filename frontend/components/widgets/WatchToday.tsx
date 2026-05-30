"use client";

interface Props {
  ercotPrice?: number;
  temperature?: number;
  henryHub?: number;
}

interface Metric {
  label: string;
  unit: string;
  current: number;
  watch: number;
  critical: number;
  format: (v: number) => string;
}

function pct(current: number, watch: number, critical: number): number {
  if (current >= critical) return 100;
  if (current <= 0) return 0;
  return Math.min(Math.round((current / critical) * 100), 100);
}

function statusColor(current: number, watch: number, critical: number): string {
  if (current >= critical) return "bg-red-500";
  if (current >= watch)    return "bg-amber-500";
  return "bg-green-500";
}

function statusLabel(current: number, watch: number, critical: number): { text: string; color: string } {
  if (current >= critical) return { text: "CRITICAL", color: "text-red-400" };
  if (current >= watch)    return { text: "WATCHING", color: "text-amber-400" };
  return { text: "NORMAL", color: "text-green-400" };
}

export default function WatchToday({ ercotPrice, temperature, henryHub }: Props) {
  const metrics: Metric[] = [
    {
      label:    "ERCOT LMP",
      unit:     "$/MWh",
      current:  ercotPrice  ?? 0,
      watch:    35,
      critical: 50,
      format:   (v) => `$${v.toFixed(2)}`,
    },
    {
      label:    "Temperature",
      unit:     "°F",
      current:  temperature ?? 0,
      watch:    95,
      critical: 100,
      format:   (v) => `${v.toFixed(0)}°F`,
    },
    {
      label:    "Henry Hub",
      unit:     "$/MMBtu",
      current:  henryHub   ?? 0,
      watch:    3.0,
      critical: 4.0,
      format:   (v) => `$${v.toFixed(2)}`,
    },
  ];

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">
        Watch Today
      </p>

      <div className="space-y-5">
        {metrics.map((m) => {
          const barPct   = pct(m.current, m.watch, m.critical);
          const barColor = statusColor(m.current, m.watch, m.critical);
          const status   = statusLabel(m.current, m.watch, m.critical);
          const watchPct = Math.round((m.watch / m.critical) * 100);

          return (
            <div key={m.label}>
              {/* Label + status */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-gray-300">{m.label}</span>
                <span className={`text-[10px] font-bold uppercase ${status.color}`}>{status.text}</span>
              </div>

              {/* Progress bar */}
              <div className="relative h-2 bg-white/8 rounded-full overflow-hidden mb-2">
                {/* Watch threshold marker */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-amber-400/60 z-10"
                  style={{ left: `${watchPct}%` }}
                />
                {/* Fill */}
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${barPct}%` }}
                />
              </div>

              {/* Current / Watch / Critical values */}
              <div className="grid grid-cols-3 gap-1 text-center">
                <div>
                  <p className="text-[9px] text-gray-600 uppercase tracking-wide">Current</p>
                  <p className="text-xs font-bold text-white">{m.format(m.current)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-amber-500/70 uppercase tracking-wide">Watch</p>
                  <p className="text-xs font-semibold text-amber-400">{m.format(m.watch)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-red-500/70 uppercase tracking-wide">Critical</p>
                  <p className="text-xs font-semibold text-red-400">{m.format(m.critical)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
