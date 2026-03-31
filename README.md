# incomemap

**Map your path to financial freedom.**

IncomeMap is a dividend tracking web application built specifically for Canadian investors. Track your TFSA, RRSP, and non-registered holdings in one place. See your projected income. Model where DRIP compounding takes you in 10, 20, 30 years.

**Live at:** [incomemap.ca](https://incomemap.ca)

---

## Features

- **Dashboard** — Annual income, portfolio value, weighted yield, and next payment at a glance
- **Monthly income chart** — See your dividend payments mapped across the year
- **Holdings management** — Add TSX and US-listed ETFs/stocks with automatic exchange detection
- **DRIP projections** — Model compounding over 5, 10, 20, or 30 years with contribution scenarios
- **Dividend calendar** — Month-by-month view of expected payment dates and amounts
- **Yield on cost tracker** — See how your effective yield grows as companies raise dividends
- **USD/CAD conversion** — Automatic currency conversion for US-listed holdings using Bank of Canada rates
- **Multi-account support** — Track TFSA, RRSP, and non-registered accounts separately

---

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Hosting:** Render
- **Auth:** Google OAuth 2.0 (Passport.js)
- **Market Data:** Financial Modeling Prep API
- **Currency Data:** Bank of Canada Valet API
- **Charts:** Chart.js

---

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- A Google Cloud OAuth client (see [SETUP.md](SETUP.md))
- A Financial Modeling Prep API key (free at [financialmodelingprep.com](https://site.financialmodelingprep.com/register))

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/YOUR_USERNAME/incomemap.git
   cd incomemap
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

4. Fill in your environment variables in `.env` (see [SETUP.md](SETUP.md) for details).

5. Create the database and run the schema:
   ```bash
   createdb incomemap
   psql incomemap < db/schema.sql
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
incomemap/
├── server.js              # Express app entry point
├── package.json
├── .env.example           # Environment variable template
├── db/
│   ├── pool.js            # PostgreSQL connection pool
│   └── schema.sql         # Database schema
├── routes/
│   ├── auth.js            # Google OAuth routes
│   ├── dashboard.js       # Main dashboard
│   ├── portfolios.js      # Portfolio CRUD
│   ├── holdings.js        # Holdings CRUD
│   ├── projections.js     # DRIP projection calculator
│   └── api.js             # Internal API endpoints
├── services/
│   ├── fmp.js             # Financial Modeling Prep client
│   ├── forex.js           # Bank of Canada forex service
│   ├── dividends.js       # Dividend data aggregation
│   └── projections.js     # DRIP compounding math
├── middleware/
│   ├── auth.js            # Authentication middleware
│   └── errors.js          # Error handling
├── public/
│   ├── css/style.css      # Styles (brand system)
│   ├── js/app.js          # Client-side JS
│   └── images/
└── views/                 # HTML templates
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the production server |
| `npm run dev` | Start with file watching (nodemon) |

---

## Deployment

IncomeMap is deployed on Render. See [SETUP.md](SETUP.md) for full deployment instructions.

---

## Disclaimer

IncomeMap is an informational tool and does not constitute financial advice. Dividend data is sourced from third-party providers and may be delayed or inaccurate. Always verify with your brokerage.

---

## License

Proprietary. All rights reserved.

---

Built in Thunder Bay for Canadian investors.
