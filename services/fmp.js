const axios = require('axios');
const pool = require('../db/pool');

const BASE_URL = 'https://financialmodelingprep.com/api/v3';
const API_KEY = process.env.FMP_API_KEY;

// In-memory quote cache (short-lived)
const quoteCache = new Map();
const QUOTE_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getFmpTicker(ticker, exchange) {
    if (exchange === 'TSX') return `${ticker}.TO`;
    return ticker;
}

async function searchTicker(query) {
    try {
        const { data } = await axios.get(`${BASE_URL}/search`, {
            params: { query, limit: 10, apikey: API_KEY }
        });
        return data.map(item => ({
            ticker: item.symbol,
            name: item.name,
            exchange: item.stockExchange || item.exchangeShortName,
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

    try {
        const { data } = await axios.get(`${BASE_URL}/quote/${ticker}`, {
            params: { apikey: API_KEY }
        });
        if (data && data.length > 0) {
            const quote = data[0];
            quoteCache.set(ticker, { data: quote, timestamp: Date.now() });
            return quote;
        }
        return null;
    } catch (err) {
        console.error('FMP quote error:', err.message);
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

    // Fetch from FMP
    try {
        const { data } = await axios.get(`${BASE_URL}/historical-price-full/stock_dividend/${fmpTicker}`, {
            params: { apikey: API_KEY }
        });

        if (!data || !data.historical || data.historical.length === 0) {
            return null;
        }

        const dividends = data.historical;
        const latest = dividends[0];

        // Calculate frequency and annual dividend
        const frequency = detectFrequency(dividends);
        const multiplier = { 'Monthly': 12, 'Quarterly': 4, 'Semi-Annual': 2, 'Annual': 1 }[frequency] || 4;
        const annualDividend = latest.dividend * multiplier;

        // Get current price for yield
        const quote = await getQuote(fmpTicker);
        const currentYield = quote ? annualDividend / quote.price : null;

        // Store in cache
        await pool.query(
            `INSERT INTO dividend_cache (ticker, exchange, dividend_amount, dividend_yield, frequency, ex_date, payment_date, annual_dividend, last_updated)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (ticker, exchange) DO UPDATE SET
             dividend_amount = $3, dividend_yield = $4, frequency = $5, ex_date = $6, payment_date = $7, annual_dividend = $8, last_updated = NOW()`,
            [ticker, exchange, latest.dividend, currentYield, frequency, latest.date, latest.paymentDate, annualDividend]
        );

        // Store history
        for (const div of dividends.slice(0, 20)) {
            await pool.query(
                `INSERT INTO dividend_history (ticker, exchange, amount, ex_date, payment_date, currency)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT DO NOTHING`,
                [ticker, exchange, div.dividend, div.date, div.paymentDate, exchange === 'TSX' ? 'CAD' : 'USD']
            );
        }

        return {
            ticker, exchange,
            dividend_amount: latest.dividend,
            dividend_yield: currentYield,
            frequency,
            ex_date: latest.date,
            payment_date: latest.paymentDate,
            annual_dividend: annualDividend
        };
    } catch (err) {
        console.error('FMP dividend fetch error:', err.message);
        // Fall back to any cached data, even if stale
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
}

function detectFrequency(dividends) {
    if (dividends.length < 2) return 'Quarterly';
    const dates = dividends.slice(0, 6).map(d => new Date(d.date));
    const gaps = [];
    for (let i = 0; i < dates.length - 1; i++) {
        const diffDays = (dates[i] - dates[i + 1]) / (1000 * 60 * 60 * 24);
        gaps.push(diffDays);
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (avgGap < 45) return 'Monthly';
    if (avgGap < 120) return 'Quarterly';
    if (avgGap < 270) return 'Semi-Annual';
    return 'Annual';
}

module.exports = { searchTicker, getQuote, getDividendData, getFmpTicker };
