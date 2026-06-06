"use client";
import { MessageSquare, Send, X, Minimize2, Maximize2, Loader2, Bot } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "https://texas-energy-risk-production.up.railway.app";

interface Message { role: "user" | "assistant"; content: string; ts: number; }

interface Props {
  riskScore:    string;
  riskDirection: string;
  ercotPrice?:  number;
  temperature?: number;
  henryHub?:    number;
  demandPressure?: { level: string };
  supplyPressure?: { level: string };
  escalationProbability?: number;
}

const SUGGESTED = [
  "What is driving today's risk?",
  "What is the 72-hour outlook?",
  "How does weather affect ERCOT pricing?",
  "Should operations be concerned right now?",
  "What are today's escalation thresholds?",
];

function buildContext(props: Props): string {
  const { riskScore, riskDirection, ercotPrice, temperature, henryHub, demandPressure, supplyPressure, escalationProbability } = props;
  return JSON.stringify({
    risk_score:   riskScore,
    risk_direction: riskDirection,
    ercot_price:  ercotPrice,
    temperature,
    henry_hub:    henryHub,
    demand_pressure: demandPressure?.level,
    supply_pressure: supplyPressure?.level,
    escalation_probability: escalationProbability,
    timestamp:    new Date().toISOString(),
  });
}

export default function AIChatAssistant(props: Props) {
  const [open,     setOpen]     = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [token]    = useState(() => Math.random().toString(36).slice(2));
  const bottomRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: `Hello. I'm the Texas Grid Intel Energy Assistant. I can answer questions about current ERCOT conditions, weather demand risk, natural gas supply, and what today's data means for operations.\n\nCurrent risk level is **${props.riskScore.toUpperCase()}**${props.ercotPrice ? ` — ERCOT at $${props.ercotPrice.toFixed(2)}/MWh` : ""}. What would you like to know?`,
        ts: Date.now(),
      }]);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: msg, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const r = await fetch(`${API}/api/chatbot/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          session_token: token,
          history,
          page_context: buildContext(props),
        }),
      });

      if (r.ok) {
        const data = await r.json();
        const reply = data.response || data.message || "I'm unable to generate a response right now. Please try again.";
        setMessages(prev => [...prev, { role: "assistant", content: reply, ts: Date.now() }]);
      } else {
        // Fallback: rule-based response
        setMessages(prev => [...prev, {
          role: "assistant",
          content: generateFallback(msg, props),
          ts: Date.now(),
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: generateFallback(msg, props),
        ts: Date.now(),
      }]);
    }
    setLoading(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-orange-500 hover:bg-orange-600 rounded-full shadow-lg shadow-orange-500/30 flex items-center justify-center transition-all z-50">
        <MessageSquare className="w-6 h-6 text-white" />
      </button>
    );
  }

  const height = expanded ? "h-[600px]" : "h-[420px]";
  const width  = expanded ? "w-[480px]" : "w-[360px]";

  return (
    <div className={`fixed bottom-6 right-6 ${width} ${height} bg-[#0f172a] border border-white/12 rounded-2xl shadow-2xl flex flex-col z-50 transition-all`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
          <Bot className="w-4 h-4 text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white">Energy Intelligence Assistant</p>
          <p className="text-[10px] text-gray-500">Texas Grid Intel · Informational only</p>
        </div>
        <button onClick={() => setExpanded(e => !e)} className="p-1 text-gray-500 hover:text-gray-300 transition-colors">
          {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => setOpen(false)} className="p-1 text-gray-500 hover:text-gray-300 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
              m.role === "user"
                ? "bg-orange-500/20 border border-orange-500/20 text-gray-200"
                : "bg-white/5 border border-white/8 text-gray-300"
            }`}>
              <p className="text-xs leading-relaxed whitespace-pre-wrap">{m.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
              <p className="text-xs text-gray-400">Analyzing conditions...</p>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
          {SUGGESTED.slice(0, 3).map(q => (
            <button key={q} onClick={() => send(q)}
              className="text-[10px] text-gray-400 hover:text-orange-300 border border-white/8 hover:border-orange-500/30 rounded-lg px-2 py-1 transition-all">
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-white/8 flex-shrink-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Ask about ERCOT, weather, gas conditions..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/30"
        />
        <button onClick={() => send()} disabled={!input.trim() || loading}
          className="p-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 rounded-xl transition-all">
          <Send className="w-3.5 h-3.5 text-white" />
        </button>
      </div>
    </div>
  );
}

// Rule-based fallback when API is unavailable
function generateFallback(question: string, props: Props): string {
  const q = question.toLowerCase();
  const { riskScore, riskDirection, ercotPrice, temperature, henryHub, demandPressure, escalationProbability = 10 } = props;
  const price = ercotPrice ?? 0;
  const temp  = temperature ?? 0;
  const hh    = henryHub ?? 0;

  if (q.includes("risk") && (q.includes("driving") || q.includes("causing") || q.includes("why"))) {
    const drivers = [];
    if (demandPressure?.level !== "low") drivers.push(`weather-driven demand pressure (${temp > 0 ? temp.toFixed(0) + "°F" : "above normal"})`);
    if (price >= 30) drivers.push(`ERCOT pricing at $${price.toFixed(2)}/MWh`);
    if (hh >= 2.7)  drivers.push(`Henry Hub at $${hh.toFixed(2)}/MMBtu`);
    return drivers.length > 0
      ? `Current risk (${riskScore.toUpperCase()}) is primarily driven by ${drivers.join(" and ")}. ${riskDirection === "increasing" ? "The risk trend is rising." : "The trend is currently stable."}`
      : `Current risk level is ${riskScore.toUpperCase()}. All monitored signals are within normal ranges — no single dominant driver is active at this time.`;
  }

  if (q.includes("outlook") || q.includes("forecast") || q.includes("72") || q.includes("next")) {
    return `Based on current signal trajectory, risk is expected to ${riskDirection === "increasing" ? "remain elevated or increase" : riskDirection === "decreasing" ? "gradually improve" : "remain stable"} over the next 24-72 hours. Escalation probability is currently ${escalationProbability}%. The afternoon demand window (14:00-19:00 CDT) warrants monitoring.`;
  }

  if (q.includes("weather") && (q.includes("ercot") || q.includes("price"))) {
    return `Weather drives ERCOT prices through demand. As Texas temperatures rise above 90°F, cooling demand increases across residential and commercial buildings. Above 95°F, demand accelerates significantly, potentially pushing ERCOT prices higher. Currently, temperatures are ${temp > 0 ? temp.toFixed(0) + "°F" : "being monitored"}.`;
  }

  if (q.includes("concerned") || q.includes("worry") || q.includes("action")) {
    return riskScore === "high"
      ? `Yes — current conditions warrant elevated attention. Multiple signals are aligned at elevated levels. Review operational exposure and confirm contingency protocols.`
      : riskScore === "medium"
      ? `Moderate awareness is appropriate. Current conditions are elevated but not critical. Monitor ERCOT pricing during the afternoon peak window (14:00-19:00 CDT).`
      : `Under current conditions, standard monitoring is sufficient. No immediate operational changes are indicated. Continue normal operations and reassess during the afternoon peak window.`;
  }

  if (q.includes("threshold") || q.includes("escalation") || q.includes("trigger")) {
    return `Current escalation thresholds: ERCOT > $75/MWh (watch), ERCOT > $150/MWh (elevated), Temperature > 95°F (watch), Henry Hub > $3.00/MMBtu (watch). Current values: ERCOT $${price > 0 ? price.toFixed(2) : "N/A"}/MWh, Temperature ${temp > 0 ? temp.toFixed(0) + "°F" : "N/A"}, Henry Hub $${hh > 0 ? hh.toFixed(2) : "N/A"}/MMBtu.`;
  }

  return `Current Texas Grid Intel conditions: Risk Level ${riskScore.toUpperCase()}${price > 0 ? `, ERCOT $${price.toFixed(2)}/MWh` : ""}${temp > 0 ? `, Temperature ${temp.toFixed(0)}°F` : ""}${hh > 0 ? `, Henry Hub $${hh.toFixed(2)}/MMBtu` : ""}. Is there a specific aspect of current conditions you'd like me to explain?`;
}
