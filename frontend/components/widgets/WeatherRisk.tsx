"use client";
import { Thermometer, Sun, Cloud, CloudRain } from "lucide-react";
import type { WeatherForecast, Signal } from "@/lib/api";
import { cn, riskBg, riskColor, riskBadge } from "@/lib/utils";

interface Props {
  forecasts: WeatherForecast[];
  signal:    Signal;
  panelGlow?: string;
}

const CONDITION_ICON: Record<string, React.ReactNode> = {
  sunny:         <Sun       className="w-4 h-4 text-yellow-400" />,
  partly_cloudy: <Cloud     className="w-4 h-4 text-gray-400" />,
  cloudy:        <Cloud     className="w-4 h-4 text-gray-400" />,
  thunderstorm:  <CloudRain className="w-4 h-4 text-blue-400" />,
  rain:          <CloudRain className="w-4 h-4 text-blue-400" />,
};

export default function WeatherRisk({ forecasts, signal, panelGlow }: Props) {
  const tomorrow  = forecasts[0];
  const triggered = signal.triggered;
  const severity  = signal.severity;

  return (
    <div className={cn("card-glass p-6 border", triggered ? riskBg(severity) : "border-white/5", panelGlow ?? "")}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Texas Weather Demand Risk</p>
          {tomorrow && <p className="text-xs text-gray-600 mt-0.5">{tomorrow.location_name}</p>}
        </div>
        <Thermometer className={cn("w-5 h-5", triggered ? riskColor(severity) : "text-gray-600")} />
      </div>

      {tomorrow && (
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-white">{tomorrow.temp_high_f.toFixed(0)}F</span>
              <span className="text-lg text-gray-500 mb-0.5">/ {tomorrow.temp_low_f.toFixed(0)}F</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {CONDITION_ICON[tomorrow.condition] ?? <Sun className="w-4 h-4 text-gray-400" />}
              <span className="text-xs text-gray-400 capitalize">{tomorrow.condition?.replace("_", " ")}</span>
              <span className={cn("ml-auto px-2 py-0.5 rounded-full text-xs font-semibold", riskBadge(tomorrow.demand_risk))}>
                {tomorrow.demand_risk === "high" ? "Elevated Demand Conditions"
                 : tomorrow.demand_risk === "medium" ? "Moderate Demand"
                 : "Normal Demand"}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-5 gap-1">
        {forecasts.slice(0, 5).map((f, i) => {
          const date = new Date(f.forecast_time);
          return (
            <div key={i} className="text-center py-2 rounded-lg bg-white/3">
              <p className="text-xs text-gray-500">{date.toLocaleDateString("en-US", { weekday: "short" })}</p>
              <div className="my-1 flex justify-center">
                {CONDITION_ICON[f.condition] ?? <Sun className="w-3 h-3 text-gray-400" />}
              </div>
              <p className={cn("text-xs font-semibold", riskColor(f.demand_risk))}>{f.temp_high_f.toFixed(0)}</p>
            </div>
          );
        })}
      </div>

      {triggered && (
        <div className={cn("mt-4 p-3 rounded-lg border text-xs text-gray-300 leading-relaxed", riskBg(severity))}>
          {signal.message}
        </div>
      )}

      {signal.time_horizon && (
        <p className="mt-3 text-xs text-gray-600 font-mono">{signal.time_horizon}</p>
      )}
    </div>
  );
}
