"""
chatbot_service.py
TX Energy Risk AI Assistant — RAG + Claude with strict compliance guardrails.
"""
import os, logging, json, uuid, re
from typing import List, Optional, Dict
from datetime import datetime, timezone
import anthropic
from services.supabase_client import get_supabase

log = logging.getLogger(__name__)

ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")

COMPLIANCE = (
    "TX Energy Risk provides operational intelligence and situational awareness only. "
    "This assistant does not provide investment, trading, procurement, legal, engineering, "
    "or financial advice. Users remain responsible for all operational and business decisions."
)

SYSTEM_PROMPT = f"""You are the TX Energy Risk AI Assistant — a helpful support agent for the TX Energy Risk operational intelligence platform at texasgridintel.com.

STRICT RULES:
1. Answer ONLY from the knowledge context provided below. Do not guess or make up information.
2. NEVER provide investment, trading, procurement, financial, legal, or engineering advice.
3. If asked for advice or recommendations outside the platform, respond: "I can only provide information about the TX Energy Risk platform. For investment or procurement decisions, please consult a qualified professional."
4. If the answer is not in the knowledge context, say: "I don't have that information in my current knowledge base. Would you like to schedule a demo or contact our support team?"
5. Keep responses concise and actionable — 2-4 sentences when possible.
6. Always be professional and helpful.
7. For pricing questions, direct users to texasgridintel.com/pricing
8. For demo requests, offer to capture their email.

COMPLIANCE NOTICE: {COMPLIANCE}
"""

KNOWLEDGE_BASE = """
=== WHAT IS TX ENERGY RISK ===
TX Energy Risk (Texas Grid Intel) is an operational risk intelligence platform at texasgridintel.com that continuously monitors ERCOT pricing, NOAA weather demand pressure, natural gas conditions, and operational signals to identify developing risk before conditions escalate. It is NOT trading or procurement advice — it is operational situational awareness.

=== RISK SCORE ===
The Risk Score is Low, Medium, or High — synthesized every 5 minutes from ERCOT HB_HOUSTON real-time power prices, NOAA weather demand forecasts, and EIA natural gas storage data. Low = standard conditions. Medium = elevated, review recommended. High = significant conditions, immediate awareness recommended.

=== DATA SOURCES ===
Three live data sources: (1) ERCOT CDR — real-time HB_HOUSTON settlement prices every 5 minutes. (2) NOAA/NWS — 7-day weather forecasts for 8 Texas cities. (3) EIA — weekly natural gas storage and Henry Hub pricing. All from public US government and market operator endpoints.

=== 8 MONITORED CITIES ===
Houston (LZ_HOUSTON), Dallas (LZ_NORTH), Austin (LZ_SOUTH), San Antonio (LZ_SOUTH), Midland (LZ_WEST), Odessa (LZ_WEST), Corpus Christi (LZ_SOUTH), Lubbock (LZ_WEST).

=== DAILY WORKFLOW (5 MINUTES) ===
1. Check Dashboard Risk Score (1 min). 2. Read Executive Recommendation (1 min). 3. Review Monitoring Priorities (1 min). 4. Verify alert settings (1 min). 5. Check Analytics 24-48h Predictive Outlook (1 min).

=== DASHBOARD COMPONENTS ===
- Current Risk Level: Low/Medium/High composite score
- Executive Recommendation: AI-synthesized plain-language operational guidance
- Operational Cost Impact: Energy cost exposure assessment
- Scenario Modeling: 6 pre-built escalation scenarios with probabilities
- Risk Escalation Probability: % chance conditions escalate in next 6 hours
- Monitoring Priorities: Top 3 active signal channels
- Confidence Score: Data freshness 0-100%

=== ESCALATION PROBABILITY ===
The escalation probability is a quantitative estimate (0-100%) of the probability that current conditions escalate to a higher risk level within the next 6 hours. Below 25% = low escalation risk. 25-50% = moderate, heightened awareness. Above 50% = high, proactive response warranted.

=== ALERTS ===
Four delivery channels: Email, SMS (Twilio), Slack webhook, Microsoft Teams webhook. Three risk thresholds: Any Risk Change, Medium & Above, High Only. Three frequencies: Immediate, Daily Summary (7am CDT), Weekly Summary. Escalation alerts re-send High risk if not acknowledged within 30 minutes.

=== ANALYTICS — PREDICTIVE OUTLOOK ===
The Predictive Outlook uses OLS trajectory analysis, state-transition instability scoring, and historical pattern matching to produce 0-6h, 6-24h, and 24-48h risk forecasts. WHY (primary driver), WHAT (dominant signal), WATCH (developing conditions), NEXT (recommended action).

=== PRICING ===
Three plans: Free ($0/month) — live ERCOT dashboard, basic risk monitoring. Pro ($499/month) — full intelligence suite, email/SMS alerts, AI reasoning, PDF export, 8-city monitoring. Business ($1,199/month) — enterprise intelligence, morning digest, multi-location, API access. See texasgridintel.com/pricing for current details.

=== MULTIPLE LOCATIONS ===
Yes — TX Energy Risk monitors 8 Texas cities simultaneously. The Grid Map shows risk status for all 8 cities. Alerts can be configured for a specific primary monitoring location.

=== IS THIS ADVICE? ===
No. TX Energy Risk provides operational intelligence and situational awareness only. It does not provide investment, trading, procurement, legal, engineering, or financial advice. Users are responsible for all operational and business decisions.

=== COMPLEMENT EXISTING SYSTEMS ===
TX Energy Risk works alongside ETRM systems, trading platforms, and energy management systems — not replacing them. While ETRM handles transaction management, TX Energy Risk provides early-warning market context. It connects NOAA weather data to ERCOT grid load impact, which standard weather services do not do.

=== CONFIDENCE SCORE ===
Reflects data freshness across three sources. Above 85% = all data current, act with confidence. 65-85% = moderate confidence, some latency. Below 65% = limited confidence, wait for data refresh before major decisions.

=== MORNING DIGEST ===
A structured daily briefing at 7am CDT summarizing overnight conditions, current risk, what changed, 48-hour forecast, and monitoring priorities. Can be sent to a distribution list email. Available to Pro and Business subscribers.

=== HELP CENTER ===
Full documentation at texasgridintel.com/docs — Getting Started, Dashboard Guide, Grid Map Guide, Analytics Guide, Alert Center, Energy Risk Brief, Daily Workflow, and FAQ.
"""


def _search_knowledge(query: str) -> str:
    """Simple keyword search over knowledge base — returns relevant sections."""
    query_lower = query.lower()
    sections = KNOWLEDGE_BASE.split("\n=== ")
    relevant = []
    for section in sections:
        if not section.strip():
            continue
        # Score by keyword overlap
        score = sum(1 for word in query_lower.split() if len(word) > 3 and word in section.lower())
        if score > 0:
            relevant.append((score, section))
    relevant.sort(key=lambda x: x[0], reverse=True)
    top = relevant[:4]
    return "\n\n".join(f"=== {s}" if not s.startswith("WHAT") else s for _, s in top) if top else KNOWLEDGE_BASE[:3000]


async def _save_session(session_token: str, page_context: str = "", user_id: str = None) -> str:
    try:
        sb = get_supabase()
        existing = sb.table("chatbot_sessions").select("id").eq("session_token", session_token).limit(1).execute()
        if existing.data:
            sb.table("chatbot_sessions").update({"last_active": datetime.now(timezone.utc).isoformat()}).eq("session_token", session_token).execute()
            return existing.data[0]["id"]
        row = {"session_token": session_token, "page_context": page_context}
        if user_id:
            row["user_id"] = user_id
        r = sb.table("chatbot_sessions").insert(row).execute()
        return r.data[0]["id"]
    except Exception as e:
        log.warning("[CHATBOT] Session save error: %s", e)
        return str(uuid.uuid4())


async def _save_message(session_id: str, role: str, content: str, sources: List[str] = None) -> str:
    try:
        sb = get_supabase()
        r = sb.table("chatbot_messages").insert({
            "session_id": session_id, "role": role, "content": content,
            "sources": sources or [],
        }).execute()
        return r.data[0]["id"]
    except Exception as e:
        log.warning("[CHATBOT] Message save error: %s", e)
        return ""


async def _save_unanswered(session_id: str, question: str) -> None:
    try:
        sb = get_supabase()
        sb.table("chatbot_unanswered_questions").insert({
            "session_id": session_id, "question": question,
        }).execute()
    except Exception as e:
        log.warning("[CHATBOT] Unanswered save error: %s", e)


async def chat(
    message: str,
    session_token: str,
    history: List[Dict],
    page_context: str = "",
    user_id: str = None,
) -> Dict:
    """Main chat handler — RAG + Claude with compliance guardrails."""
    session_id = await _save_session(session_token, page_context, user_id)
    await _save_message(session_id, "user", message)

    # Search knowledge base
    context = _search_knowledge(message)

    # Detect lead/demo intent
    is_demo_request = any(w in message.lower() for w in ["demo", "schedule", "call", "trial", "contact", "talk to"])

    # Build messages for Claude
    messages = []
    for h in history[-6:]:  # last 6 turns
        if h.get("role") in ("user", "assistant"):
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    full_system = f"{SYSTEM_PROMPT}\n\nKNOWLEDGE CONTEXT:\n{context}\n\nPage user is on: {page_context or 'Unknown'}"

    response_text = ""
    confident = True

    if not ANTHROPIC_KEY:
        response_text = "The AI assistant is not configured. Please contact support at support@texasgridintel.com."
        confident = False
    else:
        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
            r = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=400,
                system=full_system,
                messages=messages,
            )
            response_text = r.content[0].text
            # Check if response indicates uncertainty
            uncertain_phrases = ["don't have that information", "not in my knowledge", "i'm not sure", "cannot find"]
            confident = not any(p in response_text.lower() for p in uncertain_phrases)
        except Exception as e:
            log.error("[CHATBOT] Claude error: %s", e)
            response_text = "I'm having trouble processing that right now. Please try again or contact support at support@texasgridintel.com."
            confident = False

    # Save unanswered if not confident
    if not confident:
        await _save_unanswered(session_id, message)

    msg_id = await _save_message(session_id, "assistant", response_text, ["knowledge_base"])

    return {
        "response": response_text,
        "session_id": session_id,
        "message_id": msg_id,
        "is_demo_request": is_demo_request,
        "confident": confident,
        "compliance": COMPLIANCE,
    }


async def capture_lead(
    session_token: str,
    email: str,
    name: str = "",
    company: str = "",
    role: str = "",
    interest: str = "",
    demo_requested: bool = False,
) -> Dict:
    """Capture a lead from the chatbot."""
    try:
        sb = get_supabase()
        sess = sb.table("chatbot_sessions").select("id").eq("session_token", session_token).limit(1).execute()
        session_id = sess.data[0]["id"] if sess.data else None
        r = sb.table("chatbot_leads").insert({
            "session_id": session_id, "email": email, "name": name,
            "company": company, "role": role, "interest": interest,
            "demo_requested": demo_requested,
        }).execute()
        if session_id:
            sb.table("chatbot_sessions").update({"is_lead": True, "demo_requested": demo_requested, "user_email": email, "user_name": name}).eq("id", session_id).execute()
        log.info("[CHATBOT] Lead captured: %s demo=%s", email, demo_requested)
        return {"success": True, "lead_id": r.data[0]["id"]}
    except Exception as e:
        log.error("[CHATBOT] Lead capture error: %s", e)
        return {"success": False, "error": str(e)}


async def submit_feedback(message_id: str, session_token: str, helpful: bool, comment: str = "") -> Dict:
    """Record feedback on a response."""
    try:
        sb = get_supabase()
        sess = sb.table("chatbot_sessions").select("id").eq("session_token", session_token).limit(1).execute()
        session_id = sess.data[0]["id"] if sess.data else None
        sb.table("chatbot_feedback").insert({
            "message_id": message_id, "session_id": session_id,
            "helpful": helpful, "comment": comment,
        }).execute()
        sb.table("chatbot_messages").update({"was_helpful": helpful}).eq("id", message_id).execute()
        return {"success": True}
    except Exception as e:
        log.error("[CHATBOT] Feedback error: %s", e)
        return {"success": False}


async def get_unanswered(limit: int = 50) -> List[Dict]:
    try:
        sb = get_supabase()
        r = sb.table("chatbot_unanswered_questions").select("*").eq("resolved", False).order("created_at", desc=True).limit(limit).execute()
        return r.data or []
    except Exception as e:
        log.error("[CHATBOT] Get unanswered error: %s", e)
        return []
