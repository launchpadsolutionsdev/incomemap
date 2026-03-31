# IncomeMap — Setup Guide

Step-by-step instructions for setting up all external services and deploying IncomeMap.

---

## 1. Financial Modeling Prep (FMP) API Key

1. Go to [financialmodelingprep.com/register](https://site.financialmodelingprep.com/register)
2. Create a free account
3. Your API key will be shown on the dashboard after registration
4. Copy the key — you'll add it as `FMP_API_KEY` in your environment variables

**Free tier limits:** 250 API calls per day. This is sufficient for development and early users. The app caches aggressively to stay within limits.

**TSX ticker format:** Canadian stocks use the `.TO` suffix in FMP (e.g., `VDY.TO`, `ZRE.TO`, `XEI.TO`). US stocks use plain tickers (e.g., `VYM`, `VYMI`).

---

## 2. Google Cloud Console (OAuth)

### Create a project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Create a new project called "IncomeMap" (or reuse an existing project)
3. Select the project

### Configure the OAuth consent screen

1. Navigate to **APIs & Services > OAuth consent screen**
2. Choose **External** user type
3. Fill in:
   - App name: `IncomeMap`
   - User support email: your email
   - Authorized domains: `incomemap.ca`
   - Developer contact: your email
4. Add scopes: `email`, `profile`, `openid`
5. Save

### Create OAuth credentials

1. Navigate to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Application type: **Web application**
4. Name: `IncomeMap Web Client`
5. Authorized JavaScript origins:
   - `https://incomemap.ca`
   - `http://localhost:3000` (for local dev)
6. Authorized redirect URIs:
   - `https://incomemap.ca/auth/google/callback`
   - `http://localhost:3000/auth/google/callback` (for local dev)
7. Click **Create**
8. Copy the **Client ID** and **Client Secret** — these become `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

### Publishing status

While in development, the app will show a "Google hasn't verified this app" warning. This is fine for testing. To remove it for production, you'll need to submit for verification once the app is stable (requires a privacy policy page on your site).

---

## 3. Render Setup

### Create PostgreSQL database

1. Go to [dashboard.render.com](https://dashboard.render.com/)
2. Click **New > PostgreSQL**
3. Settings:
   - Name: `incomemap-db`
   - Database: `incomemap`
   - User: `incomemap_user`
   - Region: Oregon (US West) or closest to your users
   - Plan: Free (upgrade to Starter at $7/mo when you need reliability)
4. Click **Create Database**
5. Once provisioned, copy the **Internal Database URL** — this becomes `DATABASE_URL`

### Create Web Service

1. Click **New > Web Service**
2. Connect your GitHub repo
3. Settings:
   - Name: `incomemap`
   - Region: Same as your database
   - Branch: `main`
   - Runtime: **Node**
   - Build command: `npm install`
   - Start command: `node server.js`
   - Plan: Free (upgrade to Starter when needed)
4. Click **Create Web Service**

### Set environment variables

In the web service settings, add all environment variables:

```
DATABASE_URL=            # Internal Database URL from step above
GOOGLE_CLIENT_ID=        # From Google Cloud Console
GOOGLE_CLIENT_SECRET=    # From Google Cloud Console
FMP_API_KEY=             # From FMP registration
SESSION_SECRET=          # Generate a random string (e.g., run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
NODE_ENV=production
BASE_URL=https://incomemap.ca
```

### Connect custom domain

1. In your web service, go to **Settings > Custom Domains**
2. Add `incomemap.ca`
3. Render will give you DNS records to add
4. Go to your domain registrar and update DNS:
   - Add a CNAME record pointing `incomemap.ca` to your Render service URL
   - Or follow Render's specific instructions for your registrar
5. Wait for DNS propagation (can take up to 48 hours, usually much faster)
6. Render will automatically provision an SSL certificate

---

## 4. Database Initialization

After deployment, run the schema to create tables. You can do this via Render's shell:

1. Go to your web service on Render
2. Click **Shell** in the sidebar
3. Run:
   ```bash
   psql $DATABASE_URL < db/schema.sql
   ```

Or for local development:
```bash
psql incomemap < db/schema.sql
```

---

## 5. Local Environment

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://localhost:5432/incomemap
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FMP_API_KEY=your-fmp-api-key
SESSION_SECRET=any-random-string-for-local-dev
NODE_ENV=development
BASE_URL=http://localhost:3000
```

---

## 6. Bank of Canada API

No setup required — the Bank of Canada Valet API is free and requires no authentication.

**Endpoint used:**
```
GET https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1
```

This returns the most recent daily USD/CAD exchange rate. The app caches this once per day.

---

## Verification Checklist

Before going live, verify:

- [ ] FMP API key works (test: `curl "https://financialmodelingprep.com/api/v3/quote/VDY.TO?apikey=YOUR_KEY"`)
- [ ] Google OAuth redirects work on both localhost and production
- [ ] Database tables are created (check with `\dt` in psql)
- [ ] DNS is pointing to Render and SSL certificate is active
- [ ] Session cookies are secure (httpOnly, sameSite, secure in production)
- [ ] Financial disclaimer is visible on every page
