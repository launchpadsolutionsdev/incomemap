# IncomeMap — Project Prompt

## What is this?

IncomeMap (incomemap.ca) is a dividend tracking web application built specifically for Canadian investors. It lets users input their holdings, see their projected annual dividend income, model DRIP compounding over time, and track payments across TFSA, RRSP, and non-registered accounts. It handles both TSX-listed and US-listed ETFs with automatic USD/CAD conversion.

**Tagline:** Map your path to financial freedom

---

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Hosting:** Render (web service + managed PostgreSQL)
- **Auth:** Google Sign-In (OAuth 2.0 via Google Cloud Console)
- **Market Data API:** Financial Modeling Prep (FMP) — https://site.financialmodelingprep.com/developer/docs
- **Currency Data:** Bank of Canada Valet API — https://www.bankofcanada.ca/valet/
- **Frontend:** Server-rendered HTML with vanilla JS (same pattern as Lightspeed — no React framework needed)
- **Charts:** Chart.js for data visualization

---

## Environment Variables Required

These will be set in Render's environment configuration:

```
DATABASE_URL=            # Render PostgreSQL connection string
GOOGLE_CLIENT_ID=        # Google OAuth client ID
GOOGLE_CLIENT_SECRET=    # Google OAuth client secret
FMP_API_KEY=             # Financial Modeling Prep API key
SESSION_SECRET=          # Random string for session encryption
NODE_ENV=production      # Environment flag
BASE_URL=                # https://incomemap.ca (used for OAuth callback)
```

---

## Database Schema

### users
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### portfolios
```sql
CREATE TABLE portfolios (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL, -- 'TFSA', 'RRSP', 'Non-Registered'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### holdings
```sql
CREATE TABLE holdings (
    id SERIAL PRIMARY KEY,
    portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    exchange VARCHAR(10) NOT NULL, -- 'TSX', 'NYSE', 'NASDAQ'
    shares DECIMAL(12,4) NOT NULL,
    avg_cost DECIMAL(12,4) NOT NULL, -- average cost per share in native currency
    currency VARCHAR(3) DEFAULT 'CAD', -- 'CAD' or 'USD'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### dividend_cache
```sql
CREATE TABLE dividend_cache (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) NOT NULL,
    exchange VARCHAR(10) NOT NULL,
    dividend_amount DECIMAL(12,6), -- per share, in native currency
    dividend_yield DECIMAL(8,6),
    frequency VARCHAR(20), -- 'Monthly', 'Quarterly', 'Annual', 'Semi-Annual'
    ex_date DATE,
    payment_date DATE,
    annual_dividend DECIMAL(12,6), -- indicated annual dividend per share
    last_updated TIMESTAMP DEFAULT NOW(),
    UNIQUE(ticker, exchange)
);
```

### dividend_history
```sql
CREATE TABLE dividend_history (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) NOT NULL,
    exchange VARCHAR(10) NOT NULL,
    amount DECIMAL(12,6) NOT NULL,
    ex_date DATE NOT NULL,
    payment_date DATE,
    currency VARCHAR(3) DEFAULT 'CAD',
    last_updated TIMESTAMP DEFAULT NOW()
);
```

### forex_cache
```sql
CREATE TABLE forex_cache (
    id SERIAL PRIMARY KEY,
    pair VARCHAR(10) NOT NULL, -- 'USD/CAD'
    rate DECIMAL(12,6) NOT NULL,
    date DATE NOT NULL,
    source VARCHAR(50) DEFAULT 'Bank of Canada',
    last_updated TIMESTAMP DEFAULT NOW(),
    UNIQUE(pair, date)
);
```

---

## Project Structure

```
incomemap/
├── server.js                  # Express app entry point
├── package.json
├── .env                       # Local env vars (not committed)
├── db/
│   ├── pool.js                # PostgreSQL connection pool
│   └── schema.sql             # All CREATE TABLE statements
├── routes/
│   ├── auth.js                # Google OAuth routes
│   ├── dashboard.js           # Main dashboard page
│   ├── portfolios.js          # Portfolio CRUD
│   ├── holdings.js            # Holdings CRUD
│   ├── projections.js         # DRIP projection calculator
│   └── api.js                 # Internal API endpoints (JSON)
├── services/
│   ├── fmp.js                 # Financial Modeling Prep API client
│   ├── forex.js               # Bank of Canada forex service
│   ├── dividends.js           # Dividend data aggregation logic
│   └── projections.js         # DRIP compounding math
├── middleware/
│   ├── auth.js                # Authentication middleware
│   └── errors.js              # Error handling
├── public/
│   ├── css/
│   │   └── style.css          # All styles (brand colors as CSS vars)
│   ├── js/
│   │   └── app.js             # Client-side JS
│   └── images/
├── views/
│   ├── layout.html            # Base HTML template
│   ├── landing.html           # Public landing page
│   ├── dashboard.html         # Main dashboard (authenticated)
│   ├── holdings.html          # Holdings management
│   ├── calendar.html          # Dividend calendar view
│   ├── projections.html       # DRIP projection tool
│   └── yield-tracker.html     # Yield on cost tracker
└── README.md
```

---

## Brand / Design System

### CSS Variables (put these at the top of style.css)

```css
:root {
    /* Forest green */
    --im-green-900: #1A3C2A;
    --im-green-700: #2D6B4F;
    --im-green-500: #4A9E74;
    --im-green-300: #6BAF8D;
    --im-green-100: #D4E8DC;
    --im-green-50: #EDF5F0;

    /* Cream */
    --im-cream-50: #FDFAF3;
    --im-cream-100: #F5F0E8;
    --im-cream-300: #E8E0D3;
    --im-cream-500: #B5AA9A;
    --im-cream-700: #8A7F72;
    --im-cream-900: #5A5245;

    /* Accent */
    --im-accent: #C4883A;

    /* Semantic shortcuts */
    --im-bg: var(--im-cream-50);
    --im-surface: var(--im-cream-100);
    --im-border: var(--im-cream-300);
    --im-text: var(--im-cream-900);
    --im-text-muted: var(--im-cream-700);
    --im-primary: var(--im-green-700);
    --im-sidebar: var(--im-green-900);
}
```

### Typography

- **Headings / wordmark:** Georgia or serif stack — `font-family: Georgia, 'Times New Roman', serif;`
- **Body / UI:** System sans — `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;`
- **Data / numbers:** Monospace — `font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;`

### Design Principles

- Clean and minimal — Wealthsimple-inspired, lots of whitespace
- Page background: var(--im-bg) cream
- Card surfaces: var(--im-surface)
- Sidebar: var(--im-sidebar) dark green
- Primary buttons: var(--im-primary) green with white text
- CTA / accent buttons: var(--im-accent) gold with white text
- Financial numbers always use monospace font
- Border radius: 10px for cards, 8px for buttons, 6px for inputs
- Borders: 0.5px solid var(--im-border)
- The wordmark "incomemap" is always lowercase serif

---

## Core Features (MVP)

### 1. Landing Page (unauthenticated)
- Hero section with tagline: "Map your path to financial freedom"
- Badge: "Built for Canadian dividend investors"
- Description of key features
- "Get started free" button → Google Sign-In
- "Built in Thunder Bay for Canadian investors" footer

### 2. Dashboard (authenticated — main screen)
- Greeting with user's first name and current date
- Account type selector pill (TFSA / RRSP / Non-Registered / All)
- Four metric cards at top:
  - Annual income (with YoY % change)
  - Portfolio value (with holding count)
  - Average weighted yield
  - Next upcoming payment (ticker + date)
- Monthly dividend income bar chart (Chart.js) with year toggle
- Top holdings table ranked by income contribution (ticker, shares, annual income, yield)
- Upcoming payments list with date badges

### 3. Holdings Management
- Add holding form: ticker input (with search/autocomplete from FMP), exchange selector, share count, average cost
- Edit and delete existing holdings
- Auto-detect if ticker is TSX or US-listed and set currency accordingly
- Display current price, current yield, and annual dividend per holding

### 4. Dividend Calendar
- Month-by-month grid showing expected payment dates and amounts
- Color-coded by holding
- Total income per month displayed

### 5. DRIP Projections
- Inputs: current holdings (pre-populated), monthly contribution amount, dividend growth rate assumption, time horizon (5/10/20/30 years)
- Output: line chart showing projected annual income over time with and without DRIP
- Display the projected annual income at each milestone year

### 6. Yield on Cost Tracker
- For each holding: show current yield vs yield-on-cost (dividend / average cost basis)
- Highlight how effective yield grows as companies raise dividends
- Historical view if dividend history data is available

---

## API Integration Details

### Financial Modeling Prep (FMP)

**Base URL:** `https://financialmodelingprep.com/api/v3/`

**Key endpoints:**

```
# Stock quote (current price + basic info)
GET /quote/{ticker}?apikey={key}
# For TSX stocks use .TO suffix: VDY.TO, ZRE.TO, XEI.TO, ZUT.TO
# For US stocks use plain ticker: VYM, VYMI, PHYS

# Dividend data for a specific stock
GET /stock_dividend_calendar?from={date}&to={date}&apikey={key}

# Historical dividends
GET /historical-price-full/stock_dividend/{ticker}?apikey={key}

# Search for tickers
GET /search?query={query}&limit=10&apikey={key}
```

**Free tier limits:** 250 calls/day. Cache aggressively — dividend data only needs refreshing once daily at most. Stock quotes can be cached for 15-30 minutes.

**Caching strategy:**
- Dividend data: cache in dividend_cache table, refresh once daily via a scheduled job or on first request if stale (> 24 hours)
- Stock quotes: cache in memory or short-lived, refresh every 30 minutes during market hours
- Dividend history: cache in dividend_history table, refresh weekly

### Bank of Canada Valet API

**USD/CAD daily rate:**
```
GET https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1
```

Response includes the daily noon rate. Cache this once per day in forex_cache table.

**Use this to convert all USD-denominated dividend income to CAD for display.**

---

## Authentication Flow

Use Google OAuth 2.0 with Passport.js (passport-google-oauth20):

1. User clicks "Get started free" or "Sign in with Google"
2. Redirect to Google OAuth consent screen
3. Google redirects back to `/auth/google/callback`
4. Create or find user in database by google_id
5. Set up session (express-session + connect-pg-simple for PostgreSQL session store)
6. Redirect to dashboard

**Google Cloud Console setup (manual — do before first deploy):**
- Create OAuth 2.0 credentials
- Set authorized redirect URI to: `https://incomemap.ca/auth/google/callback`
- For local dev, also add: `http://localhost:3000/auth/google/callback`

---

## Render Setup (Manual Steps)

### 1. Create PostgreSQL database
- Name: `incomemap-db`
- Region: Oregon (or closest)
- Plan: Free (to start), upgrade to Starter ($7/mo) when needed

### 2. Create Web Service
- Name: `incomemap`
- Environment: Node
- Build command: `npm install`
- Start command: `node server.js`
- Connect to the PostgreSQL database
- Set all environment variables listed above

### 3. Custom Domain
- Add `incomemap.ca` as custom domain in Render
- Update DNS records at your domain registrar to point to Render

---

## Key npm Dependencies

```json
{
    "dependencies": {
        "express": "^4.18.0",
        "pg": "^8.11.0",
        "express-session": "^1.17.0",
        "connect-pg-simple": "^9.0.0",
        "passport": "^0.7.0",
        "passport-google-oauth20": "^2.0.0",
        "axios": "^1.6.0",
        "dotenv": "^16.3.0",
        "helmet": "^7.1.0",
        "compression": "^1.7.0"
    }
}
```

---

## Important Notes

- **This is a consumer-facing product** — the UI needs to feel polished and professional, not like an internal tool. Take extra care with typography, spacing, and visual consistency.
- **Financial disclaimer required** — include a footer disclaimer on every page: "IncomeMap is an informational tool and does not constitute financial advice. Dividend data may be delayed or inaccurate. Always verify with your brokerage."
- **Session security** — use secure cookies, httpOnly, sameSite strict in production.
- **Rate limiting** — implement basic rate limiting on API routes to prevent abuse.
- **Mobile responsive** — the landing page and dashboard should work well on mobile. The sidebar can collapse to a bottom nav on small screens.
- **Error handling** — graceful handling of FMP API failures (show cached data with a "last updated" timestamp if the API is down).
- **No real financial data in code** — all example data in the UI should use realistic but clearly fictional values until the user adds their own holdings.

---

## Phase 1 Build Order

1. **Scaffold the Express app** — server.js, basic routing, static file serving, environment config
2. **Database setup** — connection pool, run schema.sql to create tables
3. **Authentication** — Google OAuth flow, session management, auth middleware
4. **Landing page** — public page matching the brand design (see brand guide)
5. **Dashboard shell** — authenticated layout with sidebar navigation, greeting, empty state
6. **Holdings CRUD** — add/edit/delete holdings, ticker search via FMP
7. **FMP integration** — fetch dividend data, cache it, display on dashboard
8. **Forex integration** — fetch USD/CAD rate, apply to US-listed holdings
9. **Dashboard data** — wire up the four metric cards, income chart, holdings table, upcoming payments
10. **DRIP projections** — compounding calculator with Chart.js visualization
11. **Calendar view** — month-by-month dividend calendar
12. **Yield tracker** — yield on cost calculations and display
13. **Polish** — responsive design, error states, loading states, mobile nav
