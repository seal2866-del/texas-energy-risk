"use client";
import { AlertTriangle, CheckCircle } from "lucide-react";
import type { Signal } from "@/lib/api";
import { cn, riskBg, riskColor } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";

interface Props { signal: Signal }

export default function VolatilityAlert({ signal }: Props) {
  const { triggered, severity, message, value } = signal;

  return (
    <div className={cn(
      "card-glass p-5 border transition-all",
      triggered ? riskBg(severity) : "border-white/5"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "mt-0.5 flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
          triggered
            ? severity === "high" ? "bg-red-500/20" : "bg-amber-500/20"
            : "bg-white/5"
        )}>
          {triggered
            ? <AlertTriangle className={cn("w-5 h-5", riskColor(severity))} />
            : <CheckCircle className="w-5 h-5 text-gray-500" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">ERCOT Volatility Alert</p>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-xs font-semibold uppercase",
              triggered
                ? severity === "high" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                : "bg-white/5 text-gray-500"
            )}>
              {triggered ? severity : "clear"}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-gray-300 leading-relaxed">{message}</p>
          {value !== null && triggered && (
            <div className="mt-2 text-xs text-gray-500">
              Current: <span className={cn("font-semibold", riskColor(severity))}>
                {formatPrice(value)}/MWh
              </span>
              {" · "} Threshold: {formatPrice(150)}/MWh
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
