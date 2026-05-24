import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RiskScore } from "./api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function riskColor(score: RiskScore) {
  return {
    low:    "text-green-500",
    medium: "text-amber-500",
    high:   "text-red-500",
  }[score] ?? "text-gray-400";
}

export function riskBg(score: RiskScore) {
  return {
    low:    "bg-green-500/10 border-green-500/30",
    medium: "bg-amber-500/10 border-amber-500/30",
    high:   "bg-red-500/10 border-red-500/30",
  }[score] ?? "bg-gray-500/10 border-gray-500/30";
}

export function riskBadge(score: RiskScore) {
  return {
    low:    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    high:   "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  }[score] ?? "";
}

export function formatPrice(price: number) {
  return new Intl.NumberFormat("en-US", {
    style:    "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(price);
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone:     "America/Chicago",
    month:        "short",
    day:          "numeric",
    hour:         "numeric",
    minute:       "2-digit",
    timeZoneName: "short",
  });
}
