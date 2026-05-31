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
  sms_enabled:               false,
  sms_phone:                 "",
  slack_enabled:             false,
  slack_webhook_url:         "",
  teams_enabled:             false,
  teams_webhook_url:         "",
  escalation_enabled:        false,
  escalation_minutes:        30,
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
  digest_enabled:            false,
  digest_email:              "",
};

const LOCATIONS   = [
  "Houston", "Dallas", "Austin", "San Antonio",
  "Midland", "Odessa", "Corpus Christi", "Lubbock",
];
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
    <div className="card-glass border border-white/8 rounded-xl overflow-hidden mb-4">
      <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sample Alert — what you will receive</p>
      </div>
      <div className="p-5">
        {/* Email preview card */}
        <div className="border border-amber-500/25 bg-amber-500/5 rounded-xl overflow-hidden">
          {/* Email header */}
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 flex items-center gap-2.5">
            <span className="text-base">⚡</span>
            <div>
              <p className="text-xs font-bold text-amber-300 leading-none">TX Energy Risk Alert</p>
              <p className="text-xs text-amber-400/60 mt-0.5">alerts@txenergyrisk.com</p>
            </div>
          </div>
          {/* Email body */}
          <div className="px-4 py-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold">⚠ MEDIUM RISK DETECTED</span>
              <span className="text-xs text-gray-500">Short-term (0–6h) · Houston</span>
            </div>
            <p className="text-sm text-gray-200 leading-relaxed">
              Texas energy risk increased from <span className="text-green-400 font-semibold">Low</span> to <span className="text-amber-400 font-semibold">Medium</span>. Weather-driven demand pressure is the primary driver.
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs border-t border-white/5 pt-3">
              <span className="text-gray-500">Primary driver: <span className="text-gray-300">High temp demand</span></span>
              <span className="text-gray-500">Confidence: <span className="text-gray-300">72%</span></span>
              <span className="text-gray-500">ERCOT price: <span className="text-gray-300">$33.10/MWh</span></span>
              <span className="text-gray-500">Forecast high: <span className="text-gray-300">98°F</span></span>
            </div>
            <div className="bg-amber-500/8 border border-amber-500/15 rounded-lg px-3 py-2.5">
              <p className="text-xs text-amber-300/80 font-semibold uppercase tracking-wide mb-1">Why this matters</p>
              <p className="text-xs text-gray-400 leading-relaxed">Elevated temperatures may increase grid load and introduce pricing uncertainty over the next 6–24 hours.</p>
            </div>
            <div className="flex gap-3 pt-1">
              <span className="inline-block px-3 py-1.5 bg-orange-500/20 border border-orange-500/30 rounded text-xs text-orange-400 font-semibold">View Dashboard →</span>
            </div>
          </div>
        </div>
      </div>
      {/* Urgency + social proof */}
      <div className="px-5 pb-4 space-y-1.5">
        <p className="text-xs text-gray-400 text-center">
          Alerts like this are sent in real-time when market conditions change.
        </p>
        <p className="text-xs text-gray-600 text-center">
          Used by energy professionals to monitor Texas market conditions.
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
      <main className="pt-24 min-h-screen">
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
                Start Getting Alerts
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
                  <div className="card-glass border border-orange-500/20 bg-orange-500/5 rounded-xl p-5 flex items-start gap-3">
                    <Bell className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-white mb-1">Don&apos;t miss energy market shifts that impact cost</p>
                      <p className="text-xs text-gray-400 leading-relaxed mb-3">
                        Get real-time alerts when market conditions change — before they impact cost. Configure your preferences now and they activate the moment you upgrade.
                      </p>
                      <Link href="/pricing" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all">
                        Unlock Real-Time Alerts <ChevronRight className="w-3 h-3" />
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
                <div className="space-y-5">

                  {/* Email */}
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-200">Email alerts</p>
                      <p className="text-xs text-gray-500">Sent to {user?.email}</p>
                    </div>
                    <Toggle on={prefs.email_alerts} onToggle={() => set("email_alerts", !prefs.email_alerts)} />
                  </div>

                  {/* SMS */}
                  <div className="space-y-2 border-t border-white/5 pt-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-green-400" />
                          SMS alerts
                        </p>
                        <p className="text-xs text-gray-500">Immediate text message for High risk events</p>
                      </div>
                      <Toggle
                        on={prefs.sms_enabled}
                        onToggle={() => set("sms_enabled", !prefs.sms_enabled)}
                        disabled={!isPro}
                      />
                    </div>
                    {prefs.sms_enabled && isPro && (
                      <div className="mt-2">
                        <label className="text-xs text-gray-400 font-medium block mb-1">Phone number (E.164 format)</label>
                        <input
                          type="tel"
                          value={prefs.sms_phone}
                          onChange={e => set("sms_phone", e.target.value)}
                          placeholder="+12145550100"
                          className="w-full max-w-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50"
                        />
                        <p className="text-xs text-gray-600 mt-1">Include country code (e.g. +1 for US).</p>
                      </div>
                    )}
                  </div>

                  {/* Slack */}
                  <div className="space-y-2 border-t border-white/5 pt-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                          Slack notifications
                        </p>
                        <p className="text-xs text-gray-500">Post alerts to a Slack channel via webhook</p>
                      </div>
                      <Toggle
                        on={prefs.slack_enabled}
                        onToggle={() => set("slack_enabled", !prefs.slack_enabled)}
                        disabled={!isPro}
                      />
                    </div>
                    {prefs.slack_enabled && isPro && (
                      <div className="mt-2">
                        <label className="text-xs text-gray-400 font-medium block mb-1">Slack Incoming Webhook URL</label>
                        <input
                          type="url"
                          value={prefs.slack_webhook_url}
                          onChange={e => set("slack_webhook_url", e.target.value)}
                          placeholder="https://hooks.slack.com/services/..."
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50"
                        />
                        <p className="text-xs text-gray-600 mt-1">Create an Incoming Webhook in your Slack App configuration.</p>
                      </div>
                    )}
                  </div>

                  {/* Teams */}
                  <div className="space-y-2 border-t border-white/5 pt-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                          Microsoft Teams notifications
                        </p>
                        <p className="text-xs text-gray-500">Post alerts to a Teams channel via webhook</p>
                      </div>
                      <Toggle
                        on={prefs.teams_enabled}
                        onToggle={() => set("teams_enabled", !prefs.teams_enabled)}
                        disabled={!isPro}
                      />
                    </div>
                    {prefs.teams_enabled && isPro && (
                      <div className="mt-2">
                        <label className="text-xs text-gray-400 font-medium block mb-1">Teams Incoming Webhook URL</label>
                        <input
                          type="url"
                          value={prefs.teams_webhook_url}
                          onChange={e => set("teams_webhook_url", e.target.value)}
                          placeholder="https://yourorg.webhook.office.com/webhookb2/..."
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50"
                        />
                        <p className="text-xs text-gray-600 mt-1">Add an Incoming Webhook connector to your Teams channel.</p>
                      </div>
                    )}
                  </div>

                  {/* Escalation */}
                  <div className="space-y-2 border-t border-white/5 pt-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                          Escalation alerts
                        </p>
                        <p className="text-xs text-gray-500">Re-send High risk alerts if not acknowledged within the escalation window</p>
                      </div>
                      <Toggle
                        on={prefs.escalation_enabled}
                        onToggle={() => set("escalation_enabled", !prefs.escalation_enabled)}
                        disabled={!isPro}
                      />
                    </div>
                    {prefs.escalation_enabled && isPro && (
                      <div className="mt-2 flex items-center gap-3">
                        <label className="text-xs text-gray-400 font-medium">Escalate after</label>
                        <select
                          value={prefs.escalation_minutes}
                          onChange={e => set("escalation_minutes", Number(e.target.value))}
                          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-orange-500/50"
                        >
                          {[15, 30, 60, 120].map(m => (
                            <option key={m} value={m}>{m} min</option>
                          ))}
                        </select>
                        <span className="text-xs text-gray-500">if unacknowledged</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Test send (Pro only) */}
                {isPro && (
                  <div className="mt-5 pt-4 border-t border-white/5 flex items-center gap-3 flex-wrap">
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
                    { key: "price_volatility_alert", icon: <Zap className="w-4 h-4 text-amber-400" />,         label: "ERCOT price instability",           desc: "Alert when Hub prices show abnormal volatility — early warning of cost exposure" },
                    { key: "weather_demand_alert",   icon: <CloudLightning className="w-4 h-4 text-blue-400" />, label: "High temperature demand pressure",  desc: "Alert when heat or cold drives elevated grid load and pricing risk" },
                    { key: "gas_supply_alert",       icon: <Flame className="w-4 h-4 text-orange-400" />,       label: "Natural gas supply tightening",     desc: "Alert when storage falls below seasonal average, increasing supply pressure" },
                    { key: "data_source_alert",      icon: <Database className="w-4 h-4 text-gray-400" />,      label: "Data reliability issues",           desc: "Informational notice when a data feed becomes stale or unavailable" },
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
                <p className="text-xs text-gray-500 mb-1">
                  Pause non-critical alerts during off hours.
                </p>
                <div className="mb-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/15">
                  <span className="text-amber-400 text-xs mt-0.5">⚡</span>
                  <p className="text-xs text-amber-300/80 leading-relaxed">
                    <span className="font-semibold">High-risk alerts are always delivered</span> — quiet hours only suppress Medium and Low risk notifications.
                  </p>
                </div>
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

              {/* What triggers an alert */}
              <div className="card-glass border border-white/5 rounded-xl p-5">
                <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4 text-gray-400" />
                  What triggers an alert?
                </h2>
                <div className="space-y-2">
                  {[
                    { dot: "bg-red-500",   text: "Risk level increases — Low→Medium, Medium→High, or Low→High" },
                    { dot: "bg-amber-500", text: "A new primary risk driver appears (e.g. weather replaces ERCOT as the dominant signal)" },
                    { dot: "bg-blue-500",  text: "Data reliability changes — a key data source becomes stale or unavailable" },
                  ].map(({ dot, text }, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${dot}`} />
                      <p className="text-xs text-gray-400 leading-relaxed">{text}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-gray-600 leading-relaxed border-t border-white/5 pt-3">
                  Duplicate alerts are suppressed: the same risk level and driver will not re-alert within 60 minutes (30 minutes for High Risk).
                </p>
              </div>

              {/* Morning Digest */}
              <div className="card-glass border border-white/5 rounded-xl p-5">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Mail className="w-4 h-4 text-orange-400" />
                    Morning Digest
                  </h2>
                  <Toggle on={!!prefs.digest_enabled} onToggle={() => set("digest_enabled", !prefs.digest_enabled)} />
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Receive a daily risk summary at 7 AM CT every morning — separate from your real-time alerts.
                </p>
                {prefs.digest_enabled && (
                  <div className="space-y-2">
                    <label className="text-xs text-gray-400 font-medium">Delivery email</label>
                    <input
                      type="email"
                      value={(prefs as any).digest_email || ""}
                      onChange={e => set("digest_email", e.target.value)}
                      placeholder="Enter email (leave blank to use account email)"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50"
                    />
                    <p className="text-xs text-gray-600">
                      If left blank, the digest is sent to your account email.
                    </p>
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
