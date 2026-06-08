"""
TX Energy Risk — Apollo.io Prospecting Router
Searches Apollo for energy-adjacent prospects, enriches with AI, scores leads.
"""
import csv
import io
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx
import anthropic
from fastapi import APIRouter, Body, Header, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.supabase_client import get_supabase

log    = logging.getLogger(__name__)
router = APIRouter(prefix="/api/prospecting", tags=["Prospecting"])

APOLLO_API_KEY    = os.getenv("APOLLO_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
APOLLO_BASE       = "https://api.apollo.io/v1"


# ---------------------------------------------------------------------------
# MODELS
# ---------------------------------------------------------------------------

class SearchRequest(BaseModel):
    locations:       list[str] = ["Texas"]
    industries:      list[str] = []
    employee_min:    Optional[int] = None
    employee_max:    Optional[int] = None
    titles:          list[str] = []
    page:            int = 1
    per_page:        int = 25

class ProspectUpdate(BaseModel):
    status:  Optional[str] = None
    notes:   Optional[str] = None
    priority: Optional[str] = None


# ---------------------------------------------------------------------------
# APOLLO SEARCH
# ---------------------------------------------------------------------------

async def _search_apollo(req: SearchRequest) -> list[dict]:
    """Call Apollo People Search API."""
    if not APOLLO_API_KEY:
        raise HTTPException(status_code=503, detail="APOLLO_API_KEY not configured")

    default_titles = req.titles or [
        "Energy Manager", "Director of Energy", "VP Energy",
        "Energy Procurement Manager", "Energy Trading Manager",
        "Director of Energy Trading", "VP Energy Trading",
        "Operations Manager", "VP Operations", "Director of Operations",
        "Procurement Manager", "Chief Procurement Officer",
        "Risk Manager", "Commodity Risk Manager",
        "Portfolio Manager", "Energy Portfolio Manager",
        "COO", "CFO", "CEO",
    ]

    payload: dict = {
        "page":                      req.page,
        "per_page":                  req.per_page,
        "reveal_personal_emails":    True,
        "reveal_phone_number":       False,
        # Only return contacts with verified emails — these always have full names
        "contact_email_status_cd":   ["verified", "likely to engage"],
    }

    # Location — Apollo uses city/state strings in person_locations
    if req.locations:
        payload["person_locations"] = req.locations

    # Titles
    if default_titles:
        payload["person_titles"] = default_titles

    # Industries
    if req.industries:
        payload["q_organization_industries"] = req.industries

    # Employee count range
    if req.employee_min or req.employee_max:
        lo = req.employee_min or 1
        hi = req.employee_max or 100000
        payload["organization_num_employees_ranges"] = [f"{lo},{hi}"]

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"{APOLLO_BASE}/mixed_people/api_search",
            json=payload,
            headers={
                "Content-Type":  "application/json",
                "Cache-Control": "no-cache",
                "X-Api-Key":     APOLLO_API_KEY,
            },
        )

    if r.status_code not in (200, 201):
        log.error(f"[APOLLO] Search failed: {r.status_code} {r.text[:500]}")
        raise HTTPException(status_code=502, detail=f"Apollo API error: {r.status_code} — {r.text[:200]}")

    data = r.json()
    return data.get("people", [])


def _parse_person(person: dict, search_query: str) -> dict:
    """Extract relevant fields from Apollo person record."""
    org = person.get("organization") or {}
    emp = org.get("estimated_num_employees") or person.get("employment_history", [{}])[0].get("organization_num_employees")

    return {
        "company_name":    org.get("name") or person.get("organization_name"),
        "website":         org.get("website_url"),
        "industry":        org.get("industry"),
        "employee_count":  emp,
        "city":            person.get("city"),
        "state":           person.get("state"),
        "country":         person.get("country", "US"),
        "contact_name":    f"{person.get('first_name','')} {person.get('last_name','')}".strip(),
        "contact_title":   person.get("title"),
        "contact_email":   person.get("email"),
        "contact_linkedin": person.get("linkedin_url"),
        "apollo_person_id": person.get("id"),
        "apollo_org_id":   org.get("id"),
        "search_query":    search_query,
        "lead_score":      0,
        "priority":        "low",
        "status":          "new",
        "source":          "apollo",
        "created_at":      datetime.now(timezone.utc).isoformat(),
        "updated_at":      datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# LEAD SCORING
# ---------------------------------------------------------------------------

ENERGY_INTENSIVE_INDUSTRIES = [
    "oil", "gas", "energy", "petrochemical", "chemical", "refining",
    "manufacturing", "industrial", "mining", "data center", "semiconductor",
    "utilities", "pipeline", "midstream", "upstream", "downstream",
    "energy trading", "natural gas trading", "power marketing",
    "power generation", "energy procurement",
]

# Bonus scores for high-value trading/marketing industries (applied on top of base intensity)
TRADING_INDUSTRY_BONUS: dict[str, int] = {
    "energy trading": 20,
    "natural gas trading": 20,
    "power marketing": 18,
    "energy procurement": 18,
    "power generation": 15,
}

TEXAS_ENERGY_CITIES = [
    "houston", "midland", "odessa", "corpus christi", "beaumont",
    "port arthur", "pasadena", "baytown", "galveston", "victoria",
]

def _score_lead(prospect: dict) -> dict:
    """Score a prospect 0-100 based on energy relevance."""
    score_size        = 0
    score_intensity   = 0
    score_location    = 0
    score_operational = 0

    # Company size (0-25)
    emp = prospect.get("employee_count") or 0
    if emp >= 1000:    score_size = 25
    elif emp >= 500:   score_size = 20
    elif emp >= 200:   score_size = 15
    elif emp >= 50:    score_size = 10
    elif emp >= 10:    score_size = 5

    # Energy intensity by industry (0-35 base + trading bonus)
    industry = (prospect.get("industry") or "").lower()
    company  = (prospect.get("company_name") or "").lower()
    combined = f"{industry} {company}"
    for keyword in ENERGY_INTENSIVE_INDUSTRIES:
        if keyword in combined:
            score_intensity = 35
            break
    if score_intensity == 0:
        # Partial match
        for kw in ["plant", "facility", "operations", "grid", "power", "electric"]:
            if kw in combined:
                score_intensity = 20
                break
    # Apply trading/marketing industry bonus
    for ind_kw, bonus in TRADING_INDUSTRY_BONUS.items():
        if ind_kw in industry:
            score_intensity = min(35, score_intensity + bonus)
            break

    # Texas energy hub location (0-25)
    city  = (prospect.get("city")  or "").lower()
    state = (prospect.get("state") or "").lower()
    if state in ("texas", "tx"):
        score_location = 15
        for energy_city in TEXAS_ENERGY_CITIES:
            if energy_city in city:
                score_location = 25
                break

    # Operational title relevance (0-15)
    title = (prospect.get("contact_title") or "").lower()
    # Trading/risk titles get full score
    for kw in ["trader", "trading", "risk manager", "hedging", "portfolio manager", "market analyst", "power marketing"]:
        if kw in title:
            score_operational = 15
            break
    if score_operational == 0:
        for kw in ["operations", "energy", "plant", "facilities", "procurement", "coo", "director"]:
            if kw in title:
                score_operational = 15
                break
    if score_operational == 0:
        for kw in ["manager", "vp", "president", "officer"]:
            if kw in title:
                score_operational = 8
                break

    total = score_size + score_intensity + score_location + score_operational
    priority = "high" if total >= 65 else "medium" if total >= 40 else "low"

    return {
        "lead_score":           min(total, 100),
        "score_company_size":   score_size,
        "score_energy_intensity": score_intensity,
        "score_location":       score_location,
        "score_operational":    score_operational,
        "priority":             priority,
    }


# ---------------------------------------------------------------------------
# AI ENRICHMENT
# ---------------------------------------------------------------------------

async def _enrich_with_ai(prospect: dict) -> dict:
    """Use Claude to generate energy exposure, pain points, sales message."""
    if not ANTHROPIC_API_KEY:
        return {
            "energy_exposure": "AI enrichment unavailable — ANTHROPIC_API_KEY not set.",
            "pain_points":     "Configure API key to enable AI enrichment.",
            "sales_message":   "Hi [Name], TX Energy Risk monitors ERCOT pricing and weather-driven demand conditions in real time.",
        }

    prompt = f"""You are a sales intelligence assistant for TX Energy Risk — a Texas energy operations intelligence platform.

Generate sales intelligence for this prospect:
- Company: {prospect.get("company_name", "Unknown")}
- Industry: {prospect.get("industry", "Unknown")}
- Size: {prospect.get("employee_count", "Unknown")} employees
- Location: {prospect.get("city", "")}, {prospect.get("state", "")}
- Contact: {prospect.get("contact_name", "")} — {prospect.get("contact_title", "")}

TX Energy Risk provides: Real-time ERCOT pricing, weather demand monitoring, natural gas supply tracking, escalation alerts, and operational intelligence for Texas energy markets.

Return ONLY valid JSON:
{{
  "energy_exposure": "1-2 sentences. What energy cost/operational exposure does this company likely have based on industry and location.",
  "pain_points": "2-3 bullet operational pain points this type of company faces with Texas energy markets.",
  "sales_message": "A 3-4 sentence personalized cold outreach message. Professional. Not pushy. Focus on operational awareness value. No financial advice."
}}"""

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        msg    = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        data = json.loads(msg.content[0].text.strip())
        data["enriched_at"] = datetime.now(timezone.utc).isoformat()
        return data
    except Exception as e:
        log.error(f"[PROSPECTING] AI enrichment failed: {e}")
        return {
            "energy_exposure": "AI enrichment failed — retry later.",
            "pain_points":     str(e)[:100],
            "sales_message":   f"Hi {prospect.get('contact_name','')}, I'd love to share how TX Energy Risk helps {prospect.get('company_name','your company')} monitor Texas energy conditions.",
        }


# ---------------------------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------------------------

@router.post("/search")
async def search_prospects(body: SearchRequest):
    """Search Apollo for prospects and save to Supabase."""
    search_query = f"{body.locations} | {body.industries} | {body.titles}"

    people = await _search_apollo(body)
    if not people:
        return {"count": 0, "prospects": []}

    sb         = get_supabase()
    saved      = []
    duplicates = 0

    for person in people:
        prospect = _parse_person(person, search_query)
        scores   = _score_lead(prospect)
        prospect.update(scores)

        # Skip if already exists
        if prospect.get("apollo_person_id"):
            existing = sb.table("prospects").select("id").eq(
                "apollo_person_id", prospect["apollo_person_id"]
            ).limit(1).execute()
            if existing.data:
                duplicates += 1
                continue

        try:
            r = sb.table("prospects").insert(prospect).execute()
            if r.data:
                saved.append(r.data[0])
        except Exception as e:
            log.warning(f"[PROSPECTING] Insert failed: {e}")

    log.info(f"[PROSPECTING] Saved {len(saved)} prospects, {duplicates} duplicates skipped")
    return {"count": len(saved), "duplicates": duplicates, "prospects": saved}


@router.get("/prospects")
async def list_prospects(
    priority: Optional[str] = None,
    status:   Optional[str] = None,
    state:    Optional[str] = None,
    limit:    int = 100,
    offset:   int = 0,
):
    """List saved prospects with optional filters."""
    sb    = get_supabase()
    query = sb.table("prospects").select("*").order("lead_score", desc=True).limit(limit).offset(offset)
    if priority: query = query.eq("priority", priority)
    if status:   query = query.eq("status", status)
    if state:    query = query.eq("state", state)
    r = query.execute()
    return r.data or []


@router.get("/dashboard")
async def dashboard_stats():
    """Aggregate stats for the prospecting dashboard."""
    sb = get_supabase()
    all_r  = sb.table("prospects").select("lead_score, priority, state, status").execute()
    rows   = all_r.data or []

    total       = len(rows)
    high_prio   = sum(1 for r in rows if r.get("priority") == "high")
    avg_score   = round(sum(r.get("lead_score", 0) for r in rows) / total, 1) if total else 0

    by_region: dict[str, int] = {}
    for r in rows:
        state = r.get("state") or "Unknown"
        by_region[state] = by_region.get(state, 0) + 1

    by_priority = {"high": 0, "medium": 0, "low": 0}
    for r in rows:
        p = r.get("priority", "low")
        by_priority[p] = by_priority.get(p, 0) + 1

    return {
        "total_prospects":      total,
        "high_priority":        high_prio,
        "avg_lead_score":       avg_score,
        "by_region":            dict(sorted(by_region.items(), key=lambda x: -x[1])[:10]),
        "by_priority":          by_priority,
    }


@router.post("/enrich/{prospect_id}")
async def enrich_prospect(prospect_id: str):
    """AI-enrich a single prospect."""
    sb = get_supabase()
    r  = sb.table("prospects").select("*").eq("id", prospect_id).single().execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Prospect not found")

    enrichment = await _enrich_with_ai(r.data)
    sb.table("prospects").update(enrichment).eq("id", prospect_id).execute()
    return {"status": "enriched", **enrichment}


@router.post("/enrich-batch")
async def enrich_batch(prospect_ids: list[str] = Body(...)):
    """AI-enrich multiple prospects."""
    sb      = get_supabase()
    results = []
    for pid in prospect_ids[:10]:  # cap at 10 per batch
        r = sb.table("prospects").select("*").eq("id", pid).single().execute()
        if r.data:
            enrichment = await _enrich_with_ai(r.data)
            sb.table("prospects").update(enrichment).eq("id", pid).execute()
            results.append({"id": pid, "status": "enriched"})
    return results


@router.patch("/prospects/{prospect_id}")
async def update_prospect(prospect_id: str, body: ProspectUpdate):
    """Update prospect status, notes, or priority."""
    sb      = get_supabase()
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    sb.table("prospects").update(updates).eq("id", prospect_id).execute()
    return {"status": "updated"}


@router.delete("/prospects/{prospect_id}")
async def delete_prospect(prospect_id: str):
    sb = get_supabase()
    sb.table("prospects").delete().eq("id", prospect_id).execute()
    return {"status": "deleted"}


@router.get("/export")
async def export_csv(
    priority: Optional[str] = None,
    status:   Optional[str] = None,
):
    """Export prospects to CSV."""
    sb    = get_supabase()
    query = sb.table("prospects").select("*").order("lead_score", desc=True)
    if priority: query = query.eq("priority", priority)
    if status:   query = query.eq("status", status)
    rows  = query.execute().data or []

    output = io.StringIO()
    fields = [
        "company_name", "website", "industry", "employee_count",
        "city", "state", "contact_name", "contact_title",
        "contact_email", "contact_linkedin",
        "lead_score", "priority", "status",
        "energy_exposure", "pain_points", "sales_message",
    ]
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)

    output.seek(0)
    filename = f"prospects_{datetime.now().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ---------------------------------------------------------------------------
# CRM — PIPELINE ACTIONS
# ---------------------------------------------------------------------------

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FRONTEND_URL   = os.getenv("FRONTEND_URL", "https://texas-energy-risk.vercel.app")

PIPELINE_STATUSES = [
    "new", "newsletter_added", "newsletter_sent", "opened", "clicked",
    "demo_requested", "qualified", "opportunity", "customer", "closed_lost",
]

STATUS_COLORS = {
    "new":              "#64748b",
    "newsletter_added": "#3b82f6",
    "newsletter_sent":  "#8b5cf6",
    "opened":           "#06b6d4",
    "clicked":          "#10b981",
    "demo_requested":   "#f59e0b",
    "qualified":        "#f97316",
    "opportunity":      "#ef4444",
    "customer":         "#22c55e",
    "closed_lost":      "#374151",
}


@router.post("/prospects/{prospect_id}/add-to-newsletter")
async def add_to_newsletter(prospect_id: str):
    """Add prospect to newsletter subscriber list via Resend."""
    sb = get_supabase()
    r  = sb.table("prospects").select("*").eq("id", prospect_id).single().execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Prospect not found")

    prospect = r.data
    email    = prospect.get("contact_email")
    if not email:
        raise HTTPException(status_code=400, detail="Prospect has no email address")

    # Add to newsletter_subscribers table
    try:
        sb.table("newsletter_subscribers").insert({
            "email":     email,
            "company":   prospect.get("company_name"),
            "title":     prospect.get("contact_title"),
            "city":      prospect.get("city"),
            "industry":  prospect.get("industry"),
            "source":    "prospecting",
            "segment":   f"{prospect.get('city', '')} {prospect.get('industry', '')}".strip(),
            "status":    "active",
        }).execute()
    except Exception:
        pass  # May already exist

    # Also add to Resend contacts if API key available
    resend_ok = False
    if RESEND_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    "https://api.resend.com/contacts",
                    headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                    json={
                        "email":      email,
                        "first_name": (prospect.get("contact_name") or "").split()[0],
                        "last_name":  " ".join((prospect.get("contact_name") or "").split()[1:]),
                        "unsubscribed": False,
                    },
                )
            resend_ok = True
        except Exception as e:
            log.warning(f"[CRM] Resend contact add failed: {e}")

    # Update prospect status
    now = datetime.now(timezone.utc).isoformat()
    sb.table("prospects").update({
        "status":              "newsletter_added",
        "newsletter_added_at": now,
        "updated_at":          now,
    }).eq("id", prospect_id).execute()

    return {"status": "added", "resend_synced": resend_ok}


@router.post("/prospects/{prospect_id}/request-demo")
async def request_demo(prospect_id: str, notes: str = Body("", embed=True)):
    """Mark prospect as demo requested."""
    sb = get_supabase()
    r  = sb.table("prospects").select("*").eq("id", prospect_id).single().execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Prospect not found")

    now = datetime.now(timezone.utc).isoformat()
    sb.table("prospects").update({
        "status":              "demo_requested",
        "demo_requested_at":   now,
        "updated_at":          now,
    }).eq("id", prospect_id).execute()

    # Log demo request
    try:
        sb.table("demo_requests").insert({
            "prospect_id":   prospect_id,
            "company_name":  r.data.get("company_name"),
            "contact_name":  r.data.get("contact_name"),
            "contact_email": r.data.get("contact_email"),
            "notes":         notes,
        }).execute()
    except Exception as e:
        log.warning(f"[CRM] Demo request log failed: {e}")

    return {"status": "demo_requested"}


# ---------------------------------------------------------------------------
# CRM — AUDIENCES
# ---------------------------------------------------------------------------

class AudienceCreate(BaseModel):
    name:        str
    description: Optional[str] = None
    filters:     Optional[dict] = None


@router.post("/audiences")
async def create_audience(body: AudienceCreate):
    sb = get_supabase()
    r  = sb.table("prospect_audiences").insert({
        "name":        body.name,
        "description": body.description,
        "filters":     json.dumps(body.filters or {}),
    }).execute()
    return r.data[0] if r.data else {}


@router.get("/audiences")
async def list_audiences():
    sb   = get_supabase()
    r    = sb.table("prospect_audiences").select("*").order("created_at", desc=True).execute()
    auds = r.data or []
    # Enrich with member counts
    for aud in auds:
        mc = sb.table("prospect_audience_members").select("id", count="exact").eq("audience_id", aud["id"]).execute()
        aud["member_count"] = mc.count or 0
    return auds


@router.post("/audiences/{audience_id}/add-prospect/{prospect_id}")
async def add_to_audience(audience_id: str, prospect_id: str):
    sb = get_supabase()
    try:
        sb.table("prospect_audience_members").insert({
            "audience_id": audience_id,
            "prospect_id": prospect_id,
        }).execute()
    except Exception:
        pass  # Already a member
    return {"status": "added"}


@router.post("/audiences/{audience_id}/push-to-resend")
async def push_audience_to_resend(audience_id: str):
    """Push all audience members to Resend contacts."""
    if not RESEND_API_KEY:
        raise HTTPException(status_code=503, detail="RESEND_API_KEY not configured")

    sb      = get_supabase()
    members = sb.table("prospect_audience_members").select(
        "prospect_id"
    ).eq("audience_id", audience_id).execute().data or []

    synced  = 0
    failed  = 0
    for m in members:
        p = sb.table("prospects").select("*").eq("id", m["prospect_id"]).single().execute()
        if not p.data or not p.data.get("contact_email"):
            continue
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    "https://api.resend.com/contacts",
                    headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                    json={
                        "email":        p.data["contact_email"],
                        "first_name":   (p.data.get("contact_name") or "").split()[0],
                        "last_name":    " ".join((p.data.get("contact_name") or "").split()[1:]),
                        "unsubscribed": False,
                    },
                )
            synced += 1
        except Exception:
            failed += 1

    return {"synced": synced, "failed": failed}


@router.get("/audiences/{audience_id}/export")
async def export_audience_csv(audience_id: str):
    sb      = get_supabase()
    members = sb.table("prospect_audience_members").select("prospect_id").eq("audience_id", audience_id).execute().data or []
    rows    = []
    for m in members:
        p = sb.table("prospects").select("*").eq("id", m["prospect_id"]).single().execute()
        if p.data:
            rows.append(p.data)

    output = io.StringIO()
    fields = ["company_name", "contact_name", "contact_title", "contact_email",
              "contact_linkedin", "city", "state", "industry", "employee_count",
              "lead_score", "priority", "status"]
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=audience_{audience_id[:8]}.csv"},
    )


# ---------------------------------------------------------------------------
# CRM — CONVERSION ANALYTICS
# ---------------------------------------------------------------------------

@router.get("/analytics")
async def conversion_analytics():
    """Full funnel conversion metrics."""
    sb   = get_supabase()
    rows = sb.table("prospects").select(
        "status, priority, industry, state, lead_score, created_at"
    ).execute().data or []

    total      = len(rows)
    newsletter = sum(1 for r in rows if r["status"] in ("newsletter_added","newsletter_sent","opened","clicked","demo_requested","qualified","opportunity","customer"))
    opened     = sum(1 for r in rows if r["status"] in ("opened","clicked","demo_requested","qualified","opportunity","customer"))
    clicked    = sum(1 for r in rows if r["status"] in ("clicked","demo_requested","qualified","opportunity","customer"))
    demos      = sum(1 for r in rows if r["status"] in ("demo_requested","qualified","opportunity","customer"))
    qualified  = sum(1 for r in rows if r["status"] in ("qualified","opportunity","customer"))
    customers  = sum(1 for r in rows if r["status"] == "customer")

    by_industry: dict[str, int] = {}
    by_region:   dict[str, int] = {}
    for r in rows:
        ind = r.get("industry") or "Unknown"
        reg = r.get("state")    or "Unknown"
        by_industry[ind] = by_industry.get(ind, 0) + 1
        by_region[reg]   = by_region.get(reg, 0)   + 1

    top_prospects = sorted(rows, key=lambda x: x.get("lead_score", 0) or 0, reverse=True)[:5]

    demo_rows = sb.table("demo_requests").select("*").order("requested_at", desc=True).limit(10).execute().data or []

    return {
        "funnel": {
            "total":            total,
            "newsletter_added": newsletter,
            "opened":           opened,
            "clicked":          clicked,
            "demo_requested":   demos,
            "qualified":        qualified,
            "customers":        customers,
        },
        "rates": {
            "newsletter_rate": round(newsletter / total * 100, 1) if total else 0,
            "open_rate":       round(opened    / newsletter * 100, 1) if newsletter else 0,
            "click_rate":      round(clicked   / newsletter * 100, 1) if newsletter else 0,
            "demo_rate":       round(demos     / total * 100, 1) if total else 0,
            "conversion_rate": round(customers / total * 100, 1) if total else 0,
        },
        "by_industry": dict(sorted(by_industry.items(), key=lambda x: -x[1])[:8]),
        "by_region":   dict(sorted(by_region.items(),   key=lambda x: -x[1])[:8]),
        "top_prospects": top_prospects,
        "recent_demos":  demo_rows,
    }


# ---------------------------------------------------------------------------
# REVEAL EMAIL  (1 Apollo credit per call)
# ---------------------------------------------------------------------------

@router.post("/{prospect_id}/reveal-email")
async def reveal_email(prospect_id: str):
    """Uses Apollo to reveal email for a prospect. Costs 1 credit."""
    if not APOLLO_API_KEY:
        raise HTTPException(status_code=503, detail="APOLLO_API_KEY not configured")

    sb = get_supabase()
    r  = sb.table("prospects").select("*").eq("id", prospect_id).single().execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Prospect not found")
    p = r.data

    if p.get("contact_email"):
        return {"email": p["contact_email"], "source": "cached", "credits_used": 0}

    headers = {"X-Api-Key": APOLLO_API_KEY, "Content-Type": "application/json"}
    email = None

    async with httpx.AsyncClient(timeout=30) as client:
        apollo_id = p.get("apollo_person_id")

        # Strategy 1: ID-based reveal (fastest)
        if apollo_id:
            resp = await client.post(
                f"{APOLLO_BASE}/people/{apollo_id}/reveal",
                headers=headers,
                json={},
            )
            if resp.status_code == 200:
                person = resp.json().get("person", {})
                email  = person.get("email")

        # Strategy 2: people/match by ID with reveal flag
        if not email and apollo_id:
            resp2 = await client.post(
                f"{APOLLO_BASE}/people/match",
                headers=headers,
                json={"id": apollo_id, "reveal_personal_emails": True, "reveal_phone_number": False},
            )
            if resp2.status_code == 200:
                person = resp2.json().get("person", {})
                email  = person.get("email")

        # Strategy 3: match by name + company (works even without stored ID)
        if not email:
            name    = p.get("contact_name", "")
            company = p.get("company_name", "")
            domain  = p.get("website", "")
            if name and (company or domain):
                match_payload = {
                    "name":                   name,
                    "reveal_personal_emails": True,
                    "reveal_phone_number":    False,
                }
                if domain:
                    match_payload["domain"] = domain.replace("https://","").replace("http://","").rstrip("/")
                if company:
                    match_payload["organization_name"] = company
                resp3 = await client.post(
                    f"{APOLLO_BASE}/people/match",
                    headers=headers,
                    json=match_payload,
                )
                if resp3.status_code == 200:
                    person = resp3.json().get("person", {})
                    email  = person.get("email")
                    # Also store the apollo_person_id if we didn't have it
                    if person.get("id") and not apollo_id:
                        sb.table("prospects").update({"apollo_person_id": person["id"]}).eq("id", prospect_id).execute()

    if email:
        sb.table("prospects").update({
            "contact_email": email,
            "updated_at":    datetime.now(timezone.utc).isoformat(),
        }).eq("id", prospect_id).execute()
    if email:
        update_data: dict = {
            "contact_email": email,
            "updated_at":    datetime.now(timezone.utc).isoformat(),
        }
        # Also save full name if we only had a first name
        full_name = f"{person.get('first_name','')} {person.get('last_name','')}".strip()
        if full_name and " " in full_name and not p.get("contact_name","").count(" "):
            update_data["contact_name"] = full_name
        if person.get("linkedin_url") and not p.get("contact_linkedin"):
            update_data["contact_linkedin"] = person["linkedin_url"]
        sb.table("prospects").update(update_data).eq("id", prospect_id).execute()
        return {"email": email, "full_name": full_name or None, "source": "apollo", "credits_used": 1}

    return {"email": None, "source": "apollo", "credits_used": 1,
            "message": "Apollo has no email on file for this contact"}


# ---------------------------------------------------------------------------
# CSV IMPORT — Apollo.io export format
# ---------------------------------------------------------------------------

# Apollo CSV column mappings (Apollo uses these exact headers)
APOLLO_COLUMN_MAP = {
    # Contact
    "first name":          "first_name",
    "last name":           "last_name",
    "title":               "contact_title",
    "email":               "contact_email",
    "linkedin url":        "contact_linkedin",
    # Company
    "company":             "company_name",
    "company name for emails": "company_name",
    "website":             "website",
    "industry":            "industry",
    "# employees":         "employee_count",
    "number of employees": "employee_count",
    "employees":           "employee_count",
    # Location
    "city":                "city",
    "state":               "state",
    "country":             "country",
}


def _parse_apollo_row(row: dict, headers_lower: list[str]) -> dict | None:
    """Map an Apollo CSV row to our prospect schema."""
    out: dict = {
        "source":      "apollo_csv",
        "status":      "new",
        "country":     "US",
        "lead_score":  0,
        "priority":    "low",
        "created_at":  datetime.now(timezone.utc).isoformat(),
        "updated_at":  datetime.now(timezone.utc).isoformat(),
    }

    for raw_key, value in row.items():
        key_lower = raw_key.strip().lower()
        mapped = APOLLO_COLUMN_MAP.get(key_lower)
        if mapped and value and value.strip():
            out[mapped] = value.strip()

    # Build contact_name from first + last
    first = out.pop("first_name", "") or ""
    last  = out.pop("last_name",  "") or ""
    name  = f"{first} {last}".strip()
    if name:
        out["contact_name"] = name

    # Convert employee_count to int
    if "employee_count" in out:
        try:
            raw = out["employee_count"].replace(",", "").split("-")[0].strip()
            out["employee_count"] = int(raw)
        except Exception:
            del out["employee_count"]

    # Require at minimum company or contact name
    if not out.get("company_name") and not out.get("contact_name"):
        return None

    return out


@router.post("/import-csv")
async def import_csv(file: UploadFile = File(...)):
    """Import prospects from an Apollo.io CSV export."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # handles BOM from Excel
    except Exception:
        text = content.decode("latin-1")

    reader     = csv.DictReader(io.StringIO(text))
    headers_lc = [h.strip().lower() for h in (reader.fieldnames or [])]

    sb         = get_supabase()
    imported   = 0
    skipped    = 0
    duplicates = 0
    errors     = []

    for i, row in enumerate(reader):
        try:
            prospect = _parse_apollo_row(dict(row), headers_lc)
            if not prospect:
                skipped += 1
                continue

            # Score the lead
            scores = _score_lead(prospect)
            prospect.update(scores)

            # Deduplicate by email
            email = prospect.get("contact_email")
            if email:
                existing = sb.table("prospects").select("id").eq("contact_email", email).limit(1).execute()
                if existing.data:
                    duplicates += 1
                    continue

            sb.table("prospects").insert(prospect).execute()
            imported += 1

        except Exception as e:
            errors.append(f"Row {i+2}: {str(e)[:80]}")
            if len(errors) >= 10:
                break

    return {
        "status":     "complete",
        "imported":   imported,
        "duplicates": duplicates,
        "skipped":    skipped,
        "errors":     errors[:5],
        "total_rows": imported + duplicates + skipped + len(errors),
    }


# ---------------------------------------------------------------------------
# CRM — SEND NEWSLETTER CAMPAIGN
# ---------------------------------------------------------------------------

class SendCampaignRequest(BaseModel):
    subject:    str
    html_body:  str
    from_name:  str  = "Texas Grid Intel"
    from_email: str  = "alerts@texasgridintel.com"
    status_filter: str = "newsletter_added"   # which CRM status to target


@router.post("/send-newsletter")
async def send_newsletter_campaign(body: SendCampaignRequest):
    """
    Send a one-to-one email via Resend to every prospect whose status matches
    status_filter (default: newsletter_added).  Each email is personalised with
    the contact's first name.  Updates each sent prospect status → newsletter_sent.
    Returns counts for sent / failed / skipped.
    """
    if not RESEND_API_KEY:
        raise HTTPException(status_code=503, detail="RESEND_API_KEY not configured")

    sb       = get_supabase()
    recs     = sb.table("prospects") \
                 .select("id,contact_name,contact_email,company_name") \
                 .eq("status", body.status_filter) \
                 .execute()
    prospects = [p for p in (recs.data or []) if p.get("contact_email")]

    if not prospects:
        return {"sent": 0, "failed": 0, "skipped": 0,
                "message": f"No prospects with status '{body.status_filter}' and a valid email."}

    sent    = 0
    failed  = 0
    skipped = 0
    errors  = []
    now     = datetime.now(timezone.utc).isoformat()

    async with httpx.AsyncClient(timeout=15) as client:
        for p in prospects:
            email = p["contact_email"]
            name  = p.get("contact_name") or ""
            first = name.split()[0] if name.split() else "there"

            # Personalise greeting in body
            personalised_html = body.html_body.replace("{{first_name}}", first) \
                                              .replace("{{company}}", p.get("company_name") or "your company")

            payload = {
                "from":    f"{body.from_name} <{body.from_email}>",
                "to":      [email],
                "subject": body.subject,
                "html":    personalised_html,
            }

            try:
                resp = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {RESEND_API_KEY}",
                             "Content-Type": "application/json"},
                    json=payload,
                )
                if resp.status_code in (200, 201):
                    sent += 1
                    sb.table("prospects").update({
                        "status":             "newsletter_sent",
                        "newsletter_sent_at": now,
                        "updated_at":         now,
                    }).eq("id", p["id"]).execute()
                else:
                    failed += 1
                    errors.append(f"{email}: HTTP {resp.status_code} — {resp.text[:120]}")
                    log.warning(f"[CRM] Resend send failed for {email}: {resp.status_code} {resp.text[:200]}")
            except Exception as e:
                failed += 1
                errors.append(f"{email}: {str(e)[:80]}")
                log.error(f"[CRM] Resend exception for {email}: {e}")

    return {
        "sent":    sent,
        "failed":  failed,
        "skipped": skipped,
        "total":   len(prospects),
        "errors":  errors[:10],   # cap error list
    }
