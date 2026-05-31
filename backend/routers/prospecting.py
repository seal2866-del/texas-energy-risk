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
from fastapi import APIRouter, Body, Header, HTTPException, Query
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
        "Operations Manager", "Plant Manager", "Energy Manager",
        "Procurement Manager", "Facilities Manager", "VP Operations",
        "Director of Operations", "COO", "Energy Director",
    ]

    payload: dict = {
        "page":     req.page,
        "per_page": req.per_page,
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
            f"{APOLLO_BASE}/mixed_people/search",
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
]

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

    # Energy intensity by industry (0-35)
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
