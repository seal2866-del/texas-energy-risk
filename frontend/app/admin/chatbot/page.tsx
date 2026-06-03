"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import { supabase } from "@/lib/supabase";
import { MessageCircle, HelpCircle, Users, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UnansweredQ { id: string; question: string; created_at: string; resolved: boolean; }
interface Lead { id: string; email: string; name: string; company: string; demo_requested: boolean; created_at: string; contacted: boolean; }

export default function ChatbotAdmin() {
  const router = useRouter();
  const [tab, setTab] = useState<"unanswered" | "leads">("unanswered");
  const [unanswered, setUnanswered] = useState<UnansweredQ[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace("/login"); return; }
      loadData();
    });
  }, [router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const sb = supabase;
      const [uq, ld] = await Promise.all([
        sb.from("chatbot_unanswered_questions").select("*").order("created_at", { ascending: false }).limit(100),
        sb.from("chatbot_leads").select("*").order("created_at", { ascending: false }).limit(100),
      ]);
      setUnanswered(uq.data || []);
      setLeads(ld.data || []);
    } catch {}
    setLoading(false);
  };

  const markResolved = async (id: string) => {
    await supabase.from("chatbot_unanswered_questions").update({ resolved: true }).eq("id", id);
    setUnanswered(prev => prev.map(q => q.id === id ? { ...q, resolved: true } : q));
  };

  const markContacted = async (id: string) => {
    await supabase.from("chatbot_leads").update({ contacted: true }).eq("id", id);
    setLeads(prev => prev.map(l => l.id === id ? { ...l, contacted: true } : l));
  };

  const unresolved = unanswered.filter(q => !q.resolved);
  const unreachedLeads = leads.filter(l => !l.contacted);

  return (
    <div className="min-h-screen bg-[#060c1a]">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle className="w-5 h-5 text-orange-400" />
              <h1 className="text-2xl font-black text-white">AI Assistant Admin</h1>
            </div>
            <p className="text-sm text-gray-500">Unanswered questions, leads, and feedback</p>
          </div>
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 transition-all disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Unanswered", value: unresolved.length, icon: HelpCircle, color: "text-amber-400" },
            { label: "Total Leads", value: leads.length, icon: Users, color: "text-green-400" },
            { label: "Demo Requests", value: leads.filter(l => l.demo_requested).length, icon: MessageCircle, color: "text-orange-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="p-4 rounded-2xl bg-white/3 border border-white/8 text-center">
              <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
              <p className="text-2xl font-black text-white">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white/3 rounded-xl p-1 border border-white/5 w-fit">
          {(["unanswered", "leads"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${tab === t ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}>
              {t === "unanswered" ? `Unanswered (${unresolved.length})` : `Leads (${leads.length})`}
            </button>
          ))}
        </div>

        {/* Unanswered Questions */}
        {tab === "unanswered" && (
          <div className="space-y-3">
            {unanswered.length === 0 ? (
              <div className="text-center py-12 text-gray-600">No unanswered questions yet.</div>
            ) : unanswered.map(q => (
              <div key={q.id} className={`p-4 rounded-2xl border ${q.resolved ? "bg-white/1 border-white/5 opacity-50" : "bg-white/3 border-white/8"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium">{q.question}</p>
                    <p className="text-xs text-gray-600 mt-1">{new Date(q.created_at).toLocaleString("en-US", { timeZone: "America/Chicago" })} CDT</p>
                  </div>
                  {!q.resolved && (
                    <button onClick={() => markResolved(q.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold hover:bg-green-500/20 transition-all flex-shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />Mark Resolved
                    </button>
                  )}
                  {q.resolved && <span className="text-xs text-green-500 flex-shrink-0">Resolved</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Leads */}
        {tab === "leads" && (
          <div className="space-y-3">
            {leads.length === 0 ? (
              <div className="text-center py-12 text-gray-600">No leads captured yet.</div>
            ) : leads.map(l => (
              <div key={l.id} className={`p-4 rounded-2xl border ${l.contacted ? "bg-white/1 border-white/5 opacity-60" : "bg-white/3 border-white/8"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="text-sm font-bold text-white">{l.name || "—"}</p>
                      <span className="text-sm text-gray-400">{l.email}</span>
                      {l.demo_requested && (
                        <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded uppercase tracking-wider">Demo</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{l.company || "—"} · {new Date(l.created_at).toLocaleDateString("en-US")}</p>
                  </div>
                  {!l.contacted && (
                    <button onClick={() => markContacted(l.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition-all flex-shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />Mark Contacted
                    </button>
                  )}
                  {l.contacted && <span className="text-xs text-blue-400 flex-shrink-0">Contacted</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
