"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Settings2, AlertTriangle, Info, Loader2, ChevronRight } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { supabase } from "@/lib/supabase";
import { getAlertLogs, updateAlertPrefs, type AlertLog } from "@/lib/api";
import { cn, riskBadge, riskColor, formatDateTime } from "@/lib/utils";

const DEFAULT_PREFS = {
  email_alerts:              true,
  price_volatility_alert:    true,
  weather_demand_alert:      true,
  gas_supply_alert:          true,
  high_risk_score_alert:     true,
  price_threshold_mwh:       150,
  temp_high_threshold_f:     105,
  temp_low_threshold_f:      25,
  gas_storage_pct_threshold: -10,
};

export default function AlertsPage() {
  const router = useRouter();
  const [user,   setUser]   = useState<any>(null);
  const [isPro,  setIsPro]  = useState(false);
  const [logs,   setLogs]   = useState<AlertLog[]>([]);
  const [prefs,  setPrefs]  = useState(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab,    setTab]    = useState<"logs" | "settings">("logs");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace("/login"); return; }
      setUser(data.user);

      // Check pro status
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", data.user.id)
        .single();
      setIsPro(sub?.plan === "pro" && sub?.status === "active");

      // Load alert logs
      const session = await supabase.auth.getSession();
      const token   = session.data.session?.access_token;
      if (token) {
        try {
          const logsData = await getAlertLogs(token);
          setLogs(logsData.logs);
        } catch {}
      }
      setLoading(false);
    });
  }, [router]);

  const handleSavePrefs = async () => {
    setSaving(true);
    try {
      const session = await supabase.auth.getSession();
      const token   = session.data.session?.access_token;
      if (token) await updateAlertPrefs(prefs, token);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const MOCK_LOGS: AlertLog[] = [
    { id: "1", channel: "price_volatility", severity: "high",   message: "ERCOT real-time price spiked to $245/MWh — volatility may be elevated.", sent_at: new Date(Date.now() - 1800000).toISOString(), acknowledged: false },
    { id: "2", channel: "weather_demand",   severity: "high",   message: "Forecast high of 105°F in Houston — elevated cooling demand risk.", sent_at: new Date(Date.now() - 3600000).toISOString(), acknowledged: true  },
    { id: "3", channel: "gas_supply",       severity: "medium", message: "Natural gas storage tracking 8.3% below 5-year average.", sent_at: new Date(Date.now() - 86400000).toISOString(), acknowledged: true  },
  ];

  const displayLogs = logs.length > 0 ? logs : MOCK_LOGS;

  if (!user) return null;

  return (
    <>
      <Navbar />
      <main className="pt-20 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-black text-white">Alert Center</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Risk signal notifications and preferences
              </p>
            </div>
            {!isPro && (
              <a
                href="/pricing"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 text-sm font-semibold hover:bg-orange-500/20 transition-all"
              >
                Upgrade for email alerts
                <ChevronRight className="w-4 h-4" />
              </a>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-6 w-fit">
            {(["logs", "settings"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all",
                  tab === t ? "bg-white/10 text-white" : "text-gray-500 hover:text-white"
                )}
              >
                {t === "logs" ? "Alert Log" : "Preferences"}
              </button>
            ))}
          </div>

          {/* Alert Log */}
          {tab === "logs" && (
            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="card-glass border border-white/5 p-5 h-20 animate-pulse" />
                ))
              ) : displayLogs.length === 0 ? (
                <div className="card-glass border border-white/5 p-12 text-center">
                  <Bell className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No alerts yet</p>
                  <p className="text-sm text-gray-600 mt-1">Alerts will appear here when risk signals trigger.</p>
                </div>
              ) : (
                displayLogs.map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      "card-glass border p-5 transition-all",
                      log.acknowledged ? "border-white/5 opacity-70" : "border-white/10"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        log.severity === "high" ? "bg-red-500/20" : log.severity === "medium" ? "bg-amber-500/20" : "bg-blue-500/20"
                      )}>
                        {log.severity === "high"
                          ? <AlertTriangle className="w-4 h-4 text-red-400" />
                          : <Info className="w-4 h-4 text-amber-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold capitalize", riskBadge(log.severity))}>
                              {log.severity}
                            </span>
                            <span className="text-xs text-gray-500 capitalize">
                              {log.channel?.replace("_", " ")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {log.acknowledged && <Check className="w-3.5 h-3.5 text-green-500" />}
                            <span className="text-xs text-gray-600">{formatDateTime(log.sent_at)}</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-300">{log.message}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Preferences */}
          {tab === "settings" && (
            <div className="card-glass border border-white/8 p-6">
              <h2 className="text-base font-bold text-white mb-5">Alert Preferences</h2>

              {/* Toggle prefs */}
              <div className="space-y-4 mb-8">
                {[
                  { key: "email_alerts",           label: "Email alerts",                 proOnly: true  },
                  { key: "price_volatility_alert",  label: "ERCOT price volatility alerts", proOnly: false },
                  { key: "weather_demand_alert",    label: "Weather demand risk alerts",    proOnly: false },
                  { key: "gas_supply_alert",        label: "Gas supply pressure alerts",    proOnly: false },
                  { key: "high_risk_score_alert",   label: "High risk score alerts",        proOnly: false },
                ].map(({ key, label, proOnly }) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-200">{label}</span>
                      {proOnly && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-orange-500/20 text-orange-400 font-semibold">Pro</span>
                      )}
                    </div>
                    <button
                      onClick={() => setPrefs(p => ({ ...p, [key]: !(p as any)[key] }))}
                      disabled={proOnly && !isPro}
                      className={cn(
                        "w-11 h-6 rounded-full transition-all relative",
                        (prefs as any)[key] && (!proOnly || isPro)
                          ? "bg-orange-500"
                          : "bg-white/10"
                      )}
                    >
                      <span className={cn(
                        "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
                        (prefs as any)[key] && (!proOnly || isPro) ? "left-5" : "left-0.5"
                      )} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Threshold inputs */}
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Thresholds</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {[
                  { key: "price_threshold_mwh",       label: "Price alert above ($/MWh)", step: 10 },
                  { key: "temp_high_threshold_f",      label: "High temp alert (°F)",      step: 1  },
                  { key: "temp_low_threshold_f",       label: "Low temp alert (°F)",        step: 1  },
                  { key: "gas_storage_pct_threshold",  label: "Gas storage below 5yr avg (%)", step: 1 },
                ].map(({ key, label, step }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
                    <input
                      type="number"
                      step={step}
                      value={(prefs as any)[key]}
                      onChange={(e) => setPrefs(p => ({ ...p, [key]: parseFloat(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500/50 transition-all"
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={handleSavePrefs}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm transition-all"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saved ? "✓ Saved!" : "Save Preferences"}
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
