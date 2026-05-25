"use client";
import { useEffect, useState } from "react";
import { Bell, Check, AlertCircle, Loader2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { AlertLog } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function RecentAlerts() {
  const [logs,    setLogs]    = useState<AlertLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!token) { setLoading(false); return; }
      try {
        const r = await fetch(`${BASE}/api/alerts/logs/recent?limit=3`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const d = await r.json();
          setLogs(d.logs ?? []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    });
  }, []);

  return (
    <div className="card-glass border border-white/5 p-6 lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-500" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Recent Alerts</p>
        </div>
        <Link
          href="/alerts"
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          View all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-20">
          <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8">
          <Bell className="w-6 h-6 text-gray-700 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Alerts will appear here when risk conditions change.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const level = (log.risk_level || log.severity || "low") as string;
            const dotCls =
              level === "high"   ? "bg-red-500" :
              level === "medium" ? "bg-amber-500" : "bg-green-500";
            const textCls =
              level === "high"   ? "text-red-400" :
              level === "medium" ? "text-amber-400" : "text-green-400";
            const timeStr = new Date(log.sent_at || log.created_at || "").toLocaleString("en-US", {
              timeZone: "America/Chicago",
              month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit",
            });
            return (
              <div key={log.id} className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn("w-2 h-2 rounded-full flex-shrink-0", dotCls)} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-xs font-bold uppercase", textCls)}>{level}</span>
                      {log.primary_driver && (
                        <span className="text-xs text-gray-500 truncate">{log.primary_driver}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 font-mono mt-0.5">{timeStr} CDT</p>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {log.delivered_email ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-green-500/10 text-green-400 border border-green-500/20">
                      <Check className="w-2.5 h-2.5" />Email
                    </span>
                  ) : (
                    <span className="text-xs text-gray-700 px-1.5">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
