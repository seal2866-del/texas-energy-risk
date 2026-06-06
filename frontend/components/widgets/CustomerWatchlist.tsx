"use client";
import { Eye, Plus, X, Star, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useEffect } from "react";

interface WatchItem {
  id:       string;
  label:    string;
  type:     "hub" | "city" | "metric";
  current?: string;
  status?:  "normal" | "watch" | "elevated";
}

interface Watchlist {
  id:    string;
  name:  string;
  items: WatchItem[];
}

interface Props {
  ercotPrice?:   number;
  temperature?:  number;
  henryHub?:     number;
  riskScore:     string;
}

const PRESET_WATCHLISTS: Watchlist[] = [
  {
    id:    "midstream",
    name:  "Midstream Operations",
    items: [
      { id: "hb_houston",  label: "Houston Hub",    type: "hub",    current: "",   status: "normal" },
      { id: "waha",        label: "Waha Gas",       type: "metric", current: "",   status: "normal" },
      { id: "henry_hub",   label: "Henry Hub",      type: "metric", current: "",   status: "normal" },
      { id: "permian_wx",  label: "Permian Weather",type: "city",   current: "",   status: "normal" },
    ],
  },
  {
    id:    "refinery",
    name:  "Refinery Operations",
    items: [
      { id: "hb_houston2", label: "Houston Hub",       type: "hub",    current: "",  status: "normal" },
      { id: "corpus",      label: "Corpus Christi",    type: "city",   current: "",  status: "normal" },
      { id: "gas_storage", label: "Gas Storage",       type: "metric", current: "",  status: "normal" },
      { id: "heat_risk",   label: "Heat Risk",         type: "metric", current: "",  status: "normal" },
    ],
  },
];

function statusColor(s?: string): string {
  if (s === "elevated") return "text-red-400";
  if (s === "watch")    return "text-amber-400";
  return "text-green-400";
}

function statusLabel(s?: string): string {
  if (s === "elevated") return "Elevated";
  if (s === "watch")    return "Watch";
  return "Normal";
}

export default function CustomerWatchlist({ ercotPrice, temperature, henryHub, riskScore }: Props) {
  const [watchlists,    setWatchlists]    = useState<Watchlist[]>([]);
  const [activeList,    setActiveList]    = useState<string | null>(null);
  const [addingItem,    setAddingItem]    = useState(false);
  const [newItemLabel,  setNewItemLabel]  = useState("");
  const [newItemType,   setNewItemType]   = useState<WatchItem["type"]>("hub");
  const [showPresets,   setShowPresets]   = useState(false);
  const [newListName,   setNewListName]   = useState("");

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tgi_watchlists");
      if (saved) setWatchlists(JSON.parse(saved));
    } catch {}
  }, []);

  const save = (lists: Watchlist[]) => {
    setWatchlists(lists);
    try { localStorage.setItem("tgi_watchlists", JSON.stringify(lists)); } catch {}
  };

  const createList = () => {
    if (!newListName.trim()) return;
    const newList: Watchlist = { id: Date.now().toString(), name: newListName.trim(), items: [] };
    save([...watchlists, newList]);
    setActiveList(newList.id);
    setNewListName("");
  };

  const addPreset = (preset: Watchlist) => {
    const existing = watchlists.find(w => w.name === preset.name);
    if (!existing) save([...watchlists, { ...preset, id: Date.now().toString() }]);
    setShowPresets(false);
  };

  const removeList = (id: string) => {
    save(watchlists.filter(w => w.id !== id));
    if (activeList === id) setActiveList(null);
  };

  const addItem = (listId: string) => {
    if (!newItemLabel.trim()) return;
    const item: WatchItem = { id: Date.now().toString(), label: newItemLabel.trim(), type: newItemType, status: "normal" };
    save(watchlists.map(w => w.id === listId ? { ...w, items: [...w.items, item] } : w));
    setNewItemLabel(""); setAddingItem(false);
  };

  const removeItem = (listId: string, itemId: string) => {
    save(watchlists.map(w => w.id === listId ? { ...w, items: w.items.filter(i => i.id !== itemId) } : w));
  };

  // Inject live values
  function liveValue(item: WatchItem): { current: string; status: WatchItem["status"] } {
    if (item.label.toLowerCase().includes("houston hub") || item.label.toLowerCase().includes("ercot")) {
      const p = ercotPrice ?? 0;
      return { current: p > 0 ? `$${p.toFixed(2)}/MWh` : "N/A", status: p >= 75 ? "elevated" : p >= 60 ? "watch" : "normal" };
    }
    if (item.label.toLowerCase().includes("henry hub")) {
      const h = henryHub ?? 0;
      return { current: h > 0 ? `$${h.toFixed(2)}/MMBtu` : "N/A", status: h >= 3.0 ? "elevated" : h >= 2.7 ? "watch" : "normal" };
    }
    if (item.label.toLowerCase().includes("heat") || item.label.toLowerCase().includes("temp") || item.label.toLowerCase().includes("weather")) {
      const t = temperature ?? 0;
      return { current: t > 0 ? `${t.toFixed(0)}°F` : "N/A", status: t >= 95 ? "elevated" : t >= 88 ? "watch" : "normal" };
    }
    return { current: "Monitoring", status: riskScore === "high" ? "elevated" : riskScore === "medium" ? "watch" : "normal" };
  }

  const active = watchlists.find(w => w.id === activeList);

  return (
    <div className="card-glass border border-white/8 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Eye className="w-4 h-4 text-gray-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Custom Watchlists</p>
      </div>

      {/* List selector */}
      <div className="flex flex-wrap gap-2 mb-3">
        {watchlists.map(w => (
          <button key={w.id} onClick={() => setActiveList(w.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
              activeList === w.id ? "bg-orange-500/15 border-orange-500/30 text-orange-300" : "bg-white/3 border-white/8 text-gray-400 hover:text-gray-200"
            }`}>
            <Star className="w-3 h-3" />{w.name}
            <span onClick={e => { e.stopPropagation(); removeList(w.id); }}
              className="ml-1 text-gray-600 hover:text-red-400"><X className="w-3 h-3" /></span>
          </button>
        ))}
      </div>

      {/* Create / preset */}
      <div className="flex gap-2 mb-4">
        <input value={newListName} onChange={e => setNewListName(e.target.value)}
          placeholder="New watchlist name..."
          onKeyDown={e => e.key === "Enter" && createList()}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none" />
        <button onClick={createList} className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 rounded-lg text-xs font-bold text-white transition-all">
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setShowPresets(s => !s)}
          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 transition-all flex items-center gap-1">
          Presets {showPresets ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {showPresets && (
        <div className="mb-3 space-y-1">
          {PRESET_WATCHLISTS.map(p => (
            <button key={p.id} onClick={() => addPreset(p)}
              className="w-full text-left px-3 py-2 bg-white/3 border border-white/5 rounded-lg text-xs text-gray-300 hover:bg-white/6 transition-all">
              + {p.name} ({p.items.length} items)
            </button>
          ))}
        </div>
      )}

      {/* Active watchlist items */}
      {active ? (
        <div className="space-y-1.5">
          {active.items.map(item => {
            const { current, status } = liveValue(item);
            return (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${status === "elevated" ? "bg-red-400" : status === "watch" ? "bg-amber-400" : "bg-green-400"}`} />
                  <span className="text-xs text-gray-300">{item.label}</span>
                  <span className="text-[9px] text-gray-600 uppercase">{item.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-200">{current}</span>
                  <span className={`text-[9px] font-bold uppercase ${statusColor(status)}`}>{statusLabel(status)}</span>
                  <button onClick={() => removeItem(active.id, item.id)} className="text-gray-700 hover:text-red-400 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {addingItem ? (
            <div className="flex gap-2 mt-2">
              <input value={newItemLabel} onChange={e => setNewItemLabel(e.target.value)}
                placeholder="Metric name..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none" />
              <select value={newItemType} onChange={e => setNewItemType(e.target.value as WatchItem["type"])}
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none">
                <option value="hub" className="bg-gray-900">Hub</option>
                <option value="city" className="bg-gray-900">City</option>
                <option value="metric" className="bg-gray-900">Metric</option>
              </select>
              <button onClick={() => addItem(active.id)} className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 rounded-lg text-xs font-bold text-white">Add</button>
              <button onClick={() => setAddingItem(false)} className="px-2 py-1.5 bg-white/5 rounded-lg text-xs text-gray-400">✕</button>
            </div>
          ) : (
            <button onClick={() => setAddingItem(true)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors mt-2">
              <Plus className="w-3 h-3" /> Add item
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-600 text-center py-4">Select or create a watchlist above.</p>
      )}
    </div>
  );
}
