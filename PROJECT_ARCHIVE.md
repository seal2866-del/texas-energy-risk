# TX Energy Risk — Project Archive
**Last updated:** May 30, 2026
**Current stable tag:** v4.0-stable
**Repository:** github.com/seal2866-del/texas-energy-risk

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

---

## PENDING TASKS

- [ ] #6  Setup Stripe test mode and verify Pro/Business checkout
        → Needs txenergyrisk.com domain first
        → Test card: 4242 4242 4242 4242
        → Pro price ID: price_1TcWGoBHRBiXHk4GqI5MgpSm
        → Business price ID: price_1TcWPBBHRBiXHk4GtgHeppBJ

- [ ] #7  Verify alert emails end-to-end
        → alert@investorlens.capital is verified in Resend (temporary)
        → Switch to alerts@txenergyrisk.com once domain is added

---

## NEXT SESSION PRIORITIES

1. **Apollo Basic plan** ($49/mo) → unlocks prospecting search API
2. **txenergyrisk.com domain** → add to Resend, update ALERT_FROM_EMAIL in Railway
3. **Stripe test mode** → verify Pro/Business checkout end-to-end
4. **Alert email test** → set low threshold, confirm email fires

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
- ALERT_FROM_EMAIL = alerts@investorlens.capital (temp — switch to txenergyrisk.com)
- FRONTEND_URL = https://texas-energy-risk.vercel.app
- ENVIRONMENT = production
- APOLLO_API_KEY (set — needs Basic plan upgrade)
- NEWSLETTER_ADMIN_SECRET

### Vercel (frontend)
- NEXT_PUBLIC_API_URL = https://texas-energy-risk-production.up.railway.app
- NEXT_PUBLIC_STRIPE_PRO_PRICE_ID = price_1TcWGoBHRBiXHk4GqI5MgpSm
- NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID = price_1TcWPBBHRBiXHk4GtgHeppBJ

---

## EMAIL ADDRESSES (configure when domain ready)
- alerts@txenergyrisk.com
- support@txenergyrisk.com
- sales@txenergyrisk.com
- contact@txenergyrisk.com
- admin@txenergyrisk.com

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
