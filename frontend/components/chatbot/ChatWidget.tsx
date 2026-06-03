"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, ThumbsUp, ThumbsDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const COMPLIANCE = "TX Energy Risk provides operational intelligence and situational awareness only. Not investment, trading, or financial advice.";

const STARTERS = [
  "What does TX Energy Risk do?",
  "What does the risk score mean?",
  "How do I use the Daily Workflow?",
  "What does escalation probability mean?",
  "What alerts can I configure?",
  "What is included in the Professional plan?",
  "Can TX Energy Risk monitor multiple locations?",
  "Is this trading or procurement advice?",
];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  message_id?: string;
  timestamp: Date;
}

function genToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function LeadForm({ onSubmit, onSkip }: { onSubmit: (data: any) => void; onSkip: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [demo, setDemo] = useState(false);

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-gray-400 leading-relaxed">
        Leave your details and we'll follow up — or skip to keep chatting.
      </p>
      <input value={name} onChange={e => setName(e.target.value)}
        placeholder="Your name" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50" />
      <input value={email} onChange={e => setEmail(e.target.value)}
        type="email" placeholder="Work email *" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50" />
      <input value={company} onChange={e => setCompany(e.target.value)}
        placeholder="Company" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50" />
      <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
        <input type="checkbox" checked={demo} onChange={e => setDemo(e.target.checked)} className="accent-orange-500" />
        Request a demo call
      </label>
      <div className="flex gap-2">
        <button onClick={() => email && onSubmit({ email, name, company, demo_requested: demo })}
          disabled={!email}
          className="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-semibold transition-all">
          Submit
        </button>
        <button onClick={onSkip} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-sm transition-all">
          Skip
        </button>
      </div>
    </div>
  );
}

export default function ChatWidget() {
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [sessionToken]            = useState(genToken);
  const [showLead, setShowLead]   = useState(false);
  const [leadDone, setLeadDone]   = useState(false);
  const [msgCount, setMsgCount]   = useState(0);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: "Hi! I'm the TX Energy Risk AI Assistant. I can help you understand the platform, explain features, or answer questions about Texas energy risk monitoring.\n\nWhat would you like to know?",
        timestamp: new Date(),
      }]);
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const history = messages.map(m => ({ role: m.role, content: m.content }));

    try {
      const r = await fetch(`${BASE}/api/chatbot/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_token: sessionToken, history, page_context: window.location.pathname }),
      });
      const data = await r.json();
      const responseText = data.response || (r.ok ? "I received your message but couldn't generate a response. Please try again." : "The AI assistant is warming up. Please try again in a moment.");
      setMessages(prev => [...prev, {
        id: Date.now().toString(), role: "assistant",
        content: responseText, message_id: data.message_id, timestamp: new Date(),
      }]);
      const newCount = msgCount + 1;
      setMsgCount(newCount);
      if (newCount >= 3 && !leadDone) setShowLead(true);
      if (data.is_demo_request && !leadDone) setShowLead(true);
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString(), role: "assistant",
        content: "I'm having trouble connecting right now. Please try again or email support@texasgridintel.com.",
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, sessionToken, msgCount, leadDone]);

  const submitFeedback = async (messageId: string, helpful: boolean) => {
    try {
      await fetch(`${BASE}/api/chatbot/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, session_token: sessionToken, helpful }),
      });
    } catch {}
  };

  const submitLead = async (data: any) => {
    try {
      await fetch(`${BASE}/api/chatbot/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_token: sessionToken, ...data }),
      });
      setLeadDone(true);
      setShowLead(false);
      setMessages(prev => [...prev, {
        id: Date.now().toString(), role: "assistant",
        content: data.demo_requested
          ? "Thanks! We'll be in touch to schedule your demo. In the meantime, feel free to keep asking questions."
          : "Thanks for your details! Our team will follow up soon. Keep asking questions if you have them.",
        timestamp: new Date(),
      }]);
    } catch {}
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-600 shadow-2xl shadow-orange-500/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        aria-label="Open AI Assistant"
      >
        {open ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
        {!open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-[#060c1a] animate-pulse" />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-h-[600px] flex flex-col rounded-2xl bg-[#0d1428] border border-white/10 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-[#0a1220] border-b border-white/8 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">TX Energy Risk Assistant</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] text-gray-500">Operational intelligence only · Not financial advice</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
            {messages.map(msg => (
              <div key={msg.id} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] text-orange-400 font-bold">AI</span>
                  </div>
                )}
                <div className={cn(
                  "max-w-[280px] px-3 py-2 rounded-2xl text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-orange-500 text-white rounded-br-sm"
                    : "bg-white/5 border border-white/8 text-gray-200 rounded-bl-sm",
                )}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.role === "assistant" && msg.message_id && (
                    <div className="flex gap-2 mt-2 pt-1.5 border-t border-white/5">
                      <button onClick={() => submitFeedback(msg.message_id!, true)} className="text-gray-600 hover:text-green-400 transition-colors">
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button onClick={() => submitFeedback(msg.message_id!, false)} className="text-gray-600 hover:text-red-400 transition-colors">
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] text-orange-400 font-bold">AI</span>
                </div>
                <div className="bg-white/5 border border-white/8 rounded-2xl rounded-bl-sm px-3 py-2">
                  <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Starter questions (first load) */}
          {messages.length <= 1 && !loading && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {STARTERS.slice(0, 4).map(q => (
                <button key={q} onClick={() => sendMessage(q)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 hover:bg-orange-500/15 border border-white/8 hover:border-orange-500/30 text-[11px] text-gray-400 hover:text-orange-300 transition-all text-left">
                  {q.length > 35 ? q.slice(0, 35) + "…" : q}
                  <ChevronRight className="w-2.5 h-2.5 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Lead form */}
          {showLead && !leadDone && (
            <div className="border-t border-white/8 bg-[#0a1220]">
              <LeadForm onSubmit={submitLead} onSkip={() => setShowLead(false)} />
            </div>
          )}

          {/* Input */}
          <div className="px-3 py-3 border-t border-white/8 bg-[#0a1220]">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage(input))}
                placeholder="Ask about TX Energy Risk..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40"
              />
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 flex items-center justify-center transition-all flex-shrink-0">
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
            <p className="text-[9px] text-gray-700 mt-1.5 text-center">{COMPLIANCE}</p>
          </div>
        </div>
      )}
    </>
  );
}
