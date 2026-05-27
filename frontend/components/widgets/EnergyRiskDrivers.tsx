"use client";
import { BarChart3, Thermometer, Flame, TrendingUp, Zap, AlertTriangle,
         ArrowUp, ArrowRight, ArrowDown } from "lucide-react";
import type { SignalsResponse, RiskScore, SignalDriver } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  signals: SignalsResponse;
}

function levelCls(level: RiskScore): string {
  return level === "high"
    ? "text-red-400 bg-red-500/10 border-red-500/25"
    : level === "medium"
    ? "text-amber-400 bg-amber-500/10 border-amber-500/25"
    : "text-green-400 bg-green-500/10 border-green-500/25";
}

function TrendIcon({ trend }: { trend?: "rising" | "stable" | "falling" }) {
  if (trend === "rising")
    return <ArrowUp className="w-3 h-3 text-red-400 flex-shrink-0" />;
  if (trend === "falling")
    return <ArrowDown className="w-3 h-3 text-green-400 flex-shrink-0" />;
  return <ArrowRight className="w-3 h-3 text-gray-500 flex-shrink-0" />;
}

function DriverRow({
  label,
  icon: Icon,
  iconColor,
  level,
  explanation,
  trend,
}: {
  label:        string;
  icon:         React.ElementType;
  iconColor:    string;
  level:        RiskScore;
  explanation:  string;
  trend?:       "rising" | "stable" | "falling";
}) {
  return (
    <div className="pb-4 border-b border-white/5 last:border-0 last:pb-0">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4 flex-shrink-0", iconColor)} />
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendIcon trend={trend} />
          <span
            className={cn(
              "px-2.5 py-0.5 rounded-full text-xs font-black border uppercase tracking-wide",
              levelCls(level),
            )}
          >
            {level}
          </span>
        </div>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed pl-6">{explanation}</p>
    </div>
  );
}

export default function EnergyRiskDrivers({ signals }: Props) {
  const {
    demand_pressure,
    supply_pressure,
    market_reaction,
    gas_to_power_impact,
    events,
    signal_drivers,
  } = signals;

  if (!demand_pressure && !supply_pressure && !market_reaction) return null;

  // Build a quick lookup: driver type → trend
  const trendByType: Record<string, "rising" | "stable" | "falling"> = {};
  (signal_drivers ?? []).forEach((sd: SignalDriver) => {
    if (sd.trend) trendByType[sd.type] = sd.trend;
  });

  // Filter events - exclude data_source_degraded (DataSources widget covers it)
  const visibleEvents = (events ?? []).filter(
    (e) => e.type !== "data_source_degraded",
  );

  return (
    <div className="card-glass border border-white/5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Energy Risk Drivers</p>
            <p className="text-xs text-gray-600">What is driving risk right now</p>
          </div>
        </div>
      </div>

      {/* Three drivers */}
      <div className="space-y-4">
        {demand_pressure && (
          <DriverRow
            label="Demand Pressure"
            icon={Thermometer}
            iconColor="text-amber-400"
            level={demand_pressure.level}
            explanation={demand_pressure.explanation}
            trend={trendByType["weather_demand"]}
          />
        )}
        {supply_pressure && (
          <DriverRow
            label="Supply Pressure"
            icon={Flame}
            iconColor="text-orange-400"
            level={supply_pressure.level}
            explanation={supply_pressure.explanation}
            trend={trendByType["gas_supply"]}
          />
        )}
        {market_reaction && (
          <DriverRow
            label="Market Reaction"
            icon={TrendingUp}
            iconColor="text-blue-400"
            level={market_reaction.level}
            explanation={market_reaction.explanation}
            trend={trendByType["price_volatility"]}
          />
        )}
      </div>

      {/* Gas-to-Power Impact */}
      {gas_to_power_impact && (
        <div className="mt-5 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">
                Gas-to-Power Impact
              </span>
            </div>
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-black border uppercase tracking-wide",
                levelCls(gas_to_power_impact.level),
              )}
            >
              {gas_to_power_impact.level}
            </span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed pl-6">
            {gas_to_power_impact.explanation}
          </p>
        </div>
      )}

      {/* Active Events */}
      {visibleEvents.length > 0 && (
        <div className="mt-5 pt-4 border-t border-white/5">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              Active Events
            </p>
          </div>
          <div className="space-y-2">
            {visibleEvents.map((evt, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-2 px-3 py-2 rounded-lg text-xs border leading-relaxed",
                  evt.severity === "high"
                    ? "bg-red-500/10 border-red-500/20 text-red-300"
                    : evt.severity === "medium"
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
                    : "bg-white/5 border-white/8 text-gray-400",
                )}
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0",
                    evt.severity === "high"
                      ? "bg-red-400"
                      : evt.severity === "medium"
                      ? "bg-amber-400"
                      : "bg-gray-500",
                  )}
                />
                {evt.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Informational footer */}
      <p className="mt-4 text-xs text-gray-700 leading-relaxed">
        Each driver contributes independently to the unified Energy Risk Score.
        Risk may be rising &mdash; monitoring is recommended when any driver is elevated.
      </p>
    </div>
  );
}
