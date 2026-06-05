"use client";
import { useState, useEffect } from "react";
import { Search, Download, Zap, RefreshCw, Loader2, Trash2, ChevronDown, ChevronUp, Mail, Calendar, Users, BarChart2, Plus, ArrowRight, Linkedin, Upload } from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "https://texas-energy-risk-production.up.railway.app";

const INDUSTRIES = ["Oil & Gas","Manufacturing","Chemical","Petrochemical","Data Centers","Mining","Utilities","Midstream","Refining","Industrial","Construction","Agriculture","Energy Trading","Natural Gas Trading","Power Marketing","Power Generation","Energy Procurement"];
const TITLES     = ["Operations Manager","Plant Manager","Energy Manager","Procurement Manager","Facilities Manager","VP Operations","Director of Operations","COO","Energy Director","CFO","Energy Trader","Gas Trader","Power Trader","Risk Manager","Market Analyst","Director of Energy Trading","VP Energy Trading","Portfolio Manager","Hedging Manager"];
const TX_CITIES  = ["Houston, TX","Dallas, TX","Austin, TX","San Antonio, TX","Midland, TX","Odessa, TX","Corpus Christi, TX","Lubbock, TX","Beaumont, TX","Port Arthur, TX"];

const PIPELINE_STATUSES = ["new","newsletter_added","newsletter_sent","opened","clicked","demo_requested","qualified","opportunity","customer","closed_lost"];

const STATUS_STYLES: Record<string, string> = {
  new:              "bg-gray-500/15 text-gray-400 border-gray-500/20",
  newsletter_added: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  newsletter_sent:  "bg-purple-500/15 text-purple-400 border-purple-500/20",
  opened:           "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  clicked:          "bg-teal-500/15 text-teal-400 border-teal-500/20",
  demo_requested:   "bg-amber-500/15 text-amber-400 border-amber-500/20",
  qualified:        "bg-orange-500/15 text-orange-400 border-orange-500/20",
  opportunity:      "bg-red-500/15 text-red-400 border-red-500/20",
  customer:         "bg-green-500/15 text-green-400 border-green-500/20",
  closed_lost:      "bg-gray-700/15 text-gray-600 border-gray-700/20",
};

interface Prospect {
  id: string; company_name: string; website: string; industry: string;
  employee_count: number; city: string; state: string;
  contact_name: string; contact_title: string; contact_email: string; contact_linkedin: string;
  lead_score: number; priority: string; status: string;
  energy_exposure: string; pain_points: string; sales_message: string; enriched_at: string;
}

interface Audience { id: string; name: string; description: string; member_count: number; }
interface Stats { total_prospects: number; high_priority: number; avg_lead_score: number; by_region: Record<string,number>; by_priority: Record<string,number>; }

function PriorityBadge({ priority }: { priority: string }) {
  const s = { high:"bg-red-500/15 text-red-400 border-red-500/20", medium:"bg-amber-500/15 text-amber-400 border-amber-500/20", low:"bg-gray-500/15 text-gray-400 border-gray-500/20" }[priority] || "bg-gray-500/15 text-gray-400";
  return <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${s}`}>{priority}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || "bg-gray-500/15 text-gray-400 border-gray-500/20";
  return <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${s}`}>{status.replace("_"," ")}</span>;
}

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 65 ? "text-red-400" : score >= 40 ? "text-amber-400" : "text-green-400";
  return <div className={`w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-sm font-black ${color}`}>{score}</div>;
}

export default function ProspectingPage() {
  const [tab,          setTab]          = useState<"prospects"|"audiences">("prospects");
  const [prospects,    setProspects]    = useState<Prospect[]>([]);
  const [audiences,    setAudiences]    = useState<Audience[]>([]);
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [importing,    setImporting]    = useState(false);
  const [enriching,    setEnriching]    = useState<string | null>(null);
  const [actioning,    setActioning]    = useState<string | null>(null);
  const [revealing,    setRevealing]    = useState<string | null>(null);
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkAdding,   setBulkAdding]   = useState(false);
  const [expanded,     setExpanded]     = useState<string | null>(null);
  const [msg,          setMsg]          = useState("");

  // Search filters
  const [locations,    setLocations]    = useState<string[]>(["Houston, TX"]);
  const [industries,   setIndustries]   = useState<string[]>([]);
  const [titles,       setTitles]       = useState<string[]>([]);
  const [empMin,       setEmpMin]       = useState("");
  const [empMax,       setEmpMax]       = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");

  // Audience creation
  const [newAudName,   setNewAudName]   = useState("");
  const [newAudDesc,   setNewAudDesc]   = useState("");

  const fetchAll = async () => {
    const params = new URLSearchParams({ limit: "200" });
    if (filterStatus)   params.set("status",   filterStatus);
    if (filterPriority) params.set("priority", filterPriority);
    const [pR, aR, sR] = await Promise.allSettled([
      fetch(`${API}/api/prospecting/prospects?${params}`).then(r => r.json()),
      fetch(`${API}/api/prospecting/audiences`).then(r => r.json()),
      fetch(`${API}/api/prospecting/dashboard`).then(r => r.json()),
    ]);
    if (pR.status === "fulfilled") setProspects(pR.value);
    if (aR.status === "fulfilled") setAudiences(aR.value);
    if (sR.status === "fulfilled") setStats(sR.value);
  };

  useEffect(() => { fetchAll(); }, [filterStatus, filterPriority]);

  const search = async () => {
    setLoading(true); setMsg("");
    try {
      const r = await fetch(`${API}/api/prospecting/search`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locations, industries, titles,
          employee_min: empMin ? parseInt(empMin) : null,
          employee_max: empMax ? parseInt(empMax) : null, per_page: 25 }),
      });
      const d = await r.json();
      setMsg(r.ok ? `Found ${d.count} new prospects (${d.duplicates||0} skipped)` : `Error: ${d.detail}`);
      await fetchAll();
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    setLoading(false);
  };

  const importCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setMsg("");
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(`${API}/api/prospecting/import-csv`, { method: "POST", body: form });
      const d = await r.json();
      if (r.ok) {
        setMsg(`✓ Imported ${d.imported} prospects (${d.duplicates} duplicates skipped, ${d.skipped} rows skipped)`);
        await fetchAll();
      } else {
        setMsg(`Error: ${d.detail}`);
      }
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    setImporting(false);
    e.target.value = "";
  };

  const enrich = async (id: string) => {
    setEnriching(id);
    await fetch(`${API}/api/prospecting/enrich/${id}`, { method: "POST" });
    await fetchAll();
    setEnriching(null);
  };

  const addToNewsletter = async (id: string) => {
    setActioning(id);
    const r = await fetch(`${API}/api/prospecting/prospects/${id}/add-to-newsletter`, { method: "POST" });
    const d = await r.json();
    setMsg(r.ok ? "Added to newsletter list ✓" : `Error: ${d.detail}`);
    await fetchAll();
    setActioning(null);
  };

  const requestDemo = async (id: string) => {
    setActioning(id);
    await fetch(`${API}/api/prospecting/prospects/${id}/request-demo`, { method: "POST" });
    setMsg("Demo request logged ✓");
    await fetchAll();
    setActioning(null);
  };

  const revealEmail = async (id: string) => {
    setRevealing(id);
    try {
      const r = await fetch(`${API}/api/prospecting/prospects/${id}/reveal-email`, { method: "POST" });
      const data = await r.json();
      if (data.email) {
        setMsg(`Email revealed: ${data.email} ${data.credits_used ? "(1 credit used)" : "(cached)"}`);
        setProspects(prev => prev.map(p => p.id === id ? { ...p, contact_email: data.email } : p));
      } else {
        setMsg("Apollo has no email for this contact.");
      }
    } catch { setMsg("Reveal failed — check connection."); }
    setRevealing(null);
  };

  const toggleSelect = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const selectAll = () =>
    setSelected(prospects.length === selected.size ? new Set() : new Set(prospects.map(p => p.id)));

  const bulkDelete = async () => {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} prospects?`)) return;
    setBulkDeleting(true);
    await Promise.all([...selected].map(id =>
      fetch(`${API}/api/prospecting/prospects/${id}`, { method: "DELETE" })
    ));
    setProspects(prev => prev.filter(p => !selected.has(p.id)));
    setSelected(new Set());
    setBulkDeleting(false);
    setMsg(`Deleted ${selected.size} prospects`);
    await fetchAll();
  };

  const bulkAddToNewsletter = async () => {
    if (!selected.size) return;
    setBulkAdding(true);
    let added = 0;
    for (const id of selected) {
      const r = await fetch(`${API}/api/prospecting/prospects/${id}/add-to-newsletter`, { method: "POST" });
      if (r.ok) added++;
    }
    setMsg(`Added ${added} of ${selected.size} to newsletter ✓`);
    setSelected(new Set());
    setBulkAdding(false);
    await fetchAll();
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`${API}/api/prospecting/prospects/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchAll();
  };

  const deleteProspect = async (id: string) => {
    await fetch(`${API}/api/prospecting/prospects/${id}`, { method: "DELETE" });
    setProspects(p => p.filter(x => x.id !== id));
  };

  const createAudience = async () => {
    if (!newAudName) return;
    await fetch(`${API}/api/prospecting/audiences`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newAudName, description: newAudDesc,
        filters: { locations, industries, filterStatus } }),
    });
    setNewAudName(""); setNewAudDesc("");
    await fetchAll();
  };

  const pushToResend = async (id: string) => {
    const r = await fetch(`${API}/api/prospecting/audiences/${id}/push-to-resend`, { method: "POST" });
    const d = await r.json();
    setMsg(`Synced ${d.synced} contacts to Resend`);
  };

  const exportAudience = (id: string) => window.open(`${API}/api/prospecting/audiences/${id}/export`, "_blank");
  const exportAll      = ()           => {
    const params = new URLSearchParams();
    if (filterPriority) params.set("priority", filterPriority);
    window.open(`${API}/api/prospecting/export?${params}`, "_blank");
  };

  const toggle = (arr: string[], val: string, set: (v: string[]) => void) =>
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  return (
    <>
      <Navbar />
      <main className="pt-24 min-h-screen bg-[#080d1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-black text-white">Prospecting CRM</h1>
              <p className="text-sm text-gray-400">Apollo.io → Newsletter → Demo → Customer</p>
            </div>
            <div className="flex gap-2">
              <Link href="/prospecting/analytics"
                className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold text-gray-300 hover:bg-white/10 transition-all">
                <BarChart2 className="w-3.5 h-3.5" /> Analytics
              </Link>
              <button onClick={exportAll}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold text-gray-300 hover:bg-white/10 transition-all">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: "Total",        value: stats.total_prospects,  color: "text-white" },
                { label: "High Priority",value: stats.high_priority,    color: "text-red-400" },
                { label: "Avg Score",    value: `${stats.avg_lead_score}/100`, color: "text-amber-400" },
                { label: "Regions",      value: Object.keys(stats.by_region).length, color: "text-blue-400" },
              ].map(s => (
                <div key={s.label} className="card-glass border border-white/8 rounded-xl p-3 text-center">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">{s.label}</p>
                  <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {msg && <div className="mb-3 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">{msg}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

            {/* Search Panel */}
            <div className="lg:col-span-1">
              <div className="card-glass border border-white/8 rounded-2xl p-4 space-y-4">
                <p className="text-xs font-black uppercase tracking-widest text-gray-500">Search Filters</p>

                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">Location</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {TX_CITIES.map(loc => (
                      <label key={loc} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={locations.includes(loc)} onChange={() => toggle(locations, loc, setLocations)} className="w-3 h-3" />
                        <span className="text-xs text-gray-300">{loc}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">Industry</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {INDUSTRIES.map(ind => (
                      <label key={ind} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={industries.includes(ind)} onChange={() => toggle(industries, ind, setIndustries)} className="w-3 h-3" />
                        <span className="text-xs text-gray-300">{ind}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">Employees</p>
                  <div className="flex gap-2">
                    <input type="number" placeholder="Min" value={empMin} onChange={e => setEmpMin(e.target.value)} className="w-1/2 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white" />
                    <input type="number" placeholder="Max" value={empMax} onChange={e => setEmpMax(e.target.value)} className="w-1/2 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white" />
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">Job Titles</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {TITLES.map(t => (
                      <label key={t} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={titles.includes(t)} onChange={() => toggle(titles, t, setTitles)} className="w-3 h-3" />
                        <span className="text-xs text-gray-300">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button onClick={search} disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500 hover:bg-orange-600 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {loading ? "Searching..." : "Search Apollo"}
                </button>

                {/* CSV Import */}
                <div className="border-t border-white/5 pt-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Or import Apollo CSV</p>
                  <label className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${importing ? "bg-white/5 text-gray-500 border-white/8" : "bg-white/3 hover:bg-white/8 border-white/10 text-gray-300"}`}>
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {importing ? "Importing..." : "Upload Apollo CSV"}
                    <input type="file" accept=".csv" onChange={importCSV} className="hidden" disabled={importing} />
                  </label>
                  <p className="text-[10px] text-gray-600 mt-1.5 leading-snug">
                    Apollo → People → Export CSV → upload here. Auto-scores and imports all rows.
                  </p>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">

              {/* Tabs */}
              <div className="flex items-center gap-1 mb-3 p-1 rounded-xl bg-white/5 border border-white/8 w-fit">
                {[["prospects","Prospects"], ["audiences","Audiences"]].map(([t, label]) => (
                  <button key={t} onClick={() => setTab(t as any)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === t ? "bg-white/12 text-white border border-white/15" : "text-gray-400 hover:text-gray-200"}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* PROSPECTS TAB */}
              {tab === "prospects" && (
                <>
                  {/* Filter bar */}
                  <div className="flex gap-2 flex-wrap mb-3">
                    <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none">
                      <option value="">All priorities</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none">
                      <option value="">All statuses</option>
                      {PIPELINE_STATUSES.map(s => <option key={s} value={s} className="bg-gray-900">{s.replace(/_/g," ")}</option>)}
                    </select>
                    <p className="text-xs text-gray-500 self-center ml-auto">{prospects.length} prospects</p>
                    <input type="checkbox"
                      checked={prospects.length > 0 && selected.size === prospects.length}
                      onChange={selectAll} title="Select / deselect all"
                      className="w-3.5 h-3.5 cursor-pointer accent-orange-500" />
                    <span className="text-xs text-gray-400">All</span>
                    {selected.size > 0 && (
                      <div className="flex gap-1.5">
                        <button onClick={bulkAddToNewsletter} disabled={bulkAdding}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-xs text-blue-300 font-semibold transition-all disabled:opacity-50">
                          {bulkAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                          Newsletter {selected.size}
                        </button>
                        <button onClick={bulkDelete} disabled={bulkDeleting}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-xs text-red-400 font-semibold transition-all disabled:opacity-50">
                          {bulkDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Delete {selected.size}
                        </button>
                      </div>
                    )}
                  </div>

                  {prospects.length === 0 && (
                    <div className="card-glass border border-white/5 rounded-2xl p-12 text-center">
                      <Search className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No prospects yet. Search Apollo or upload a CSV export.</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {prospects.map(p => (
                      <div key={p.id} className="card-glass border border-white/8 rounded-2xl overflow-hidden">
                        <div className="p-3 flex items-start gap-3">
                          <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)}
                        className="w-3.5 h-3.5 mt-1 cursor-pointer accent-orange-500 flex-shrink-0" />
                      <ScoreCircle score={p.lead_score} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                              <p className="text-xs font-bold text-white truncate">{p.company_name || "—"}</p>
                              <PriorityBadge priority={p.priority} />
                              <StatusBadge status={p.status} />
                            </div>
                            <p className="text-[11px] text-gray-400">{p.contact_name} · {p.contact_title}</p>
                            <p className="text-[10px] text-gray-500">{p.contact_email || "No email"} · {p.city}, {p.state}</p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                            {/* Add to Newsletter */}
                            {p.status === "new" && p.contact_email && (
                              <button onClick={() => addToNewsletter(p.id)} disabled={actioning === p.id}
                                title="Add to Newsletter"
                                className="flex items-center gap-1 px-2 py-1 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/20 rounded-lg text-[10px] text-blue-300 font-semibold transition-all">
                                <Mail className="w-3 h-3" /> Newsletter
                              </button>
                            )}

                            {/* LinkedIn button */}
                            <a
                              href={p.contact_linkedin || `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent((p.contact_name || '') + ' ' + (p.company_name || ''))}`}
                              target="_blank" rel="noreferrer"
                              title="Find on LinkedIn"
                              className="flex items-center gap-1 px-2 py-1 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/20 rounded-lg text-[10px] text-blue-300 font-semibold transition-all">
                              <Linkedin className="w-3 h-3" /> LinkedIn
                            </a>

                            {/* Reveal Email */}
                            {!p.contact_email && (
                              <button onClick={() => revealEmail(p.id)} disabled={revealing === p.id}
                                title="Reveal email from Apollo (1 credit)"
                                className="flex items-center gap-1 px-2 py-1 bg-green-500/15 hover:bg-green-500/25 border border-green-500/20 rounded-lg text-[10px] text-green-300 font-semibold transition-all disabled:opacity-50">
                                {revealing === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                                {revealing === p.id ? "..." : "Get Email"}
                              </button>
                            )}

                            {/* Request Demo */}}
                            {!["demo_requested","qualified","opportunity","customer"].includes(p.status) && (
                              <button onClick={() => requestDemo(p.id)} disabled={actioning === p.id}
                                title="Request Demo"
                                className="flex items-center gap-1 px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/20 rounded-lg text-[10px] text-amber-300 font-semibold transition-all">
                                <Calendar className="w-3 h-3" /> Demo
                              </button>
                            )}

                            {/* AI Enrich */}
                            {!p.enriched_at && (
                              <button onClick={() => enrich(p.id)} disabled={enriching === p.id}
                                title="AI Enrich"
                                className="p-1.5 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/20 rounded-lg transition-all">
                                {enriching === p.id ? <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-purple-400" />}
                              </button>
                            )}

                            {/* Status */}
                            <select value={p.status} onChange={e => updateStatus(p.id, e.target.value)}
                              className="bg-white/5 border border-white/10 rounded-lg px-1.5 py-1 text-[9px] text-gray-300 focus:outline-none">
                              {PIPELINE_STATUSES.map(s => <option key={s} value={s} className="bg-gray-900">{s.replace(/_/g," ")}</option>)}
                            </select>

                            {/* Expand */}
                            <button onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                              className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all">
                              {expanded === p.id ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                            </button>

                            {/* Delete */}
                            <button onClick={() => deleteProspect(p.id)}
                              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all">
                              <Trash2 className="w-3 h-3 text-red-400" />
                            </button>
                          </div>
                        </div>

                        {/* Expanded AI */}
                        {expanded === p.id && (
                          <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-3 bg-white/1">
                            {p.enriched_at ? (
                              <>
                                <div>
                                  <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Energy Exposure</p>
                                  <p className="text-xs text-gray-300 leading-relaxed">{p.energy_exposure}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Pain Points</p>
                                  <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">{p.pain_points}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Suggested Outreach</p>
                                  <p className="text-xs text-gray-300 leading-relaxed italic">{p.sales_message}</p>
                                </div>
                              </>
                            ) : (
                              <p className="text-xs text-gray-400">Click ⚡ to generate AI enrichment.</p>
                            )}
                            <div className="flex gap-3">
                              {p.contact_linkedin && <a href={p.contact_linkedin} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300">LinkedIn →</a>}
                              {p.website && <a href={p.website.startsWith("http") ? p.website : `https://${p.website}`} target="_blank" rel="noreferrer" className="text-xs text-gray-400 hover:text-gray-300">Website →</a>}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* AUDIENCES TAB */}
              {tab === "audiences" && (
                <div className="space-y-3">
                  {/* Create audience */}
                  <div className="card-glass border border-white/8 rounded-2xl p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Create Audience</p>
                    <div className="flex gap-2 mb-2">
                      <input value={newAudName} onChange={e => setNewAudName(e.target.value)}
                        placeholder="Audience name (e.g. Houston Energy Managers)"
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none" />
                      <button onClick={createAudience}
                        className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-xl text-xs font-bold text-white transition-all">
                        <Plus className="w-3.5 h-3.5" /> Create
                      </button>
                    </div>
                    <input value={newAudDesc} onChange={e => setNewAudDesc(e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none" />
                    <p className="text-[10px] text-gray-600 mt-2">
                      Audiences capture your current filter selection. Use them to segment newsletter sends.
                    </p>
                  </div>

                  {/* Audience list */}
                  {audiences.length === 0 && (
                    <div className="card-glass border border-white/5 rounded-2xl p-8 text-center">
               