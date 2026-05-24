# Texas Energy Risk Alert Platform — Setup Guide

## Project Structure

```
texas-energy-risk/
├── frontend/          # Next.js 14 app (deploy to Vercel)
├── backend/           # FastAPI (deploy to Railway)
├── database/          # Supabase SQL schema
└── docs/              # This file
```

---

## Step 1 — Supabase

1. Create a new project at https://supabase.com
2. Go to **SQL Editor** and paste the contents of `database/schema.sql`
3. Run the query — all 8 tables are created with RLS policies and mock seed data
4. Copy your **Project URL** and **anon key** (Settings > API)
5. Copy your **service role key** (Settings > API — keep this secret)

---

## Step 2 — Stripe

1. Create a product in https://dashboard.stripe.com
   - Name: "Texas Energy Risk Pro"
   - Price: $49/month (recurring)
   - Note the **Price ID** (starts with `price_...`)
2. Copy your **publishable key** and **secret key**
3. Set up a webhook:
   - URL: `https://your-railway-app.railway.app/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   - Copy the **webhook signing secret** (`whsec_...`)

---

## Step 3 — EIA API Key (optional — mock data works without it)

1. Register at https://www.eia.gov/opendata/
2. Copy your API key
3. Add to backend `.env` as `EIA_API_KEY=...`

---

## Step 4 — Backend (Railway)

1. Push the `backend/` folder to a GitHub repo
2. Create a new Railway project → Deploy from GitHub → select backend repo
3. Add the following environment variables in Railway:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=...
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRO_PRICE_ID=price_...
   EIA_API_KEY=...           (optional)
   ERCOT_API_ENABLED=false   (set true when you have ERCOT access)
   FRONTEND_URL=https://your-vercel-app.vercel.app
   ENVIRONMENT=production
   ```
4. Railway will auto-detect Python and run `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Note your Railway URL (e.g., `https://texas-risk-backend.railway.app`)

---

## Step 5 — Frontend (Vercel)

1. Push the `frontend/` folder to a GitHub repo
2. Import the repo at https://vercel.com/new
3. Add these environment variables in Vercel project settings:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   NEXT_PUBLIC_API_URL=https://your-railway-app.railway.app
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PRO_PRICE_ID=price_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
4. Deploy — Vercel handles the rest

---

## Step 6 — Supabase Auth redirect URLs

In Supabase → Authentication → URL Configuration:
- Site URL: `https://your-vercel-app.vercel.app`
- Redirect URLs: `https://your-vercel-app.vercel.app/**`

---

## Local Development

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # fill in your values
uvicorn main:app --reload --port 8000
```
API docs at http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local   # fill in your values
npm run dev
```
App at http://localhost:3000

---

## Connecting Real APIs

### ERCOT
ERCOT market data is available to registered market participants through the ERCOT MIS (Market Information System) portal. When you have access:
1. Set `ERCOT_API_ENABLED=true` in Railway env
2. Implement the authenticated request in `backend/services/external_apis.py` under the `fetch_ercot_prices` function (placeholder is marked)

### NOAA/NWS
The NOAA API is free and public. Set `NOAA_BASE_URL=https://api.weather.gov` in your backend env — the integration code is already written in `external_apis.py`.

### EIA
Add your `EIA_API_KEY` to the backend env — the integration code is already written and will automatically use live data.

---

## Signal Logic Reference

| Signal              | Trigger condition                                     | Severity |
|---------------------|-------------------------------------------------------|----------|
| Price volatility    | Price change >50% in 1hr OR absolute >$150/MWh       | Medium/High |
| Weather demand      | Forecast high ≥100°F OR forecast low ≤28°F           | Medium/High |
| Gas supply          | Storage >10% below 5-year average                    | Medium/High |
| **Risk Score HIGH** | **2 or more signals triggered simultaneously**        | **High** |
| Risk Score MEDIUM   | 1 signal triggered                                    | Medium |
| Risk Score LOW      | 0 signals triggered                                   | Low |

---

## Legal

All outputs from this platform are informational only. The platform does not provide investment, trading, financial, or procurement advice. See `frontend/app/terms/page.tsx` for full disclaimer.
