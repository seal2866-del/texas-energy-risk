"use client";
import { AlertTriangle, CheckCircle, Zap } from "lucide-react";
import type { Signal } from "@/lib/api";
import { cn, riskBg, riskColor } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";

interface Props { signal: Signal }

export default function VolatilityAlert({ signal }: Props) {
  const { triggered, severity, message, value, title, impact, confidence, type } = signal;

  const isOutsideNormal = !triggered && value !== null && value >= 105; // approaching threshold

  return (
    <div className={cn(
      "card-glass p-5 border transition-all",
      triggered ? riskBg(severity) : "border-white/5"
    )}>
      <div className="flex items-start gap-3">
        {/* Icon */}
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
          {/* Header row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Task 2 — Use dynamic title from signal */}
            <p className="text-sm font-semibold text-white">
              {title || "ERCOT Volatility Monitor"}
            </p>
            <div className="flex items-center gap-1.5">
              {/* Task 7 — ALERT TRIGGERED badge */}
              {triggered && (
                <span className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide",
                  severity === "high"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                )}>
                  <Zap className="w-3 h-3" />
                  Alert Triggered
                </span>
              )}
              <span className={cn(
                "px-2 py-0.5 rounded-full text-xs font-semibold uppercase",
                triggered
                  ? severity === "high" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                  : "bg-white/5 text-gray-500"
              )}>
                {triggered ? severity : "clear"}
              </span>
            </div>
          </div>

          {/* Task 2 — Upgraded message body */}
          <p className="mt-1.5 text-sm text-gray-300 leading-relaxed">{message}</p>

          {/* Task 7 — Outside normal range indicator */}
          {isOutsideNormal && (
            <p className="mt-1.5 text-xs text-amber-400 font-medium">
              ⚠ Outside normal range
            </p>
          )}

          {/* Current price + threshold row */}
          {value !== null && triggered && (
            <div className="mt-2 text-xs text-gray-500">
              Current:{" "}
              <span className={cn("font-semibold", riskColor(severity))}>
                {formatPrice(value)}/MWh
              </span>
              {" · "} Threshold: {formatPrice(150)}/MWh
            </div>
          )}

          {/* Task 4 — Impact statement */}
          {impact && triggered && (
            <div className={cn(
              "mt-2.5 px-2.5 py-1.5 rounded-lg text-xs leading-relaxed border",
              severity === "high"
                ? "bg-red-500/10 border-red-500/20 text-red-300"
                : "bg-amber-500/10 border-amber-500/20 text-amber-300"
            )}>
              {impact}
            </div>
          )}

          {/* Task 5 — Confidence score */}
          {triggered && confidence !== null && confidence !== undefined && (
            <p className="mt-2 text-xs text-gray-600">
              Signal confidence:{" "}
              <span className={cn(
                "font-semibold",
                confidence >= 75 ? "text-green-400" : confidence >= 55 ? "text-amber-400" : "text-gray-500"
              )}>
                {confidence}%
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
