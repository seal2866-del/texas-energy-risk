"use client";
import { useEffect, useState } from "react";
import { UserPlus, Download, Search } from "lucide-react";

const API  = process.env.NEXT_PUBLIC_API_URL || "https://texas-energy-risk-production.up.railway.app";
const AUTH = process.env.NEXT_PUBLIC_NEWSLETTER_ADMIN_SECRET || "";

interface Subscriber {
  id:           string;
  email:        string;
  first_name:   string | null;
  last_name:    string | null;
  company:      string | null;
  title:        string | null;
  city:         string | null;
  industry:     string | null;
  segment:      string | null;
  source:       string | null;
  status:       string;
  subscribed_at: string;
  last_sent_at: string | null;
}

const SEGMENTS = ["Midland Oil & Gas", "Houston Energy", "Industrial Buyer", "Data Center", "Procurement", "Executive", "Other"];

export default function AdminSubscribers() {
  const [subs,    setSubs]    = useState<Subscriber[]>([]);
  const [search,  setSearch]  = useState("");
  const [status,  setStatus]  = useState("active");
  const [newEmail, setNewEmail] = useState("");
  const [newCo,    setNewCo]   = useState("");
  const [newSeg,   setNewSeg]  = useState("");
  const [msg,     setMsg]     = useState("");

  const headers = { Authorization: `Bearer ${AUTH}`, "Content-Type": "application/json" };

  const fetchSubs = async () => {
    const params = new URLSearchParams({ limit: "200" });
    if (status) params.set("status", status);
    const r = await fetch(`${API}/api/newsletter/admin/subscribers?${params}`, { headers });
    if (r.ok) setSubs(await r.json());
  };

  useEffect(() => { fetchSubs(); }, [status]);

  const addSubscriber = async () => {
    if (!newEmail) return;
    const r = await fetch(`${API}/api/newsletter/admin/subscribers`, {
      method: "POST", headers,
      body: JSON.stringify({ email: newEmail, company: newCo, segment: newSeg, source: "manual" }),
    });
    if (r.ok) { setMsg("Subscriber added."); setNewEmail(""); setNewCo(""); await fetchSubs(); }
    else setMsg("Failed to add subscriber.");
  };

  const updateStatus = async (id: string, newStatus: string) => {
    await fetch(`${API}/api/newsletter/admin/subscribers/${id}`, {
      method: "PATCH", headers,
      body: JSON.stringify({ status: newStatus }),
    });
    await fetchSubs();
  };

  const exportCSV = () => {
    const rows = [
      ["email", "company", "title", "city", "industry", "segment", "status", "subscribed_at"],
      ...filtered.map(s => [s.email, s.company || "", s.title || "", s.city || "", s.industry || "", s.segment || "", s.status, s.subscribed_at]),
    ];
    const csv  = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "subscribers.csv"; a.click();
  };

  const filtered = subs.filter(s =>
    !search ||
    s.email.includes(search) ||
    (s.company || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.city || "").toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (s: string) => ({
    active:      "text-green-400",
    unsubscribed:"text-gray-500",
    bounced:     "text-red-400",
    complained:  "text-red-500",
  }[s] || "text-gray-400");

  return (
    <div className="min-h-screen bg-[#080d1a] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black">Subscribers</h1>
            <p className="text-sm text-gray-400">Texas Energy Risk Brief — {filtered.length} shown</p>
          </div>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold transition-all hover:bg-white/10">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>

        {msg && <div className="mb-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-300">{msg}</div>}

        {/* Add subscriber */}
        <div className="card-glass border border-white/8 rounded-2xl p-4 mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Add Subscriber</p>
          <div className="flex flex-wrap gap-2">
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
              placeholder="Email *" className="flex-1 min-w-48 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none" />
            <input type="text" value={newCo} onChange={e => setNewCo(e.target.value)}
              placeholder="Company" className="flex-1 min-w-36 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none" />
            <select value={newSeg} onChange={e => setNewSeg(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none">
              <option value="" className="bg-gray-900">Segment</option>
              {SEGMENTS.map(s => <option key={s} value={s} className="bg-gray-900">{s}</option>)}
            </select>
            <button onClick={addSubscriber} className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-xs text-white font-bold transition-all">
              <UserPlus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search email, company, city..."
              className="w-full pl-9 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none" />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none">
            <option value="" className="bg-gray-900">All statuses</option>
            <option value="active" className="bg-gray-900">Active</option>
            <option value="unsubscribed" className="bg-gray-900">Unsubscribed</option>
            <option value="bounced" className="bg-gray-900">Bounced</option>
          </select>
        </div>

        {/* Table */}
        <div className="card-glass border border-white/8 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {["Email", "Company", "City", "Segment", "Status", "Subscribed", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] text-gray-500 uppercase tracking-wide font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id} className={`border-b border-white/3 ${i % 2 === 0 ? "" : "bg-white/1"}`}>
                  <td className="px-4 py-3 text-xs text-gray-300">{s.email}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{s.company || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{s.city || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{s.segment || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold uppercase ${statusColor(s.status)}`}>{s.status}</span>
                  </td>
                  <td className="px-4 py-3 text-[10px] text-gray-500">{new Date(s.subscribed_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {s.status === "active" && (
                      <button onClick={() => updateStatus(s.id, "unsubscribed")}
                        className="text-[10px] text-red-400 hover:text-red-300 transition-colors">
                        Unsub
                      </button>
                    )}
                    {s.status === "unsubscribed" && (
                      <button onClick={() => updateStatus(s.id, "active")}
                        className="text-[10px] text-green-400 hover:text-green-300 transition-colors">
                        Re-activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-xs text-gray-600 py-12">No subscribers found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
