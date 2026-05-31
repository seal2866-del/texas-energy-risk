"use client";
import { useState, useEffect } from "react";
import { Search, Download, Zap, Star, RefreshCw, Loader2, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import Navbar from "@/components/ui/Navbar";

const API = process.env.NEXT_PUBLIC_API_URL || "https://texas-energy-risk-production.up.railway.app";

const INDUSTRIES = [
  "Oil & Gas", "Manufacturing", "Chemical", "Petrochemical",
  "Data Centers", "Mining", "Utilities", "Midstream", "Refining",
  "Industrial", "Construction", "Agriculture",
];

const TITLES = [
  "Operations Manager", "Plant Manager", "Energy Manager",
  "Procurement Manager", "Facilities Manager", "VP Operations",
  "Director of Operations", "COO", "Energy Director", "CFO",
];

const TX_CITIES = [
  "Houston, TX", "Dallas, TX", "Austin, TX", "San Antonio, TX",
  "Midland, TX", "Odessa, TX", "Corpus Christi, TX", "Lubbock, TX",
  "Beaumont, TX", "Port Arthur, TX",
];

interface Prospect {
  id:               string;
  company_name:     string;
  website:          string;
  industry:         string;
  employee_count:   number;
  city:             string;
  state:            string;
  contact_name:     string;
  contact_title:    string;
  contact_email:    string;
  contact_linkedin: string;
  lead_score:       number;
  priority:         string;
  status:           string;
  energy_exposure:  string;
  pain_points:      string;
  sales_message:    string;
  enriched_at:      string;
}

interface DashboardStats {
  total_prospects:  number;
  high_priority:    number;
  avg_lead_score:   number;
  by_region:        Record<string, number>;
  by_priority:      Record<string, number>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles = {
    high:   "bg-red-500/15 text-red-400 border-red-500/20",
    medium: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    low:    "bg-gray-500/15 text-gray-400 border-gray-500/20",
  }[priority] || "bg-gray-500/15 text-gray-400 border-gray-500/20";
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${styles}`}>
      {priority}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 65 ? "text-red-400" : score >= 40 ? "text-amber-400" : "text-green-400";
  return <span className={`text-sm font-black ${color}`}>{score}</span>;
}

export default function ProspectingPage() {
  const [prospects,  setProspects]  = useState<Prospect[]>([]);
  const [stats,      setStats]      = useState<DashboardStats | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [enriching,  setEnriching]  = useState<string | null>(null);
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [msg,        setMsg]        = useState("");

  // Filters
  const [locations,    setLocations]    = useState<string[]>(["Houston, TX"]);
  const [industries,   setIndustries]   = useState<string[]>([]);
  const [titles,       setTitles]       = useState<string[]>([]);
  const [empMin,       setEmpMin]       = useState("");
  const [empMax,       setEmpMax]       = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus,   setFilterStatus]   = useState("");

  const fetchProspects = async () => {
    const params = new URLSearchParams({ limit: "200" });
    if (filterPriority) params.set("priority", filterPriority);
    if (filterStatus)   params.set("status",   filterStatus);
    const r = await fetch(`${API}/api/prospecting/prospects?${params}`);
    if (r.ok) setProspects(await r.json());
  };

  const fetchStats = async () => {
    const r = await fetch(`${API}/api/prospecting/dashboard`);
    if (r.ok) setStats(await r.json());
  };

  useEffect(() => {
    fetchProspects();
    fetchStats();
  }, [filterPriority, filterStatus]);

  const search = async () => {
    setLoading(true); setMsg("");
    try {
      const r = await fetch(`${API}/api/prospecting/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locations,
          industries,
          titles,
          employee_min: empMin ? parseInt(empMin) : null,
          employee_max: empMax ? parseInt(empMax) : null,
          per_page: 25,
        }),
      });
      const d = await r.json();
      if (r.ok) {
        setMsg(`Found ${d.count} new prospects (${d.duplicates || 0} duplicates skipped)`);
        await fetchProspects();
        await fetchStats();
      } else {
        setMsg(`Error: ${d.detail}`);
      }
    } catch (e: any) {
      setMsg(`Network error: ${e.message}`);
    }
    setLoading(false);
  };

  const enrich = async (id: string) => {
    setEnriching(id);
    const r = await fetch(`${API}/api/prospecting/enrich/${id}`, { method: "POST" });
    if (r.ok) await fetchProspects();
    setEnriching(null);
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`${API}/api/prospecting/prospects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchProspects();
  };

  const deleteProspect = async (id: string) => {
    await fetch(`${API}/api/prospecting/prospects/${id}`, { method: "DELETE" });
    setProspects(p => p.filter(x => x.id !== id));
    await fetchStats();
  };

  const exportCSV = () => {
    const params = new URLSearchParams();
    if (filterPriority) params.set("priority", filterPriority);
    window.open(`${API}/api/prospecting/export?${params}`, "_blank");
  };

  const toggleLocation = (loc: string) =>
    setLocations(l => l.includes(loc) ? l.filter(x => x !== loc) : [...l, loc]);
  const toggleIndustry = (ind: string) =>
    setIndustries(l => l.includes(ind) ? l.filter(x => x !== ind) : [...l, ind]);
  const toggleTitle = (t: string) =>
    setTitles(l => l.includes(t) ? l.filter(x => x !== t) : [...l, t]);

  return (
    <>
      <Navbar />
      <main className="pt-24 min-h-screen bg-[#080d1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black text-white">Prospecting</h1>
              <p className="text-sm text-gray-400 mt-0.5">Apollo.io lead search with AI enrichment and scoring</p>
            </div>
            <button onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold text-gray-300 hover:bg-white/10 transition-all">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>

          {/* Dashboard Stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: "Total Prospects",     value: stats.total_prospects,  color: "text-white" },
                { label: "High Priority",        value: stats.high_priority,    color: "text-red-400" },
                { label: "Avg Lead Score",       value: `${stats.avg_lead_score}/100`, color: "text-amber-400" },
                { label: "Regions",              value: Object.keys(stats.by_region).length, color: "text-blue-400" },
              ].map(s => (
                <div key={s.label} className="card-glass border border-white/8 rounded-xl p-4 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{s.label}</p>
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

            {/* Search Panel */}
            <div className="lg:col-span-1 space-y-4">
              <div className="card-glass border border-white/8 rounded-2xl p-4">
                <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Search Filters</p>

                {/* Locations */}
                <div className="mb-4">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Location</p>
                  <div className="space-y-1">
                    {TX_CITIES.map(loc => (
                      <label key={loc} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={locations.includes(loc)}
                          onChange={() => toggleLocation(loc)}
                          className="w-3 h-3 rounded" />
                        <span className="text-xs text-gray-300">{loc}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Industries */}
                <div className="mb-4">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Industry</p>
                  <div className="space-y-1">
                    {INDUSTRIES.map(ind => (
                      <label key={ind} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={industries.includes(ind)}
                          onChange={() => toggleIndustry(ind)}
                          className="w-3 h-3 rounded" />
                        <span className="text-xs text-gray-300">{ind}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Employee count */}
                <div className="mb-4">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Employee Count</p>
                  <div className="flex gap-2">
                    <input type="number" placeholder="Min" value={empMin} onChange={e => setEmpMin(e.target.value)}
                      className="w-1/2 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white" />
                    <input type="number" placeholder="Max" value={empMax} onChange={e => setEmpMax(e.target.value)}
                      className="w-1/2 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white" />
                  </div>
                </div>

                {/* Titles */}
                <div className="mb-4">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Job Titles</p>
                  <div className="space-y-1">
                    {TITLES.map(t => (
                      <label key={t} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={titles.includes(t)}
                          onChange={() => toggleTitle(t)}
                          className="w-3 h-3 rounded" />
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

                {msg && <p className="text-xs text-blue-300 mt-2 text-center">{msg}</p>}
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-3 space-y-3">

              {/* Filter bar */}
              <div className="flex gap-2 flex-wrap">
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none">
                  <option value="">All priorities</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none">
                  <option value="">All statuses</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="disqualified">Disqualified</option>
                </select>
                <p className="text-xs text-gray-500 self-center ml-auto">{prospects.length} prospects</p>
              </div>

              {prospects.length === 0 && (
                <div className="card-glass border border-white/5 rounded-2xl p-12 text-center">
                  <Search className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No prospects yet. Use the search panel to find leads.</p>
                </div>
              )}

              {prospects.map(p => (
                <div key={p.id} className="card-glass border border-white/8 rounded-2xl overflow-hidden">
                  {/* Main row */}
                  <div className="p-4 flex items-start gap-3">
                    {/* Score */}
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center flex-shrink-0">
                      <ScoreBadge score={p.lead_score} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1">
                        <p className="text-sm font-bold text-white truncate">{p.company_name || "—"}</p>
                        <PriorityBadge priority={p.priority} />
                      </div>
                      <p className="text-xs text-gray-400 mb-0.5">{p.contact_name} · {p.contact_title}</p>
                      <p className="text-xs text-gray-500">{p.contact_email || "Email not available"} · {p.city}, {p.state}</p>
                      {p.industry && <p className="text-[10px] text-gray-600 mt-0.5">{p.industry} · {p.employee_count ? `${p.employee_count.toLocaleString()} employees` : ""}</p>}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Status */}
                      <select value={p.status} onChange={e => updateStatus(p.id, e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-gray-300 focus:outline-none">
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="qualified">Qualified</option>
                        <option value="disqualified">Disqualified</option>
                      </select>

                      {/* Enrich */}
                      {!p.enriched_at && (
                        <button onClick={() => enrich(p.id)} disabled={enriching === p.id}
                          title="AI Enrich"
                          className="p-1.5 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/20 rounded-lg transition-all">
                          {enriching === p.id
                            ? <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                            : <Zap className="w-3.5 h-3.5 text-purple-400" />}
                        </button>
                      )}

                      {/* Expand */}
                      <button onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                        className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all">
                        {expanded === p.id
                          ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                          : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                      </button>

                      {/* Delete */}
                      <button onClick={() => deleteProspect(p.id)}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded AI enrichment */}
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
                        <div className="flex items-center gap-2">
                          <Zap className="w-3.5 h-3.5 text-purple-400" />
                          <p className="text-xs text-gray-400">Click the ⚡ button to generate AI enrichment for this prospect.</p>
                        </div>
                      )}
                      {p.contact_linkedin && (
                        <a href={p.contact_linkedin} target="_blank" rel="noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300">
                          LinkedIn Profile →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
