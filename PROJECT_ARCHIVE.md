# Texas Grid Intel — Project Archive
**Last updated:** June 5, 2026 (session 9 — CRM outreach + Apollo email reveals)
**Current stable tag:** v5.6-stable
**Next session:** Monitor newsletter open rates; continue Apollo prospecting for Dallas/Austin cities
**Repository:** github.com/seal2866-del/texas-energy-risk
**Production URL:** https://texasgridintel.com

---

## COMPLETED TASKS

### Infrastructure & Backend
- [x] #1 Write scheduled reporting architecture spec
- [x] #2 Build HTML morning operational report template
- [x] #3 Build PDF conversion script (WeasyPrint)
- [x] #4 Build email delivery worker (Resend)
- [x] #5 Wire PDF reports to Business plan subscribers
- [x] #19 Build newsletter DB tables + generation backend
- [x] #20 Build newsletter frontend — signup form, admin pages
- [x] #26 Newsletter V3 redesign — executive operational briefing format
- [x] #27 Build Apollo.io prospecting integration
- [x] #28 Prospecting CRM Enhancement — 7 phases (pipeline, audiences, Resend sync, analytics)

### Dashboard — Executive Mode
- [x] #14 Build Executive/Analyst mode toggle + Operational Status Banner + Management Summary
- [x] #15 Build Executive Decision Card + KPI Row + Watch Today + Next Review + Cost Impact
- [x] #18 Executive Mode final refinement — larger decision card, escalation path, cleanup
- [x] #23 Executive Mode Optimization Sprint — 10 priorities (CurrentRecommendation, EscalationMeter, Analyst Notes)

### Dashboard — Analyst Mode
- [x] #16 Build WhyRiskIsLow + ScenarioAnalysis + RootCauseEngine
- [x] #17 Build TopRisks, TimeToThreshold, RiskMomentum, AlertPreview, RiskTimeline, AIInsightEngine
- [x] #24 Analyst Mode Redesign — SignalContributors, WhatChangedDetail, EscalationDrivers, ConfidenceBreakdown, CorrelationEngine, SignalTimeline
- [x] #25 Analyst Mode Phase 2 — RiskTrajectory, clean causality layout

### Dashboard — Widgets
- [x] #9  Add Recommended Actions + Impact Assessment panels
- [x] #10 Build EscalationTriggers component
- [x] #11 Build OperationalWatchList component
- [x] #12 Build CostExposure component
- [x] #13 Upgrade dashboard hierarchy + collapse duplicate AI sections

### Language & AI
- [x] #8  Rewrite AI brief to actionable operational language
- [x] #21 Transform platform language — advisory to operational awareness
- [x] #22 Complete language transformation (EscalationPath, ManagementSummary, Phase 2 & 4 engines)

### Prospecting CRM — v5.1 through v5.6 (Session 9)
- [x] #60 Add LinkedIn search button to every prospect card
        → Always visible; uses stored contact_linkedin URL or falls back to LinkedIn people search
        → URL: linkedin.com/search/results/people/?keywords={name}+{company}
        → Icon: Linkedin from lucide-react
- [x] #61 Add per-contact "Get Email" button (Apollo reveal)
        → POST /api/prospecting/prospects/{id}/reveal-email
        → Strategy 1: /people/{id}/reveal (Apollo ID-based, fastest)
        → Strategy 2: /people/match with apollo_person_id + reveal flag
        → Strategy 3: /people/match by name + company (works without stored ID)
        → On success: saves email + full name + linkedin_url back to DB
        → Costs 1 Apollo credit per reveal; returns cached if email already known
- [x] #62 Add select-all + bulk delete to prospect list
        → Checkbox on every card + "All" checkbox in filter bar
        → "Delete N" red button appears when any selected
        → Bulk deletes in parallel via Promise.all
- [x] #63 Add bulk "Add to Newsletter" button
        → "Newsletter N" blue button appears alongside Delete when prospects selected
        → Adds all selected to Resend subscriber list sequentially
        → Shows count of successfully added contacts
- [x] #64 Filter Apollo search to verified-email contacts only
        → contact_email_status_cd: ["verified", "likely to engage"]
        → Returns full-name contacts (first + last) with real emails
        → Replaced default titles with senior roles: Energy Manager, Director of Energy,
           VP Operations, COO, CFO, CEO, Risk Manager, Portfolio Manager etc.
- [x] #65 Fix newsletter generate_and_save_draft truncation
        → newsletter_service.py truncated at build_text_em (NTFS write bug)
        → Restored complete function tail from git history (652b237)
        → Includes full Supabase insert with html_content, text_content, ai_outlook
- [x] #66 Fix Apollo CSV import return statement truncation
        → prospecting.py truncated at "total_rows": imported + duplicates + skipped + l
        → Restored complete closing brace and return dict
- [x] #67 First real newsletter send — 71 delivered, 0 failed
        → 71 Texas energy operations contacts added via bulk Newsletter button
        → Contacts include: Texas Pipe & Supply, TARA Energy, USA Compression,
           Butch's Companies, Coterra Energy, Pilot Thomas Logistics, SM Energy etc.
        → Sent via Newsletter Admin → Generate Draft → Approve → Send Now

### Prospecting CRM — v4.1
- [x] #29 Add trading/energy industries to prospecting filters
        → Added: Energy Trading, Natural Gas Trading, Power Marketing, Power Generation, Energy Procurement
- [x] #30 Add trading job titles to prospecting filters
        → Added: Energy Trader, Gas Trader, Power Trader, Risk Manager, Market Analyst,
           Director of Energy Trading, VP Energy Trading, Portfolio Manager, Hedging Manager
- [x] #31 Update lead scoring for trading industries
        → Energy Trading: +20, Natural Gas Trading: +20, Power Marketing: +18, Energy Procurement: +18, Power Generation: +15
        → Trading/risk titles now score full 15pts on operational title relevance
- [x] #32 Add trading titles to Apollo default search list

### Domain Migration & SEO — v4.2
- [x] #33 Purchase and configure texasgridintel.com domain
        → Domain added to Vercel, SSL live
- [x] #34 Full SEO implementation
        → layout.tsx: title template, meta description, 17 keywords, canonical URL
        → Open Graph tags (og:title, og:description, og:image, og:locale, og:site_name)
        → Twitter card (summary_large_image)
        → JSON-LD structured data: WebSite + Organization + SoftwareApplication with pricing
        → robots: index/follow, dashboard/admin/prospecting blocked
        → sitemap.ts: dynamic sitemap.xml with all public routes + priority weights
        → robots.ts: robots.txt with allow/disallow rules
        → opengraph-image.tsx: auto-generated branded OG image (1200x630)
        → Per-page layouts: /pricing, /dashboard (noindex), /terms
- [x] #35 Update all hardcoded URLs to texasgridintel.com
        → backend/main.py: CORS origins updated
        → backend/services/alert_service.py: DASHBOARD_URL, ALERTS_URL
        → backend/services/newsletter_service.py: unsubscribe + dashboard links
        → backend/routers/prospecting.py: FRONTEND_URL fallback
        → backend/routers/newsletter.py: FRONTEND_URL fallback
- [x] #36 Update Railway FRONTEND_URL → https://texasgridintel.com
- [x] #37 Rebrand footer: TX Energy Risk → Texas Grid Intel
        → © Texas Grid Intel. All rights reserved.
        → support@txenergyrisk.com → support@texasgridintel.com
- [x] #38 Google Search Console verified (HTML tag method)
        → Verification token added to layout.tsx
        → Property: https://texasgridintel.com (URL prefix)
- [x] #39 Sitemap submitted to Google Search Console
        → https://texasgridintel.com/sitemap.xml submitted successfully
        → Google will crawl within 24–48 hours
- [x] #40 Add account settings page (/account)
        → Change password form with validation
        → Shows user name and email
        → Settings gear icon added to Navbar (desktop + mobile)
- [x] #41 Add forgot password flow
        → "Forgot password?" link on login page
        → Sends Supabase reset email with redirectTo texasgridintel.com/reset-password
        → /reset-password page handles new password entry + redirects to dashboard
- [x] #42 Fix Supabase URL configuration
        → Site URL updated to https://texasgridintel.com
        → Redirect URL https://texasgridintel.com/reset-password added
- [x] #43 Rebrand login page: TX Energy Risk → Texas Grid Intel

### Henry Hub Natural Gas Price — v4.5
- [x] #45 Add Henry Hub price fetcher (external_apis.py)
        → EIA v2 futures endpoint (RNGWHHD series) — confirmed working
        → Returns current price, daily/weekly % change, market state, watch threshold
        → 10-day price history for charting
        → Cached 4 hours. Never serves cached mock data.
- [x] #46 Add /api/gas/henry-hub endpoint + debug endpoint
        → GET /api/gas/henry-hub — live EIA data
        → GET /api/gas/henry-hub/debug — raw EIA strategy diagnostics
- [x] #47 Integrate Henry Hub into signal_engine.py
        → check_henry_hub() signal detector with 4 market states
        → _compute_henry_hub_exposure() for cost/operational exposure
        → Boosts supply_pressure when Henry Hub is triggered
        → Included in signal maps, escalation probability, cost exposure, AI brief
- [x] #48 Pass Henry Hub into signals router
        → Fetched in parallel with ERCOT, NOAA, EIA in signals.py
        → Passed into run_all_signals() as henry_hub_data param
- [x] #49 Build HenryHubWidget frontend component
        → Big price display (5xl, color-coded by market state)
        → 10-day SVG line chart with threshold bands at $3/$4/$6
        → Daily/weekly change chips with trend arrows
        → 4-state threshold ladder (Normal/Watch/Elevated/Critical)
        → Compact mode for strip display
        → "Daily EIA · Not Live" label clearly shown
- [x] #50 Add HenryHubData type to SignalsResponse in api.ts
        → Fixed TypeScript stripping henry_hub from signals response
- [x] #51 Wire Henry Hub into dashboards
        → Executive Mode: full widget above Risk Score
        → Analyst Mode: full widget above ERCOT Price Monitor
        → Removed duplicate from bottom of Analyst panel
- [x] #52 Fix EIA fetcher to use confirmed v2 futures endpoint
- [x] #53 Match ERCOT price font to Henry Hub (text-5xl font-black tracking-tight)
- [x] #54 Move Henry Hub to top of Executive + Analyst Mode (full widget, no compact)

### Operational Cost Impact Card — v4.6
- [x] #55 Build OperationalCostImpact widget
        → 3 facility tiers: Small Facility (0.5MW), Midstream Site (3MW), Large Plant (9.5MW)
        → Live calculation: ERCOT price × load × 24h + Henry Hub gas exposure
        → Demand multiplier: low×1.0 / medium×1.10 / high×1.25
        → Risk premium: low×1.0 / medium×1.07 / high×1.15
        → Progress bars per facility, cost breakdown (power vs gas)
        → "Based on" row: ERCOT $/MWh, Henry Hub $/MMBtu, demand level
        → Uplift warning when conditions add cost above baseline
        → Clearly labeled estimates — not financial advice
- [x] #56 Wire into Executive + Analyst Mode dashboards

### Scenario Modeling Panel — v4.7
- [x] #57 Build ScenarioModelingPanel widget
        → 6 scenarios: Current, HH+25%, HH+50%, ERCOT $50, ERCOT $100, Temp >100°F
        → Each scenario computes: Small/Midstream/Large facility daily costs
        → Risk level (low/medium/high), escalation probability %, operational exposure
        → Current → Forecast → Impact 3-column layout per scenario
        → Escalation probability bar (color-coded green/amber/red)
        → % delta vs current conditions per facility
        → Warning banner for medium/high risk scenarios
        → Collapsible accordion — click to expand/collapse each scenario
        → Fully reactive to live ERCOT price, Henry Hub, temp, demand level
- [x] #58 Wire into Executive + Analyst Mode dashboards
        → Positioned after Operational Cost Impact card in both modes
        → Positioned after Henry Hub widget in both modes
        → Passes live ERCOT price, Henry Hub price, demand level, risk score
        → Debug endpoint confirmed v2_futures works: $3.10/MMBtu
        → Strategy 1 now hits confirmed working endpoint first
        → Mock data never cached (re-fetches until real data available)

### Market States (Henry Hub)
- Normal:   < $3.00/MMBtu
- Watch:    $3.00–$4.00/MMBtu
- Elevated: $4.00–$6.00/MMBtu
- Critical: > $6.00/MMBtu

---

## PENDING TASKS

- [ ] #6  Setup Stripe test mode and verify Pro/Business checkout
        → Test card: 4242 4242 4242 4242
        → Pro price ID: price_1TcWGoBHRBiXHk4GqI5MgpSm
        → Business price ID: price_1TcWPBBHRBiXHk4GtgHeppBJ

- [ ] #7  Verify alert emails end-to-end
        → ALERT_FROM_EMAIL still using temporary address — update once txenergyrisk.com/texasgridintel.com email is configured in Resend
        → Switch to alerts@texasgridintel.com

- [x] #53 Apollo Basic plan upgrade ($49/mo) ✓ DONE
        → Subscribed — $49/mo, 2,525 credits/month
        → APOLLO_API_KEY set in Railway
        → Email reveals working via /people/match + /people/{id}/reveal

---

## NEXT SESSION PRIORITIES

### Funnel Status (as of June 5, 2026)
Apollo → Prospect → Newsletter → Demo → Customer
- **71 prospects** added to Resend and emailed (June 5, 2026)
- **0 demos** booked yet — monitor open rates in Resend dashboard
- Next step: expand search to Dallas, Austin, San Antonio cities

### Priority Task List
1. **Monitor newsletter open rates** — check Resend dashboard for opens/clicks from the 71 sent
2. **Expand Apollo search to more cities** — Dallas, Austin, San Antonio, Corpus Christi
3. **Apollo CSV import** — export from Apollo web UI for contacts API misses; import via Import button
4. **Demo request workflow** — automate demo booking and follow-up email
5. **Stripe subscriptions (#6)** — verify Pro/Business checkout end-to-end (test card: 4242 4242 4242 4242)
6. **Alert email** (#7) → switch to alerts@texasgridintel.com once domain email configured in Resend
7. **Search Console** → check pages discovered (sitemap submitted May 31)

### Known Issues / Watchlist
- NTFS truncation bug: All Python/TSX files >~9KB get silently truncated when written via MCP tools on Windows.
  Fix: always restore from git + append via Python binary write. Run ast.parse() after every backend edit.
- Apollo data quality: Smaller TX companies (ATNV Energy, Solea Energy etc.) have no last names or emails in Apollo DB.
  Fix: filter on contact_email_status_cd: ["verified"] — returns full-profile contacts.
- SMS (Twilio) test still pending — Twilio vars set in Railway but not verified end-to-end.

---

## ENVIRONMENT VARIABLES

### Railway (backend)
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- STRIPE_SECRET_KEY
- STRIPE_PRO_PRICE_ID = price_1TcWGoBHRBiXHk4GqI5MgpSm
- STRIPE_BUSINESS_PRICE_ID = price_1TcWPBBHRBiXHk4GtgHeppBJ
- STRIPE_WEBHOOK_SECRET
- ANTHROPIC_API_KEY
- EIA_API_KEY
- ERCOT_API_ENABLED = true
- NOAA_BASE_URL = https://api.weather.gov
- RESEND_API_KEY
- ALERT_FROM_EMAIL = (temp address — update to alerts@texasgridintel.com)
- FRONTEND_URL = https://texasgridintel.com ✓ UPDATED
- ENVIRONMENT = production
- APOLLO_API_KEY (set — needs Basic plan upgrade)
- NEWSLETTER_ADMIN_SECRET

### Vercel (frontend)
- NEXT_PUBLIC_API_URL = https://texas-energy-risk-production.up.railway.app
- NEXT_PUBLIC_STRIPE_PRO_PRICE_ID = price_1TcWGoBHRBiXHk4GqI5MgpSm
- NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID = price_1TcWPBBHRBiXHk4GtgHeppBJ

---

## EMAIL ADDRESSES

### Active (temporary)
- alerts@investorlens.capital — alert emails (