const axios = require('axios');
const pool = require('../db/pool');

// FMP stable API (replaces legacy v3 endpoints deprecated Aug 2025)
const STABLE_URL = 'https://financialmodelingprep.com/stable';
const API_KEY = process.env.FMP_API_KEY;
const REQUEST_TIMEOUT = 8000; // 8 seconds

if (!API_KEY) {
    console.warn('WARNING: FMP_API_KEY not set — quote and dividend data will be unavailable');
}

// In-memory quote cache (short-lived)
const quoteCache = new Map();
const QUOTE_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getFmpTicker(ticker, exchange) {
    if (exchange === 'TSX') return `${ticker}.TO`;
    return ticker;
}

async function searchTicker(query) {
    if (!API_KEY) return [];
    try {
        const { data } = await axios.get(`${STABLE_URL}/search-symbol`, {
            params: { query, limit: 10, apikey: API_KEY },
            timeout: REQUEST_TIMEOUT
        });
        if (!Array.isArray(data)) return [];
        return data.map(item => ({
            ticker: item.symbol,
            name: item.name,
            exchange: item.exchangeShortName || item.stockExchange || '',
            currency: item.currency
        }));
    } catch (err) {
        console.error('FMP search error:', err.message);
        return [];
    }
}

async function getQuote(ticker) {
    // Check memory cache
    const cached = quoteCache.get(ticker);
    if (cached && Date.now() - cached.timestamp < QUOTE_CACHE_TTL) {
        return cached.data;
    }

    if (!API_KEY) return null;

    try {
        const { data } = await axios.get(`${STABLE_URL}/quote`, {
            params: { symbol: ticker, apikey: API_KEY },
            timeout: REQUEST_TIMEOUT
        });
        // Stable API returns an array
        const results = Array.isArray(data) ? data : [data];
        if (results.length > 0 && results[0] && results[0].price) {
            const quote = results[0];
            quoteCache.set(ticker, { data: quote, timestamp: Date.now() });
            return quote;
        }
        console.warn(`FMP quote returned empty for ${ticker}`);
        return null;
    } catch (err) {
        const status = err.response ? err.response.status : 'no response';
        const body = err.response ? JSON.stringify(err.response.data).slice(0, 200) : '';
        console.error(`FMP quote error for ${ticker} (${status}): ${err.message} ${body}`);
        return null;
    }
}

async function getDividendData(ticker, exchange) {
    const fmpTicker = getFmpTicker(ticker, exchange);

    // Check DB cache first
    try {
        const cached = await pool.query(
            `SELECT * FROM dividend_cache WHERE ticker = $1 AND exchange = $2
             AND last_updated > NOW() - INTERVAL '24 hours'`,
            [ticker, exchange]
        );
        if (cached.rows.length > 0) {
            return cached.rows[0];
        }
    } catch (err) {
        console.error('Dividend cache read error:', err.message);
    }

    if (!API_KEY) {
        return getStaleDividendCache(ticker, exchange);
    }

    // Fetch from FMP stable dividends-company endpoint
    try {
        const { data } = await axios.get(`${STABLE_URL}/dividends-company`, {
            params: { symbol: fmpTicker, apikey: API_KEY },
            timeout: REQUEST_TIMEOUT
        });

        // Stable API returns an array of dividend records
        const dividends = Array.isArray(data) ? data : [];
        if (dividends.length === 0) {
            return getStaleDividendCache(ticker, exchange);
        }

        // Sort by date descending (newest first)
        dividends.sort((a, b) => new Date(b.date) - new Date(a.date));

        const latest = dividends[0];
        const divAmount = latest.dividend || latest.adjDividend || 0;

        // Calculate frequency and annual dividend
        const frequency = detectFrequency(dividends);
        const multiplier = { 'Monthly': 12, 'Quarterly': 4, 'Semi-Annual': 2, 'Annual': 1 }[frequency] || 4;
        const annualDividend = divAmount * multiplier;

        // Get current price for yield
        const quote = await getQuote(fmpTicker);
        const currentYield = quote && quote.price ? annualDividend / quote.price : null;

        // Store in cache
        await pool.query(
            `INSERT INTO dividend_cache (ticker, exchange, dividend_amount, dividend_yield, frequency, ex_date, payment_date, annual_dividend, last_updated)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (ticker, exchange) DO UPDATE SET
             dividend_amount = $3, dividend_yield = $4, frequency = $5, ex_date = $6, payment_date = $7, annual_dividend = $8, last_updated = NOW()`,
            [ticker, exchange, divAmount, currentYield, frequency, latest.date, latest.paymentDate, annualDividend]
        );

        // Store history (fire and forget)
        storeHistory(ticker, exchange, dividends).catch(err =>
            console.error('Dividend history store error:', err.message)
        );

        return {
            ticker, exchange,
            dividend_amount: divAmount,
            dividend_yield: currentYield,
            frequency,
            ex_date: latest.date,
            payment_date: latest.paymentDate,
            annual_dividend: annualDividend
        };
    } catch (err) {
        const status = err.response ? err.response.status : 'no response';
        const body = err.response ? JSON.stringify(err.response.data).slice(0, 200) : '';
        console.error(`FMP dividend error for ${ticker}/${exchange} (${status}): ${err.message} ${body}`);
        return getStaleDividendCache(ticker, exchange);
    }
}

async function getStaleDividendCache(ticker, exchange) {
    try {
        const stale = await pool.query(
            'SELECT * FROM dividend_cache WHERE ticker = $1 AND exchange = $2',
            [ticker, exchange]
        );
        return stale.rows[0] || null;
    } catch (e) {
        return null;
    }
}

async function storeHistory(ticker, exchange, dividends) {
    for (const div of dividends.slice(0, 20)) {
        const divAmount = div.dividend || div.adjDividend || 0;
        await pool.query(
            `INSERT INTO dividend_history (ticker, exchange, amount, ex_date, payment_date, currency)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT DO NOTHING`,
            [ticker, exchange, divAmount, div.date, div.paymentDate, exchange === 'TSX' ? 'CAD' : 'USD']
        );
    }
}

function detectFrequency(dividends) {
    if (dividends.length < 2) return 'Quarterly';
    const dates = dividends.slice(0, 6).map(d => new Date(d.date));
    const gaps = [];
    for (let i = 0; i < dates.length - 1; i++) {
        const diffDays = Math.abs(dates[i] - dates[i + 1]) / (1000 * 60 * 60 * 24);
        gaps.push(diffDays);
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (avgGap < 45) return 'Monthly';
    if (avgGap < 120) return 'Quarterly';
    if (avgGap < 270) return 'Semi-Annual';
    return 'Annual';
}

// Diagnostic: test the API with a known ticker
async function testConnection() {
    if (!API_KEY) return { ok: false, error: 'FMP_API_KEY not set' };
    try {
        const { data } = await axios.get(`${STABLE_URL}/quote`, {
            params: { symbol: 'AAPL', apikey: API_KEY },
            timeout: REQUEST_TIMEOUT
        });
        const results = Array.isArray(data) ? data : [data];
        if (results.length > 0 && results[0] && results[0].price) {
            return { ok: true, sample: { ticker: 'AAPL', price: results[0].price } };
        }
        return { ok: false, error: 'API returned empty data', response: JSON.stringify(data).slice(0, 300) };
    } catch (err) {
        return {
            ok: false,
            error: err.message,
            status: err.response ? err.response.status : null,
            response: err.response ? JSON.stringify(err.response.data).slice(0, 300) : null
        };
    }
}

module.exports = { searchTicker, getQuote, getDividendData, getFmpTicker, testConnection };
