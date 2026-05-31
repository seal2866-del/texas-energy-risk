# Texas Grid Intel — Project Archive
**Last updated:** May 31, 2026 (session 4)
**Current stable tag:** v4.5-stable
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

1. **Stripe test mode (#6)** → verify Pro/Business checkout end-to-end
2. **Alert email test (#7)** → set low threshold, confirm email fires, update to alerts@texasgridintel.com in Resend
3. **Apollo Basic plan (#53)** → upgrade to unlock prospecting search API
4. **Search Console** → check pages discovered (submitted May 31)

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
