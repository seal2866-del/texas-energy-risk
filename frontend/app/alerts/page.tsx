"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, Check, Settings2, AlertTriangle, Info, Loader2,
  ChevronRight, Mail, MessageSquare, Clock, MapPin, Lock,
  Phone, Shield, Zap, CloudLightning, Flame, Database,
  Moon, ChevronDown, ChevronUp, Send,
} from "lucide-react";
import Link from "next/link";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { supabase } from "@/lib/supabase";
import { getAlertLogs, updateAlertPrefs, type AlertLog } from "@/lib/api";
import { cn } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DEFAULT_PREFS = {
  email_alerts:              true,
  sms_alerts:                false,
  voice_enabled:             false,
  alert_frequency:           "immediate",
  risk_threshold:            "medium",
  city:                      "Houston",
  price_volatility_alert:    true,
  weather_demand_alert:      true,
  gas_supply_alert:          true,
  data_source_alert:         true,
  quiet_hours_enabled:       false,
  quiet_start_time:          "22:00",
  quiet_end_time:            "06:00",
  price_threshold_mwh:       150,
  temp_high_threshold_f:     105,
  temp_low_threshold_f:      25,
  gas_storage_pct_threshold: -10,
};

const LOCATIONS   = ["Houston", "Dallas", "Austin", "San Antonio"];
const FREQUENCIES = [
  { value: "immediate", label: "Immediate",     desc: "Alert sent as soon as risk level changes" },
  { value: "daily",     label: "Daily summary", desc: "One digest each morning at 7am CDT" },
  { value: "weekly",    label: "Weekly summary", desc: "Monday morning weekly risk digest" },
];
const THRESHOLDS = [
  { value: "any",    label: "Any risk change",  desc: "Low→Medium, Medium→High, any shift" },
  { value: "medium", label: "Medium & above",   desc: "Alert when risk reaches Medium or High" },
  { value: "high",   label: "High only",        desc: "Alert only when risk reaches High" },
];

function Toggle({ on, onToggle, disabled = false }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <div
      onClick={disabled ? undefined : onToggle}
      className={cn(
        "w-10 h-6 rounded-full transition-all flex-shrink-0 relative",
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
        on && !disabled ? "bg-orange-500" : "bg-white/10",
      )}
    >
      <span className={cn(
        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow",
        on ? "left-5" : "left-1",
      )} />
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const cls =
    level === "high"         ? "bg-red-500/15 border-red-500/30 text-red-400" :
    level === "medium"       ? "bg-amber-500/15 border-amber-500/30 text-amber-400" :
    level === "data_source"  ? "bg-blue-500/15 border-blue-500/30 text-blue-400" :
    level === "daily_summary"? "bg-purple-500/15 border-purple-500/30 text-purple-400" :
                               "bg-green-500/15 border-green-500/30 text-green-400";
  const display =
    level === "daily_summary"  ? "Daily" :
    level === "weekly_summary" ? "Weekly" :
    level === "data_source"    ? "Data" :
    level;
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold border capitalize", cls)}>
      {display}
    </span>
  );
}

function SamplePreview() {
  return (
    <div className="card-glass border border-white/8 rounded-xl p-5 mb-4 opacity-75">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Sample Alert Preview</p>
      <div className="border border-amber-500/20 bg-amber-500/5 rounded-lg p-4 text-xs space-y-2">
        <p className="font-bold text-amber-300">TX Energy Risk Alert: Medium Risk Detected</p>
        <p className="text-gray-400">Short-term Texas energy risk has increased. Primary driver: Weather-driven demand pressure.</p>
        <div className="grid grid-cols-2 gap-1 text-gray-500 mt-2">
          <span>Location: Houston</span>
          <span>Confidence: 72%</span>
          <span>ERCOT price: $33.10/MWh</span>
          <span>Forecast high: 98°F</span>
        </div>
        <p className="text-gray-600 italic border-t border-white/5 pt-2 mt-2">
          TX Energy Risk provides informational analytics only. Not investment advice.
        </p>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const router = useRouter();
  const [user,        setUser]        = useState<any>(null);
  const [isPro,       setIsPro]       = useState(false);
  const [logs,        setLogs]        = useState<AlertLog[]>([]);
  const [prefs,       setPrefs]       = useState(DEFAULT_PREFS);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState<"logs" | "settings">("logs");
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [testResult,  setTestResult]  = useState<"sent" | "error" | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace("/login"); return; }
      setUser(data.user);

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", data.user.id)
        .maybeSingle();
      const pro    = sub?.plan === "pro" || sub?.plan === "business" || sub?.plan === "enterprise";
      const active = sub?.status === "active" || sub?.status === "trialing";
      setIsPro(pro && active);

      const session = await supabase.auth.getSession();
      const token   = session.data.session?.access_token;
      if (token) {
        try {
          const [logsData, prefsData] = await Promise.allSettled([
            fetch(`${BASE}/api/alerts/logs?limit=50`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
            fetch(`${BASE}/api/alerts/preferences`,   { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
          ]);
          if (logsData.status === "fulfilled") setLogs(logsData.value.logs ?? []);
          if (prefsData.status === "fulfilled" && prefsData.value && !prefsData.value.detail)
            setPrefs(p => ({ ...p, ...prefsData.value }));
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
    } finally { setSaving(false); }
  };

  const handleTestSend = async () => {
    setTestSending(true);
    setTestResult(null);
    try {
      const session = await supabase.auth.getSession();
      const token   = session.data.session?.access_token;
      const r = await fetch(`${BASE}/api/alerts/send-test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setTestResult(r.ok ? "sent" : "error");
    } catch { setTestResult("error"); }
    finally { setTestSending(false); }
  };

  const set = useCallback(<K extends keyof typeof DEFAULT_PREFS>(
    key: K, val: typeof DEFAULT_PREFS[K]
  ) => setPrefs(p => ({ ...p, [key]: val })), []);

  if (!user) return null;

  const alertTypeLabel = (t: string) =>
    t === "daily_summary" ? "Daily" : t === "weekly_summary" ? "Weekly" :
    t === "data_source"   ? "Data notice" : "Risk change";

  return (
    <>
      <Navbar />
      <main className="pt-20 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

          {/* Header */}
          <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black text-white">Alert Center</h1>
              <p className="text-sm text-gray-500 mt-0.5">Configure email alerts and view your alert history</p>
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
                  "px-5 py-2 rounded-lg text-sm font-semibold transition-all",
                  tab === t ? "bg-white/10 text-white" : "text-gray-400 hover:text-white",
                )}
              >
                {t === "logs" ? "Alert History" : "Settings"}
              </button>
            ))}
          </div>

          {/* ── Alert History ─────────────────────────────────── */}
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
                    {isPro ? "Alerts will appear here when risk levels change." : "Upgrade to Pro to enable email alerts."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => {
                    const level   = log.risk_level || (log as any).severity || "low";
                    const isOpen  = expanded === log.id;
                    const typeTag = alertTypeLabel((log as any).alert_type || "risk_change");
                    return (
                      <div key={log.id} className="card-glass border border-white/5 rounded-xl overflow-hidden">
                        <div
                          className="flex items-start justify-between gap-3 p-4 cursor-pointer hover:bg-white/3 transition-colors"
                          onClick={() => setExpanded(isOpen ? null : log.id)}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                              level === "high" ? "bg-red-500/15" : level === "medium" ? "bg-amber-500/15" : "bg-blue-500/15",
                            )}>
                              {(log as any).alert_type === "data_source"
                                ? <Database className="w-4 h-4 text-blue-400" />
                                : <Bell className={cn("w-4 h-4",
                                    level === "high" ? "text-red-400" : level === "medium" ? "text-amber-400" : "text-green-400"
                                  )} />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <RiskBadge level={(log as any).alert_type === "daily_summary" ? "daily_summary" : (log as any).alert_type === "data_source" ? "data_source" : level} />
                                <span className="text-xs text-gray-600">{typeTag}</span>
                                {log.primary_driver && (
                                  <span className="text-xs text-gray-400">{log.primary_driver}</span>
                                )}
                                {(log.city || (log as any).selected_location) && (
                                  <span className="text-xs text-gray-600">· {log.city || (log as any).selected_location}</span>
                                )}
                              </div>
                              {(log as any).previous_risk_level && (log as any).previous_risk_level !== level && (
                                <p className="text-xs text-gray-600 mt-0.5">
                                  Changed from <span className="capitalize">{(log as any).previous_risk_level}</span> → <span className="capitalize">{level}</span>
                                </p>
                              )}
                              {log.message && <p className="text-sm text-gray-300 mt-1 leading-relaxed line-clamp-2">{log.message}</p>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <p className="text-xs text-gray-600 font-mono">
                              {new Date(log.sent_at || (log as any).created_at || "").toLocaleString("en-US", {
                                timeZone: "America/Chicago", month: "short", day: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })} CDT
                            </p>
                            <div className="flex gap-1.5 items-center">
                              {log.delivered_email && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-green-500/10 text-green-400 border border-green-500/20">
                                  <Check className="w-2.5 h-2.5" />Email
                                </span>
                              )}
                              {(log as any).delivery_status && !log.delivered_email && (
                                <span className="text-xs text-gray-700 px-1">{(log as any).delivery_status}</span>
                              )}
                              {isOpen
                                ? <ChevronUp className="w-3.5 h-3.5 text-gray-600" />
                                : <ChevronDown className="w-3.5 h-3.5 text-gray-600" />}
                            </div>
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isOpen && (
                          <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-2">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs">
                              {(log as any).confidence != null && (
                                <span className="text-gray-500">Confidence: <span className="text-gray-300">{(log as any).confidence}%</span></span>
                              )}
                              {(log as any).risk_direction && (
                                <span className="text-gray-500">Direction: <span className="text-gray-300 capitalize">{(log as any).risk_direction}</span></span>
                              )}
                              {(log as any).ercot_price != null && (
                                <span className="text-gray-500">ERCOT: <span className="text-gray-300">${(log as any).ercot_price?.toFixed(2)}/MWh</span></span>
                              )}
                              {(log as any).weather_temp != null && (
                                <span className="text-gray-500">Forecast: <span className="text-gray-300">{(log as any).weather_temp?.toFixed(0)}°F</span></span>
                              )}
                              {(log as any).gas_storage != null && (
                                <span className="text-gray-500">Gas storage: <span className="text-gray-300">{(log as any).gas_storage?.toFixed(1)}% vs avg</span></span>
                              )}
                              {(log as any).source_health_status && (
                                <span className="text-gray-500">Source: <span className="text-gray-300">{(log as any).source_health_status}</span></span>
                              )}
                            </div>
                            {log.message && (
                              <p className="text-xs text-gray-400 leading-relaxed border-t border-white/5 pt-2">{log.message}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Settings ──────────────────────────────────────── */}
          {tab === "settings" && (
            <div className="space-y-5">

              {/* Free user gate */}
              {!isPro && (
                <>
                  <SamplePreview />
                  <div className="card-glass border border-amber-500/20 bg-amber-500/5 rounded-xl p-5 flex items-start gap-3">
                    <Lock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-300 mb-1">Pro plan required for live alerts</p>
                      <p className="text-xs text-gray-400 leading-relaxed mb-3">
                        Real-time alerts are available on the Pro plan. You can configure preferences now — they activate when you upgrade.
                      </p>
                      <Link href="/pricing" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-semibold hover:bg-orange-500/20 transition-all">
                        View Pro Plan <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </>
              )}

              {/* 1. Delivery channels */}
              <div className="card-glass border border-white/5 rounded-xl p-6">
                <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  Delivery Channels
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-200">Email alerts</p>
                      <p className="text-xs text-gray-500">Sent to {user?.email}</p>
                    </div>
                    <Toggle on={prefs.email_alerts} onToggle={() => set("email_alerts", !prefs.email_alerts)} />
                  </div>
                  <div className="flex items-center justify-between gap-4 opacity-50">
                    <div>
                      <p className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                        SMS alerts
                        <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/15 border border-blue-500/20 text-blue-400">Coming soon</span>
                      </p>
                      <p className="text-xs text-gray-500">Immediate SMS for High risk events</p>
                    </div>
                    <Toggle on={false} onToggle={() => {}} disabled />
                  </div>
                  <div className="flex items-center justify-between gap-4 opacity-50">
                    <div>
                      <p className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                        Voice alerts
                        <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/15 border border-blue-500/20 text-blue-400">Coming soon</span>
                      </p>
                      <p className="text-xs text-gray-500">Automated phone call for High risk</p>
                    </div>
                    <Toggle on={false} onToggle={() => {}} disabled />
                  </div>
                </div>

                {/* Test send (Pro only) */}
                {isPro && (
                  <div className="mt-5 pt-4 border-t border-white/5 flex items-center gap-3">
                    <button
                      onClick={handleTestSend}
                      disabled={testSending}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-300 transition-all disabled:opacity-50"
                    >
                      {testSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Send test email
                    </button>
                    {testResult === "sent"  && <span className="text-xs text-green-400">Test email sent!</span>}
                    {testResult === "error" && <span className="text-xs text-red-400">Send failed — check Resend key.</span>}
                  </div>
                )}
              </div>

              {/* 2. Risk threshold */}
              <div className="card-glass border border-white/5 rounded-xl p-6">
                <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-gray-400" />
                  Alert Risk Threshold
                </h2>
                <div className="space-y-2">
                  {THRESHOLDS.map(({ value, label, desc }) => (
                    <label
                      key={value}
                      onClick={() => set("risk_threshold", value)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                        prefs.risk_threshold === value
                          ? "border-orange-500/30 bg-orange-500/5"
                          : "border-white/5 hover:border-white/10",
                      )}
                    >
                      <div className={cn("w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all",
                        prefs.risk_threshold === value ? "border-orange-500 bg-orange-500" : "border-white/20")} />
                      <div>
                        <p className="text-sm font-semibold text-gray-200">{label}</p>
                        <p className="text-xs text-gray-500">{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* 3. Location */}
              <div className="card-glass border border-white/5 rounded-xl p-6">
                <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  Market / Location
                </h2>
                <div className="flex gap-2 flex-wrap">
                  {LOCATIONS.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => set("city", loc)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all",
                        prefs.city === loc
                          ? "bg-white/10 border-white/20 text-white"
                          : "border-white/8 text-gray-400 hover:border-white/15",
                      )}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Frequency */}
              <div className="card-glass border border-white/5 rounded-xl p-6">
                <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  Alert Frequency
                </h2>
                <div className="space-y-2">
                  {FREQUENCIES.map(({ value, label, desc }) => (
                    <label
                      key={value}
                      onClick={() => set("alert_frequency", value)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                        prefs.alert_frequency === value
                          ? "border-orange-500/30 bg-orange-500/5"
                          : "border-white/5 hover:border-white/10",
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

              {/* 5. Driver preferences */}
              <div className="card-glass border border-white/5 rounded-xl p-6">
                <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gray-400" />
                  Alert Driver Preferences
                </h2>
                <p className="text-xs text-gray-500 mb-3">Choose which risk drivers trigger alerts for you.</p>
                <div className="space-y-3">
                  {[
                    { key: "price_volatility_alert", icon: <Zap className="w-4 h-4 text-amber-400" />,         label: "ERCOT volatility",         desc: "Alerts when ERCOT Hub prices are abnormally volatile" },
                    { key: "weather_demand_alert",   icon: <CloudLightning className="w-4 h-4 text-blue-400" />, label: "Weather demand pressure",  desc: "Alerts when temperature extremes drive grid demand risk" },
                    { key: "gas_supply_alert",       icon: <Flame className="w-4 h-4 text-orange-400" />,       label: "Natural gas supply",       desc: "Alerts when gas storage drops below seasonal average" },
                    { key: "data_source_alert",      icon: <Database className="w-4 h-4 text-gray-400" />,      label: "Data source degradation",  desc: "Informational notice when a data source becomes stale" },
                  ].map(({ key, icon, label, desc }) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {icon}
                        <div>
                          <p className="text-sm font-semibold text-gray-200">{label}</p>
                          <p className="text-xs text-gray-500">{desc}</p>
                        </div>
                      </div>
                      <Toggle
                        on={(prefs as any)[key] ?? true}
                        onToggle={() => set(key as keyof typeof DEFAULT_PREFS, !(prefs as any)[key])}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. Quiet hours */}
              <div className="card-glass border border-white/5 rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Moon className="w-4 h-4 text-gray-400" />
                    Quiet Hours
                  </h2>
                  <Toggle on={prefs.quiet_hours_enabled} onToggle={() => set("quiet_hours_enabled", !prefs.quiet_hours_enabled)} />
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Pause non-critical alerts during specified hours. <span className="text-amber-400">High Risk alerts always bypass quiet hours.</span>
                </p>
                {prefs.quiet_hours_enabled && (
                  <div className="flex items-center gap-4 flex-wrap">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Start time (CDT)</p>
                      <input
                        type="time"
                        value={prefs.quiet_start_time}
                        onChange={e => set("quiet_start_time", e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-orange-500/50"
                      />
                    </div>
                    <span className="text-gray-600 mt-5">to</span>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">End time (CDT)</p>
                      <input
                        type="time"
                        value={prefs.quiet_end_time}
                        onChange={e => set("quiet_end_time", e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-orange-500/50"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Compliance */}
              <div className="px-4 py-3 rounded-xl bg-white/3 border border-white/5 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-gray-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-gray-600 leading-relaxed">
                  TX Energy Risk provides informational analytics and market intelligence only.
                  These alerts do not constitute investment, trading, financial, legal, or procurement advice.
                  Users are responsible for their own decisions.
                </p>
              </div>

              {/* Save */}
              <div className="flex items-center gap-4">
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
