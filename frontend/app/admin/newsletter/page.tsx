"use client";
import { useEffect, useState } from "react";
import { CheckCircle, Send, Eye, RefreshCw, Loader2 } from "lucide-react";

const API  = process.env.NEXT_PUBLIC_API_URL || "https://texas-energy-risk-production.up.railway.app";

interface Issue {
  id:                string;
  issue_date:        string;
  subject:           string;
  preview_text:      string;
  risk_level:        string;
  status:            string;
  executive_summary: string;
  what_changed:      string;
  watch_items:       string;
  ai_outlook:        string;
  html_content:      string;
  created_at:        string;
  sent_at:           string | null;
}

export default function AdminNewsletter() {
  const [issues,     setIssues]     = useState<Issue[]>([]);
  const [selected,   setSelected]   = useState<Issue | null>(null);
  const [testEmail,  setTestEmail]  = useState("");
  const [segment,    setSegment]    = useState("");
  const [loading,    setLoading]    = useState(false);
  const [msg,        setMsg]        = useState("");
  const [adminKey,   setAdminKey]   = useState("");
  const [authed,     setAuthed]     = useState(false);

  const headers = { Authorization: `Bearer ${adminKey}`, "Content-Type": "application/json" };

  const fetchIssues = async () => {
    const r = await fetch(`${API}/api/newsletter/admin/issues`, { headers });
    if (r.ok) setIssues(await r.json());
  };

  useEffect(() => { fetchIssues(); }, []);

  const generate = async () => {
    setLoading(true); setMsg("");
    const r = await fetch(`${API}/api/newsletter/admin/generate`, { method: "POST", headers });
    const d = await r.json();
    setMsg(r.ok ? `Draft created: ${d.issue_id}` : "Generation failed");
    await fetchIssues();
    setLoading(false);
  };

  const approve = async (id: string) => {
    await fetch(`${API}/api/newsletter/admin/issues/${id}/approve`, { method: "POST", headers });
    setMsg("Approved."); await fetchIssues();
  };

  const sendTest = async (id: string) => {
    if (!testEmail) { setMsg("Enter a test email first."); return; }
    const r = await fetch(`${API}/api/newsletter/admin/issues/${id}/send-test`, {
      method: "POST", headers,
      body: JSON.stringify({ test_email: testEmail }),
    });
    const d = await r.json();
    setMsg(d.status === "sent" ? `Test sent to ${testEmail}` : "Test send failed.");
  };

  const sendAll = async (id: string) => {
    if (!confirm("Send to all active subscribers? This cannot be undone.")) return;
    setLoading(true);
    const r = await fetch(`${API}/api/newsletter/admin/issues/${id}/send`, {
      method: "POST", headers,
      body: JSON.stringify({ segment: segment || null }),
    });
    const d = await r.json();
    setMsg(`Sent: ${d.sent} delivered, ${d.failed} failed.`);
    await fetchIssues(); setLoading(false);
  };

  const riskColor = (r: string) =>
    r === "high" ? "text-red-400" : r === "medium" ? "text-amber-400" : "text-green-400";

  const statusBadge = (s: string) => ({
    draft:    "bg-gray-500/15 text-gray-400",
    approved: "bg-blue-500/15 text-blue-400",
    sent:     "bg-green-500/15 text-green-400",
    failed:   "bg-red-500/15 text-red-400",
  }[s] || "bg-gray-500/15 text-gray-400");

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#080d1a] flex items-center justify-center px-4">
        <div className="w-full max-w-sm card-glass border border-white/8 rounded-2xl p-6">
          <h1 className="text-lg font-black text-white mb-1">Newsletter Admin</h1>
          <p className="text-xs text-gray-400 mb-4">Enter your admin password to continue.</p>
          <input
            type="password" value={adminKey} onChange={e => setAdminKey(e.target.value)}
            placeholder="Admin password"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none mb-3"
            onKeyDown={e => e.key === "Enter" && setAuthed(true)}
          />
          <button onClick={() => setAuthed(true)}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 rounded-xl text-sm font-bold text-white transition-all">
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080d1a] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black">Newsletter Admin</h1>
            <p className="text-sm text-gray-400">Texas Energy Risk Brief — Issue Management</p>
          </div>
          <button
            onClick={generate} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Generate Draft
          </button>
        </div>

        {msg && (
          <div className="mb-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-300">{msg}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Issue list */}
          <div className="lg:col-span-1 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Issues ({issues.length})</p>
            {issues.map(issue => (
              <button
                key={issue.id}
                onClick={() => setSelected(issue)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  selected?.id === issue.id
                    ? "border-orange-500/40 bg-orange-500/5"
                    : "border-white/5 bg-white/3 hover:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">{issue.issue_date}</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${statusBadge(issue.status)}`}>
                    {issue.status}
                  </span>
                </div>
                <p className="text-xs font-semibold text-gray-200 leading-snug">{issue.subject}</p>
                <p className={`text-[10px] font-bold uppercase mt-1 ${riskColor(issue.risk_level)}`}>{issue.risk_level} risk</p>
              </button>
            ))}
            {issues.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-8">No issues yet. Generate a draft to start.</p>
            )}
          </div>

          {/* Issue detail */}
          <div className="lg:col-span-2">
            {selected ? (
              <div className="card-glass border border-white/8 rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{selected.issue_date}</p>
                    <h2 className="text-base font-bold text-white">{selected.subject}</h2>
                    <p className="text-xs text-gray-400">{selected.preview_text}</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${statusBadge(selected.status)}`}>
                    {selected.status}
                  </span>
                </div>

                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Executive Summary</p>
                  <p className="text-xs text-gray-300 leading-relaxed">{selected.executive_summary}</p>
                </div>

                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">What Changed</p>
                  <p className="text-xs text-gray-300 leading-relaxed">{selected.what_changed}</p>
                </div>

                {/* Actions */}
                <div className="border-t border-white/5 pt-4 space-y-3">
                  {/* Test email */}
                  <div className="flex gap-2">
                    <input
                      type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
                      placeholder="Test email address"
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none"
                    />
                    <button
                      onClick={() => sendTest(selected.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-xs text-blue-300 font-semibold transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" /> Send Test
                    </button>
                  </div>

                  {/* Approve + Send */}
                  <div className="flex gap-2">
                    {selected.status === "draft" && (
                      <button
                        onClick={() => approve(selected.id)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg text-xs text-green-300 font-semibold transition-all"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                    )}
                    {selected.status === "approved" && (
                      <>
                        <input
                          type="text" value={segment} onChange={e => setSegment(e.target.value)}
                          placeholder="Segment (optional)"
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none"
                        />
                        <button
                          onClick={() => sendAll(selected.id)} disabled={loading}
                          className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-xs text-white font-bold transition-all disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" /> Send Now
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card-glass border border-white/5 rounded-2xl p-12 text-center">
                <p className="text-gray-600 text-sm">Select an issue to review</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
