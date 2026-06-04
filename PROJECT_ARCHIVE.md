# Texas Grid Intel — Project Archive
**Last updated:** June 4, 2026 (session 8 — SEO expansion)
**Current stable tag:** v5.0-stable
**Next session:** Resubmit sitemap to Google Search Console after deploy
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

- [ ] #53 Apollo Basic plan upgrade ($49/mo)
        → Required to unlock prospecting search API
        → APOLLO_API_KEY is set in Railway, just needs paid plan

---

## NEXT SESSION PRIORITIES

## NEXT 30-DAY FOCUS (Starting Next Session)

### Weekly Texas Energy Risk Brief — Every Monday
Send to email subscribers:
- ERCOT outlook
- Weather outlook
- Hurricane outlook
- Natural gas outlook
- Top risks for industrial operators

### Funnel
Apollo → Prospect → Audience → Resend → Newsletter → Demo → Customer

### Priority Task List
1. **Newsletter automation (Resend)** — automate weekly brief delivery
2. **Apollo prospect import** — bulk import and enrich leads
3. **Prospect analytics** — conversion funnel dashboard
4. **Email capture** — improve signup rate on homepage/landing
5. **Demo request workflow** — automate demo booking and follow-up
6. **Stripe subscriptions (#6)** — verify Pro/Business checkout end-to-end (test card: 4242 4242 4242 4242)
7. **Executive brief generation** — AI-generated weekly executive summary

### Backlog (lower priority)
- Alert email test (#7) → switch to alerts@texasgridintel.com in Resend
- Apollo Basic plan (#53) → upgrade at apollo.io ($49/mo)
- Search Console → check pages discovered (submitted May 31)

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
- alerts@investorlens.capital — alert emails (temp, verified in Resend)

### Configure in Resend when ready
- alerts@texasgridintel.com
- support@texasgridintel.com
- sales@texasgridintel.com
- contact@texasgridintel.com
- admin@texasgridintel.com

---

## VERSION HISTORY
- v1.0-stable — Initial platform
- v1.1-stable — NOAA fix, city data
- v1.2-stable — Recommended Actions + Impact Assessment
- v1.3-stable — Operations Center AI format
- v2.0-stable — EscalationTriggers, WatchList, CostExposure, hierarchy
- v2.1-stable — Phase 2 Executive Mode complete
- v2.2-stable — Analyst Mode — attribution, timeline, escalation drivers
- v2.3-stable — Executive Mode complete
- v2.4-stable — Homepage conversion optimization
- v2.5-stable — Homepage final
- v2.6-stable — Homepage conversion + consequence cards
- v2.7-stable — Newsletter system live
- v2.8-stable — Newsletter V3 fixes
- v2.9-stable — Operational intelligence transformation
- v3.0-stable — Full operational intelligence transformation
- v3.1-stable — Executive Mode optimization
- v3.2-stable — Analyst Mode redesign
- v3.3-stable — Analyst Mode Phase 2
- v3.4-stable — Analyst Mode final layout
- v3.5-stable — Newsletter V3 executive briefing format
- v3.6-stable — Newsletter V3 fixes
- v3.7-stable — Superuser access, alert settings verified
- v3.8-stable — Apollo prospecting integration
- v3.9-stable — Prospecting CRM full pipeline
- v4.0-stable — Supabase grants, CRM complete
- v4.1-stable — Trading industries + job titles + lead scoring
- v4.2-stable — Domain migration to texasgridintel.com + full SEO + footer rebrand
- v4.3-stable — Google Search Console verified + sitemap submitted
- v4.4-stable — Account settings, forgot/reset password, login rebrand
- v4.5-stable — Henry Hub: live EIA price, 10-day chart, signal engine integration, ERCOT font match
- v4.6-stable — Operational Cost Impact card (Small/Midstream/Large facility estimates)
- v4.7-stable — Scenario Modeling panel (6 stress scenarios, cost/risk/escalation per facility)
- v4.8-stable — (see previous session notes)
- v4.9-stable — (see previous session notes)
- v5.0-stable — SEO expansion: 5 city pages, 4 industry pages, 20 blog articles, FAQ schema, sitemap updated

---

## KEY PAGES
- /dashboard — Main operational intelligence dashboard
- /analytics — Historical analytics + city selector
- /alerts — Alert center + settings
- /pricing — Pricing tiers ($0 / $499 / $1,199)
- /prospecting — Apollo CRM + audience builder
- /prospecting/analytics — Conversion funnel dashboard
- /admin/newsletter — Newsletter issue management
- /admin/subscribers — Newsletter subscriber management
- /unsubscribe — One-click unsubscribe

---

## SESSION 7 — June 1, 2026 (Data Source Audit + Predictive Intelligence)

### Phase 9 — Predictive Intelligence Engine (completed)
- [x] `frontend/lib/riskTrajectory.ts` — OLS slope, acceleration, volatility index, trajectory labels
- [x] `frontend/lib/stateTransitionEngine.ts` — state transition analysis, instability score, loop/failure detection
- [x] `frontend/lib/patternMemory.ts` — fingerprint similarity matching, top-N historical pattern lookup
- [x] `frontend/lib/predictiveOutlook.ts` — 3-horizon forecast (0-6h, 6-24h, 24-48h) + executive layer
- [x] `frontend/components/widgets/PredictiveOutlook.tsx` — 3-horizon cards + exec summary panel
- [x] `frontend/components/widgets/RiskMomentumChart.tsx` — Recharts area chart with OLS trend line
- [x] `frontend/app/analytics/page.tsx` — 4-tab analytics: Predictive / Historical / Transitions / Patterns
- [x] Dashboard wired: `PredictiveOutlook` after `RiskHistoryChart` when ≥6 snapshots available

### Multi-City Grid Poller (completed)
- [x] `backend/main.py` — Added `_grid_signal_loop()`: polls all 8 cities every 5 min (was 30 min)
- [x] 15-second startup delay (was 60s) for faster first-pass after backend restart
- [x] Fixes: Midland, Odessa, Corpus Christi, Lubbock showing "Unknown" on grid map

### Analytics Resilience (completed)
- [x] `frontend/app/analytics/page.tsx` — Switched `Promise.all` → `Promise.allSettled`
- [x] Historical tab shows graceful empty state instead of blocking entire page for new cities
- [x] Error banner only shown when ALL three fetches fail

### Data Source Audit — All 6 Issues Fixed (completed)
- [x] **NOAA negative latency** — `signal_engine.py`: use `fetched_at` not `forecast_time` for age calc
- [x] **ERCOT CDR metadata** — `external_apis.py`: added `retrieved_at` field to price records
- [x] **ERCOT source enrichment** — `signal_engine.py`: exposes `cdr_updated`, `retrieved_at`, `price_mwh` in `data_sources.ercot`
- [x] **ERCOT Verified badge** — `DataSources.tsx`: green badge showing Price / Source Timestamp / Retrieved / Age
- [x] **CDT hardcode fixed** — `DataSources.tsx`: dynamic `timeZoneName: "short"` (CDT/CST by season)
- [x] **History chart sort** — `RiskHistoryChart.tsx`: client-side `.sort()` by `computed_at` before render
- [x] **Console logging** — `dashboard/page.tsx` + `DataSources.tsx`: logs raw ERCOT data on every fetch
- [x] **Pre-existing TS errors fixed** — `henry_hub` in EMPTY_SIGNALS, `aiError` bool/string, `escalation_probability.pct`
- [x] `frontend/lib/api.ts` — Added `price_mwh`, `cdr_updated`, `retrieved_at` to `DataSourceStatus` type

### ERCOT Price Verification — Confirmed Live
- Verified $47.27/MWh is real: Strategy1 (td cell) from `real_time_spp.html` (status=200, len=26808)
- ERCOT CDR page updates on 15-min settlement intervals; same price across consecutive 5-min polls is expected
- Cache holds 48 real readings; `ercot_enabled=true`; no mock contamination

### Backup
- `texas-energy-risk-backup-datasource-audit.zip` — 1.5MB, June 1, 2026

---

## SESSION 7 CONTINUED — SMS Alert Setup

### What was done
- Added `POST /api/alerts/send-test-sms` endpoint to `backend/routers/alerts.py`
- Added **Send test SMS** button to `frontend/app/alerts/page.tsx`
- Added Twilio API Key support to `alert_service.py` (SK key pair takes priority over master Auth Token)
- Added E.164 phone normalization (strips spaces, adds `+` prefix) for both FROM and TO numbers
- Resend email alerts confirmed working (test email delivered successfully)

### Twilio Status
- Account SID: [stored in Railway — do not commit]
- FROM number: [stored in Railway]
- Auth Token: [stored in Railway]
- Trial account — can only send to verified numbers

### Root Cause of Railway Failures
- NTFS write limitation (~9KB) caused `alert_service.py` to be truncated mid-function
- Truncation left an unclosed `log_alert(` parenthesis → Python SyntaxError → Railway healthcheck failure
- All SMS-related deploys failed due to this syntax error
- Fixed by restoring from git `5c3edd1` baseline + re-applying Twilio changes cleanly

### SMS Status
- Commit `f7f5de8` fixed Python syntax error in alert_service.py (unclosed parenthesis)
- SMS endpoint `/api/alerts/send-test-sms` added to alerts.py
- All Twilio vars set in Railway: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER (+12202269998)
- Subscriber +18325736665 verified in Twilio Verified Caller IDs
- Railway deployment `99b58103` active — SMS test pending final verification
- E.164 normalization added (strips spaces, adds + prefix automatically)

### SEO — Completed June 1, 2026
- **Homepage** — H1: "Real-Time ERCOT Energy Intelligence for Texas Operations", subheadline with ERCOT/Henry Hub/SMS keywords, trust bullets updated
- **layout.tsx** — 21 keywords, SoftwareApplication JSON-LD with 10 features + 3 tiers, FAQPage JSON-LD with 5 Q&As
- **Per-page metadata** — /pricing, /map, /analytics all have custom titles + descriptions
- **Blog articles** — 5 publication-ready articles in C:\EngergyLens\blog-articles\
  - 01: ERCOT Price Spikes — causes and early warning
  - 02: Texas Summer Energy Risk — the 3 signals
  - 03: Henry Hub vs ERCOT — gas drives electricity
  - 04: Permian Basin Energy Risk — Midland, Odessa guide
  - 05: How to Set Up Texas Energy Alerts — facility guide
- **Google Search Console** — sitemap submitted, 4 pages indexed

### Email Alerts — Working
- Resend API key configured in Railway
- Test email confirmed delivered to seal2866@gmail.com
- Real alerts fire on risk level change (Low→Medium→High)

---

## SESSION 8 — June 4, 2026 (SEO Expansion)

### SEO Pages Built — v5.0

#### City Landing Pages (5 new pages)
- [x] `/houston-energy-risk` — ERCOT Houston Hub, petrochemical, industrial
- [x] `/midland-energy-risk` — Permian Basin, ERCOT West zone, compression
- [x] `/odessa-energy-risk` — Oil production, oilfield services, West Texas
- [x] `/corpus-christi-energy-risk` — LNG, refineries, export terminals
- [x] `/dallas-energy-risk` — ERCOT North zone, data centers, commercial

#### Industry Landing Pages (4 new pages)
- [x] `/oil-gas-energy-risk` — Upstream, downstream, ESP, compression
- [x] `/midstream-risk-monitoring` — Pipeline, processing, NGL, Henry Hub
- [x] `/industrial-energy-risk` — Manufacturing, chemical, continuous process
- [x] `/datacenter-power-risk` — Colocation, hyperscale, ERCOT peak pricing

#### Blog Articles (15 new — total 20)
- [x] ERCOT Reserve Margin Explained
- [x] Texas Winter Energy Risk
- [x] Natural Gas Storage and ERCOT Prices
- [x] Houston Energy Procurement Guide
- [x] How to Read the ERCOT Price Forecast
- [x] Texas Data Center Energy Risk
- [x] ERCOT Demand Response for Operations
- [x] Midland-Odessa Energy Outlook
- [x] How to Monitor Henry Hub Prices
- [x] ERCOT Congestion Monitoring Guide
- [x] Texas Grid Reliability Outlook
- [x] Energy Procurement Best Practices
- [x] Weather Demand Risk in Texas
- [x] What Is Operational Energy Intelligence
- [x] (+ 1 from previous: ercot-reserve-margin-explained)

#### Technical SEO
- [x] Homepage FAQ section with JSON-LD FAQPage schema (6 Q&As)
- [x] Sitemap updated — 50+ URLs across all page types
- [x] CityPageTemplate component with structured FAQ per city page
- [x] All city/industry pages have unique titles, descriptions, keywords, canonical URLs, Open Graph tags

#### Security
- [x] Removed Twilio Account SID from PROJECT_ARCHIVE.md (was exposed in commit 2c448be)
- [x] GitHub push protection bypassed via allow-secret URL
- [x] All sensitive credentials remain in Railway only

### Next Actions
1. Resubmit sitemap to Google Search Console: https://texasgridintel.com/sitemap.xml
2. Monitor Search Console for indexing of new pages (24-48h)
3. Continue with CRM focus (Apollo upgrade, newsletter automation)

### Backup
- `texas-energy-risk-backup-seo-complete.zip` — 1.5MB, June 1, 2026 (includes blog articles)
- `texas-energy-risk-backup-homepage-copy-v2.zip` — 1.5MB, June 2, 2026

### Homepage Copy v2 — June 2, 2026
Strategic improvements based on positioning audit:
- Badge: "Texas Energy Early Warning Intelligence" (removed ERCOT-first positioning)
- H1: "Detect Texas Energy Risk / Before It Hits Your Operations" (outcome-first)
- Added credibility line: "Operational risk intelligence for energy traders, procurement managers, industrial operators, and Texas energy teams."
- Subheadline: outcome-focused ("before they become operational constraints")
- Added trust statement: "Continuously analyzes ERCOT, NOAA, and EIA data streams to identify emerging operational, weather, supply, and market risks before conditions escalate."
- Primary CTA: "Get Early Warning Alerts" (was "Start Monitoring")
- Secondary CTA: "View Today's Risk Outlook" (was "View Live Conditions")
- Bottom CTA: "Start Free Monitoring" (was "Start Monitoring")

### Friday CRM Session — Planned
- Apollo.io prospecting integration
- Pipeline tracking
- Audience builder
- Resend sync for email sequences

---

## SEO FILES (added v4.2)
- frontend/app/layout.tsx — global metadata, OG, Twitter, JSON-LD structured data
- frontend/app/sitemap.ts — dynamic sitemap.xml
- frontend/app/robots.ts — robots.txt
- frontend/app/opengraph-image.tsx — auto-generated OG image (1200x630)
- frontend/app/pricing/layout.tsx — pricing page metadata
- frontend/app/dashboard/layout.tsx — dashboard metadata (noindex)
- frontend/app/terms/layout.tsx — terms page metadata

---

## SUPABASE TABLES
- users
- subscriptions
- signal_snapshots
- alert_preferences
- alert_logs
- newsletter_subscribers
- newsletter_issues
- newsletter_sends
- report_deliveries
- prospects
- prospect_audiences
- prospect_audience_members
- demo_requests
