"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Settings2, AlertTriangle, Info, Loader2, ChevronRight, Mail, MessageSquare, Clock, MapPin, Lock } from "lucide-react";
import Link from "next/link";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { supabase } from "@/lib/supabase";
import { getAlertLogs, updateAlertPrefs, type AlertLog } from "@/lib/api";
import { cn, riskBadge, riskColor } from "@/lib/utils";

const DEFAULT_PREFS = {
  email_alerts:              true,
  sms_alerts:                false,
  alert_frequency:           "immediate",
  risk_threshold:            "medium",
  city:                      "Houston",
  price_volatility_alert:    true,
  weather_demand_alert:      true,
  gas_supply_alert:          true,
  price_threshold_mwh:       150,
  temp_high_threshold_f:     105,
  temp_low_threshold_f:      25,
  gas_storage_pct_threshold: -10,
};

const LOCATIONS = ["Houston", "Dallas", "Austin", "San Antonio"];
const FREQUENCIES = [
  { value: "immediate", label: "Immediate",     desc: "Alert sent as soon as risk level changes" },
  { value: "daily",     label: "Daily summary", desc: "One digest each morning at 7am CDT" },
  { value: "weekly",    label: "Weekly summary", desc: "Monday morning weekly risk digest" },
];

function RiskBadge({ level }: { level: string }) {
  const cls = level === "high"   ? "bg-red-500/15 border-red-500/30 text-red-400" :
              level === "medium" ? "bg-amber-500/15 border-amber-500/30 text-amber-400" :
                                   "bg-green-500/15 border-green-500/30 text-green-400";
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold border capitalize", cls)}>
      {level}
    </span>
  );
}

export default function AlertsPage() {
  const router = useRouter();
  const [user,    setUser]    = useState<any>(null);
  const [isPro,   setIsPro]   = useState(false);
  const [logs,    setLogs]    = useState<AlertLog[]>([]);
  const [prefs,   setPrefs]   = useState(DEFAULT_PREFS);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<"logs" | "settings">("logs");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace("/login"); return; }
      setUser(data.user);

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", data.user.id)
        .maybeSingle();
      const pro = sub?.plan === "pro" || sub?.plan === "business" || sub?.plan === "enterprise";
      const active = sub?.status === "active" || sub?.status === "trialing";
      setIsPro(pro && active);

      const session = await supabase.auth.getSession();
      const token   = session.data.session?.access_token;
      if (token) {
        try {
          const [logsData, prefsData] = await Promise.allSettled([
            getAlertLogs(token),
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/alerts/preferences`, {
              headers: { Authorization: `Bearer ${token}` },
            }).then(r => r.json()),
          ]);
          if (logsData.status === "fulfilled") setLogs(logsData.value.logs ?? []);
          if (prefsData.status === "fulfilled" && prefsData.value && !prefsData.value.detail) {
            setPrefs(p => ({ ...p, ...prefsData.value }));
          }
        } catch { /* ignore */ }
      }
      setLoading(false);
    });
  }, [router]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const session = await supabase.auth.getSession();
      const token   = session.data.session?.access_token;
      if (token) {
        await updateAlertPrefs(prefs, token);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <Navbar />
      <main className="pt-20 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

          {/* Header */}
          <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black text-white">Alert Center</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Configure email alerts and view your alert history
              </p>
            </div>
            {!isPro && (
              <Link
                href="/pricing"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 text-sm font-semibold hover:bg-orange-500/15 transition-all"
              >
                <Zap className="w-4 h-4" />
                Upgrade to Pro for alerts
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-8 w-fit">
            {(["logs", "settings"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize",
                  tab === t ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
                )}
              >
                {t === "logs" ? "Alert History" : "Settings"}
              </button>
            ))}
          </div>

          {/* ── Alert History tab ─────────────────────────────── */}
          {tab === "logs" && (
            <div>
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
                </div>
              ) : logs.length === 0 ? (
                <div className="card-glass border border-white/5 rounded-xl p-12 text-center">
                  <Bell className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 font-semibold mb-1">No alerts yet</p>
                  <p className="text-sm text-gray-600">
                    {isPro
                      ? "Alerts will appear here when risk levels change."
                      : "Upgrade to Pro to enable email alerts."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="card-glass border border-white/5 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                            (log.risk_level || log.severity) === "high"   ? "bg-red-500/15" :
                            (log.risk_level || log.severity) === "medium" ? "bg-amber-500/15" :
                                                                             "bg-green-500/15"
                          )}>
                            <Bell className={cn("w-4 h-4",
                              (log.risk_level || log.severity) === "high"   ? "text-red-400" :
                              (log.risk_level || log.severity) === "medium" ? "text-amber-400" :
                                                                               "text-green-400"
                            )} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <RiskBadge level={log.risk_level || log.severity || "low"} />
                              {log.primary_driver && (
                                <span className="text-xs text-gray-400">{log.primary_driver}</span>
                              )}
                              {log.city && (
                                <span className="text-xs text-gray-600">· {log.city}</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-300 mt-1 leading-relaxed">{log.message}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <p className="text-xs text-gray-600 font-mono">
                            {new Date(log.sent_at || "").toLocaleString("en-US", {
                              timeZone: "America/Chicago", month: "short", day: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })} CDT
                          </p>
                          <div className="flex gap-1.5">
                            {log.delivered_email && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-green-500/10 text-green-400 border border-green-500/20">
                                <Check className="w-2.5 h-2.5" />Email
                              </span>
                            )}
                            {!log.delivered_email && (
                              <span className="text-xs text-gray-700 px-1.5 py-0.5">not sent</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Settings tab ──────────────────────────────────── */}
          {tab === "settings" && (
            <div className="space-y-6">

              {!isPro && (
                <div className="card-glass border border-amber-500/20 bg-amber-500/5 rounded-xl p-5 flex items-start gap-3">
                  <Lock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-300 mb-1">Pro required for email alerts</p>
                    <p className="text-xs text-gray-400 leading-relaxed mb-3">
                      Email alerts are available on the Pro plan ($99/month). You can configure preferences now and they will activate when you upgrade.
                    </p>
                    <Link href="/pricing" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-semibold hover:bg-orange-500/20 transition-all">
                      View Pro Plan <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}

              {/* Delivery channels */}
              <div className="card-glass border border-white/5 rounded-xl p-6">
                <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  Delivery Channels
                </h2>
                <div className="space-y-3">
                  <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <p className="text-sm font-semibold text-gray-200">Email alerts</p>
                      <p className="text-xs text-gray-500">Sent to {user?.email}</p>
                    </div>
                    <div
                      onClick={() => setPrefs(p => ({ ...p, email_alerts: !p.email_alerts }))}
                      className={cn("w-10 h-6 rounded-full transition-all cursor-pointer flex-shrink-0 relative",
                        prefs.email_alerts ? "bg-orange-500" : "bg-white/10")}
                    >
                      <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                        prefs.email_alerts ? "left-5" : "left-1")} />
                    </div>
                  </label>
                  <label className="flex items-center justify-between gap-4 opacity-60">
                    <div>
                      <p className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                        SMS alerts
                        <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/15 border border-blue-500/20 text-blue-400">Coming soon</span>
                      </p>
                      <p className="text-xs text-gray-500">Immediate SMS for High risk events</p>
                    </div>
                    <div className="w-10 h-6 rounded-full bg-white/5 flex-shrink-0" />
                  </label>
                </div>
              </div>

              {/* Alert triggers */}
              <div className="card-glass border border-white/5 rounded-xl p-6">
                <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-gray-400" />
                  Alert Triggers
                </h2>
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Risk threshold</p>
                  <div className="flex gap-2">
                    {["medium", "high"].map((level) => (
                      <button
                        key={level}
                        onClick={() => setPrefs(p => ({ ...p, risk_threshold: level }))}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-semibold border capitalize transition-all",
                          prefs.risk_threshold === level
                            ? level === "high" ? "bg-red-500/15 border-red-500/30 text-red-300" : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                            : "border-white/10 text-gray-400 hover:border-white/20"
                        )}
                      >
                        {level === "medium" ? "Medium & above" : "High only"}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    {prefs.risk_threshold === "medium"
                      ? "Alert when risk changes Low→Medium or Medium→High"
                      : "Alert only when risk reaches High"}
                  </p>
                </div>
                <div className="space-y-2">
                  {[
                    { key: "price_volatility_alert", label: "ERCOT price volatility alerts" },
                    { key: "weather_demand_alert",   label: "Weather demand pressure alerts" },
                    { key: "gas_supply_alert",       label: "Gas supply below average alerts" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                      <div
                        onClick={() => setPrefs(p => ({ ...p, [key]: !(p as any)[key] }))}
                        className={cn("w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
                          (prefs as any)[key] ? "bg-orange-500 border-orange-500" : "border-white/20")}
                      >
                        {(prefs as any)[key] && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-sm text-gray-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Frequency */}
              <div className="card-glass border border-white/5 rounded-xl p-6">
                <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  Alert Frequency
                </h2>
                <div className="space-y-2">
                  {FREQUENCIES.map(({ value, label, desc }) => (
                    <label
                      key={value}
                      onClick={() => setPrefs(p => ({ ...p, alert_frequency: value }))}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                        prefs.alert_frequency === value ? "border-orange-500/30 bg-orange-500/5" : "border-white/5 hover:border-white/10"
                      )}
                    >
                      <div className={cn("w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all",
                        prefs.alert_frequency === value ? "border-orange-500 bg-orange-500" : "border-white/20")} />
                      <div>
                        <p className="text-sm font-semibold text-gray-200">{label}</p>
                        <p className="text-xs text-gray-500">{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Market */}
              <div className="card-glass border border-white/5 rounded-xl p-6">
                <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  Market / City
                </h2>
                <div className="flex gap-2 flex-wrap">
                  {LOCATIONS.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => setPrefs(p => ({ ...p, city: loc }))}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all",
                        prefs.city === loc
                          ? "bg-white/10 border-white/20 text-white"
                          : "border-white/8 text-gray-400 hover:border-white/15"
                      )}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="px-4 py-3 rounded-xl bg-white/3 border border-white/5 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-gray-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-gray-600 leading-relaxed">
                  All alerts are for informational and situational awareness purposes only.
                  They do not constitute investment, trading, or procurement advice.
                </p>
              </div>

              {/* Save button */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-sm transition-all"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Settings2 className="w-4 h-4" />}
                  {saving ? "Saving..." : saved ? "Saved!" : "Save preferences"}
                </button>
                {saved && <p className="text-xs text-green-400">Preferences saved successfully.</p>}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

// Missing import fix
function Zap({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
