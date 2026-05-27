"use client";
import { ArrowUp, ArrowDown, Minus, GitCompare } from "lucide-react";
import type { WhatChangedItem } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  items: WhatChangedItem[];
}

const DIR_CFG = {
  rising:    { icon: ArrowUp,   cls: "text-red-400",   bg: "bg-red-500/8    border-red-500/15" },
  escalated: { icon: ArrowUp,   cls: "text-red-400",   bg: "bg-red-500/8    border-red-500/15" },
  easing:    { icon: ArrowDown, cls: "text-green-400", bg: "bg-green-500/8  border-green-500/15" },
  improved:  { icon: ArrowDown, cls: "text-green-400", bg: "bg-green-500/8  border-green-500/15" },
  stable:    { icon: Minus,     cls: "text-gray-500",  bg: "bg-white/4      border-white/8" },
} as const;

export default function WhatChanged({ items }: Props) {
  if (!items || items.length === 0) return null;

  // If only one "no changes" item, show compact stable banner
  const onlyStable = items.length === 1 && items[0].direction === "stable";

  return (
    <div className="lg:col-span-2 card-glass border border-white/5 p-5">
      <div className="flex items-center gap-2 mb-3">
        <GitCompare className="w-3.5 h-3.5 text-gray-600" />
        <p className="text-xs font-black text-gray-500 uppercase tracking-widest">What Changed</p>
        <span className="ml-auto text-xs text-gray-700">vs previous interval</span>
      </div>

      {onlyStable ? (
        <div className="flex items-center gap-2 text-xs text-gray-600 py-1">
          <Minus className="w-3 h-3 text-gray-700 flex-shrink-0" />
          <span>{items[0].change}</span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item, i) => {
            const cfg = DIR_CFG[item.direction] ?? DIR_CFG.stable;
            const Icon = cfg.icon;
            return (
              <div
                key={i}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs",
                  cfg.bg,
                )}
              >
                <Icon className={cn("w-3 h-3 flex-shrink-0", cfg.cls)} />
                <span className="font-semibold text-gray-300">{item.driver}:</span>
                <span className="text-gray-400">{item.change}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
