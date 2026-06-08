# Texas Grid Intel — Project Archive
**Last updated:** June 8, 2026 (session 11 — Send Campaign + Weekly Newsletter automation)
**Current stable tag:** v6.5-stable
**Next session:** Monitor newsletter open rates; Resend webhook for auto open/click CRM tracking; expand Apollo to Dallas/Austin; clean up duplicate June 08 test drafts
**Repository:** github.com/seal2866-del/texas-energy-risk
**Production URL:** https://texasgridintel.com

---

## COMPLETED TASKS

### Session 11 — Send Campaign + Newsletter Automation (June 8, 2026)
- [x] Built `POST /api/prospecting/send-newsletter` endpoint
  - Sends personalised HTML email to all `newsletter_added` prospects via Resend
  - Supports `{{first_name}}` and `{{company}}` merge tags
  - Rate limited: 3 emails/sec with asyncio.sleep to stay under Resend 5 req/sec limit
  - Updates each sent prospect status → `newsletter_sent`
  - `RESEND_FROM_EMAIL` env var for configurable sender address
- [x] Built Send Campaign modal in CRM frontend
  - Subject line input, HTML body editor, live Preview toggle
  - Pre-filled default email template with merge tags
  - Shows live recipient count (newsletter_added prospects)
  - Result banner with sent/failed counts
  - Fixed stale `}}` JSX syntax bug on Request Demo block
- [x] Verified `texasgridintel.com` domain in Resend (DNS + DKIM verified)
- [x] First successful send: **71 of 71 emails delivered** from `alerts@texasgridintel.com`
- [x] All 71 prospects auto-updated to `newsletter_sent` status
- [x] Weekly newsletter auto-generation improved
  - `generate_and_save_draft()` now pulls live hub prices (HB_HOUSTON/NORTH/WEST), Henry Hub price + change %, grid demand GW, reserve %, wind %, solar %
  - AI prompt uses live figures so each week's content is genuinely different
  - Fixed field mapping: `exec_outlook` → `executive_summary`, `what_changed_explanation` → `what_changed`
  - Industry spotlight rotates by ISO week number (6 industries cycling)
- [x] Scheduled task: auto-generates draft every Monday 7am, notifies on completion
- [x] Test email verified in Yahoo inbox — all 8 sections rendering correctly

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

### Trader Features — v6.1 (Session 10, in progress)
- [x] #77 ERCOT Grid Status / EEA Emergency Tracker
        → backend/services/grid_conditions.py — parses real_time_system_conditions.html
        → GET /api/ercot/grid — reserve margin, EEA level, wind/solar mix, frequency
        → EEATracker.tsx — escalation ladder, demand/reserve/capacity GW, generation mix
        → EEA levels: Normal → Watch → Warning → Emergency 1/2/3
        → Low wind (<15%) alert, frequency deviation flag
- [x] #78 Multi-Hub Price Spread Monitor
        → Uses fetch_all_hub_prices() from external_apis.py (already working)
        → MultiHubSpread.tsx — HB_NORTH/SOUTH/WEST/BUSAVG vs HB_HOUSTON
        → WIDE badge when spread >$15, West Hub insight (wind vs congestion)
        → Fixed: was using broken custom parser → switched to existing working function
- [x] #79 Optimal Load Window (Load Optimizer)
        → backend/services/load_optimizer.py — 48h hourly price model
        → Hour multipliers by CT hour (overnight low, afternoon peak)
        → Temperature multiplier (100°F→+28%, freeze→+35%)
        → Finds cheapest 2h/4h/6h consecutive windows
        → GET /api/signals/load-optimizer
        → LoadOptimizer.tsx — shows top 4 windows with % savings vs current RT
- [x] #80 DAM vs Real-Time Spread
        → backend/services/dam_tracker.py — parses ERCOT DAM SPP page (posts ~2PM CT daily)
        → Signal: LOCK IN / STAY FLOATING / MONITOR with rationale
        → GET /api/signals/dam — cached 1 hour
        → DAMTracker.tsx — lock-in signal, RT vs DAM price comparison, peak/cheap hours
        → Shows "Not Yet Posted" gracefully before 2PM CT
- [x] #81 Multi-Hub Spread — 3 parser iterations until correct
        → v1: broken custom regex (returned Houston price for all hubs)
        → v2: pipe-based markdown parser (failed on real HTML)
        → v3: HTML table parser with <tr>/<td> regex (wrong column mapping → $830 bug)
        → v4 (final): scan all <tr> rows for 7+ numeric <td> cells, read by fixed column offset
           col 0=HB_BUSAVG, 1=HB_HOUSTON, 3=HB_NORTH, 5=HB_SOUTH, 6=HB_WEST
        → Verified live: HB_HOUSTON $30.72, South $28.39, West $28.90, North $29.00
        → WIDE alert triggers when spread >$15 (e.g. wind curtailment events)

### Full Threshold Audit — v6.0 (Session 10)
- [x] #74 Full data/threshold audit across all backend + frontend components
        → Backend (signal_engine.py) authoritative thresholds:
           PRICE: Normal<$70(exit)/$75(enter) · Watch $75-$150 · Elevated $150-$300 · High $300-$1000 · Critical>$1000
           TEMP:  Watch >=100°F (TEMP_HIGH_THRESHOLD_F)
           HH:    Normal $3.00 baseline · Watch $4.00 · Elevated $6.00 · Critical >$6.00
           GAS:   Alert <= -10% vs 5yr avg
        → Frontend mismatches found and fixed (19 components):
           - Henry Hub watch threshold: $3.00 → $4.00/MMBtu
             Files: AIChatAssistant, AlertPreview, CurrentRecommendation, EscalationDrivers,
             EscalationPath, EscalationTriggers, MonitoringPriorities, NextReview,
             OperationalSignificance, OperationalWatchList, TopRisks
           - Temperature watch threshold: 95°F → 100°F
             Files: AIChatAssistant, AlertPreview, CurrentRecommendation, EscalationDrivers,
             EscalationMeter, EscalationPath, EscalationTriggers, ExecutiveRecommendations,
             MonitoringPriorities, NextReview, OperationalSignificance, OperationalWatchList,
             TexasThreatCenter, TopRisks, CustomerWatchlist
        → HenryHubWidget tier labels ($3/$4/$6 band display) — CORRECT, intentional, kept
        → TexasThreatCenter 95°F intermediate ELEVATED tier — intentional, kept
- [x] #75 Customer Value / ROI panel added to dashboard (Executive + Analyst modes)
        → Metric cards: Avoided Exposure / Early Warnings / AI Recommendations / Cost Avoidance
        → Values scale dynamically with live ERCOT price and active signal count
        → Disclaimer: illustrative estimate, not financial advice
        → Added to homepage above Final CTA also
- [x] #76 Forecast Risk Outlook repositioned to #2 on dashboard (after Executive Summary)
        → Previous position: #4 (after Current Conditions + Recommendation)
        → New position: #2 — immediately after Executive Summary

### Forecast Risk Outlook — v5.9 (Session 10)
- [x] #73 Build Forecast Risk Outlook panel — Priority 1 feature
        → New file: backend/services/forecast_engine.py
           - _compute_24h(): price momentum + tomorrow temp + Henry Hub
           - _compute_72h(): 3-day temp forecast + storage trajectory + HH weekly trend
           - _compute_7d(): 7-day NOAA + EIA storage multi-week + Henry Hub sustained
           - _generate_narrative(): Claude Haiku 3-sentence "What happens next" AI brief
           - _fallback_narrative(): rule-based fallback if AI unavailable
           - 15-minute cache — AI fires only on stale cache
        → New endpoint: GET /api/signals/forecast?location=Houston
           - Fetches ERCOT (6h), NOAA (7d), gas (4wk), Henry Hub in parallel
           - Returns: horizons[24h/72h/7d], narrative, overall_risk, computed_at
        → New component: frontend/components/widgets/ForecastRiskOutlook.tsx
           - Summary strip: 24H | 72H | 7D risk tier at a glance
           - AI narrative box: "What Happens Next" with 3-sentence Claude output
           - Expandable horizon cards with risk drivers + confidence bar
           - Auto-refreshes every 15 minutes
           - Refresh button top-right
        → Wired into dashboard at TOP of both Executive and Analyst modes
        → Risk levels: LOW / WATCH / ELEVATED / HIGH (matches new thresholds)
        → Bug fixed: selectedCity → location variable (caused client crash on deploy)

### ERCOT Thresholds, Hysteresis & Henry Hub Fix — v5.7–v5.8 (Session 10)
- [x] #69 Remove all legacy $35/MWh threshold references across 21 frontend components
        → Standardized to $75 Watch, $150 Elevated everywhere
        → Files: AIChatAssistant, AlertPreview, CostExposure, CostImpact, CurrentRecommendation,
          CustomerWatchlist, DailyExecutiveBrief, EscalationDrivers, EscalationMeter, EscalationPath,
          EscalationTriggers, ExecutiveDecisionCard, ExecutiveKPIRow, ExecutiveRecommendations,
          MonitoringPriorities, NextReview, OperationalSignificance, OperationalWatchList,
          PotentialImpact, ScenarioAnalysis, TexasThreatCenter
- [x] #70 Add ERCOT price hysteresis to prevent status flapping
        → Enter WATCH at $75 (rising edge)
        → Exit WATCH below $70 (falling edge)
        → Dead band $70–$75: hold current state, no flip
        → Implemented in both signal_engine.py and ERCOTPriceMonitor.tsx
- [x] #71 Restore henry_hub raw data in signals API response
        → "henry_hub": henry_hub_data was dropped during truncation restore
        → HenryHubWidget was receiving null and showing blank skeleton
        → Fixed: re-added "henry_hub": henry_hub_data to run_all_signals return dict
- [x] #72 Establish truncation prevention rule
        → All backend Python file writes now use bash shell + Python (never Edit/Write MCP tools)
        → ast.parse() check runs on ALL backend files before every git commit
        → Keyword: say "truncation" if Railway crashes after a backend change

### ERCOT Price Threshold Calibration — v5.7 (Session 10)
- [x] #68 Recalibrate ERCOT price thresholds to reflect actual Texas market conditions
        → Previous: Watch=$35, Elevated=$50 (generating false positives at normal $75/MWh prices)
        → New tiers: Normal 0-$75 · Watch $75-$150 · Elevated $150-$300 · High $300-$1,000 · Critical >$1,000
        → Backend (signal_engine.py):
           - PRICE_WATCH=$75, PRICE_ELEVATED=$150, PRICE_HIGH=$300, PRICE_CRITICAL=$1,000
           - PRICE_SPIKE_THRESHOLD_PCT raised 50%→100% (reduces false volatility flags)
           - Extreme price event trigger raised $500→$1,000
           - "Approaching threshold" band now starts at $75 (Watch) not $105 (0.7×$150)
           - Price alone does NOT trigger elevated operational risk below $150/MWh
        → Frontend (ERCOTPriceMonitor.tsx):
           - Price number color: white(Normal) → amber(Watch) → orange(Elevated) → red(High) → purple(Critical)
           - Status badge shows tier label: "WATCH — Normal Market Range" etc.
           - Chart reference lines at $75, $150, $300 appear dynamically
        → Verified: $75.50 now correctly shows WATCH (amber), not false Elevated alarm

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

### Funnel Status (as of June 6, 2026)
- 71 prospects emailed via newsletter (June 5)
- Monitor open rates in Resend dashboard
- Expand Apollo search to Dallas, Austin, San Antonio

### Trader Features — Next Up
- **Waha vs Henry Hub basis spread** — Texas-specific gas pipeline constraint signal
- **Contract lock-in signal** — forward price vs current volatility recommendation
- **ERCOT hourly load shape** — which hours will spike tomorrow
- **Renewable curtailment alert** — wind drops below 15% of load → price spike risk

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
- v5.1-stable — LinkedIn search button on every prospect card
- v5.2-stable — Apollo per-contact email reveal (Get Email button, 3-strategy fallback)
- v5.3-stable — Select-all + bulk delete for prospect list
- v5.4-stable — Bulk "Add to Newsletter" button
- v5.5-stable — Apollo search filtered to verified-email contacts (full names + real emails)
- v5.6-stable — Newsletter generate_and_save_draft fix + CSV import fix; 71 contacts emailed successfully
- v5.7-stable — ERCOT price threshold calibration: Normal<$75, Watch $75-150, Elevated $150-300, High $300-1000, Critical>$1000
- v5.8-stable — Hysteresis ($70 exit / $75 enter), removed all legacy $35 refs across 21 components, restored henry_hub raw data in signals response
- v5.9-stable — Forecast Risk Outlook panel: 24h/72h/7-day AI risk outlook, Claude Haiku narrative, Priority 1 feature
- v6.0-stable — Customer ROI panel on dashboard, full threshold audit (HH $3→$4, Temp 95°F→100°F, 19 components fixed)
- v6.1-stable — EEA Tracker, Multi-Hub Spread Monitor, Load Optimizer, DAM Tracker (all 4 trader features live)
- v6.2-stable — Hub spread parser fixed (HTML <td> column offset approach), all hubs showing correct live prices
- v6.3-stable — DAM Tracker shows live RT price while awaiting 2PM CT DAM results

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