const pool = require('../db/pool');
const finnhub = require('./finnhub');

const CACHE_TTL_HOURS = 6;

function formatDate(d) {
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Check if we already have fresh cached news for a ticker
async function hasFreshCache(ticker) {
    const result = await pool.query(
        `SELECT 1 FROM stock_news
         WHERE ticker = $1 AND fetched_at > NOW() - INTERVAL '${CACHE_TTL_HOURS} hours'
         LIMIT 1`,
        [ticker]
    );
    return result.rows.length > 0;
}

// Fetch and store news for a single ticker
async function fetchNewsForTicker(ticker, exchange) {
    try {
        if (await hasFreshCache(ticker)) return;

        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 30);

        const articles = await finnhub.fetchCompanyNews(
            ticker, exchange,
            formatDate(from), formatDate(to)
        );

        if (articles.length === 0) return;

        for (const a of articles) {
            await pool.query(
                `INSERT INTO stock_news (ticker, headline, summary, source, url, image_url, published_at, fetched_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                 ON CONFLICT (ticker, url) DO UPDATE SET
                 headline = EXCLUDED.headline,
                 summary = EXCLUDED.summary,
                 fetched_at = NOW()`,
                [a.ticker, a.headline, a.summary || '', a.source || '', a.url, a.image_url || '', a.published_at]
            );
        }
    } catch (err) {
        console.error(`News fetch error for ${ticker}:`, err.message);
    }
}

// Get news for all tickers in a user's portfolio
async function getNewsForUser(userId) {
    const result = await pool.query(
        `SELECT DISTINCT sn.ticker, sn.headline, sn.summary, sn.source, sn.url, sn.image_url, sn.published_at
         FROM stock_news sn
         INNER JOIN holdings h ON sn.ticker = h.ticker
         INNER JOIN portfolios p ON h.portfolio_id = p.id
         WHERE p.user_id = $1
         ORDER BY sn.published_at DESC
         LIMIT 20`,
        [userId]
    );
    return result.rows;
}

// Background job: refresh news for all active tickers across all users
async function refreshAllNews() {
    try {
        const result = await pool.query(
            `SELECT DISTINCT h.ticker, h.exchange
             FROM holdings h
             JOIN portfolios p ON h.portfolio_id = p.id
             ORDER BY h.ticker`
        );

        console.log(`Refreshing news for ${result.rows.length} active tickers`);

        for (const row of result.rows) {
            await fetchNewsForTicker(row.ticker, row.exchange);
        }

        // Clean up articles older than 60 days
        await pool.query(
            `DELETE FROM stock_news WHERE published_at < NOW() - INTERVAL '60 days'`
        );

        console.log('News refresh complete');
    } catch (err) {
        console.error('News refresh error:', err.message);
    }
}

// Start background refresh interval (every 6 hours)
function startNewsRefreshJob() {
    const SIX_HOURS = 6 * 60 * 60 * 1000;

    // Initial fetch after a short delay to let the app start up
    setTimeout(() => refreshAllNews(), 30 * 1000);

    setInterval(() => refreshAllNews(), SIX_HOURS);

    console.log('News refresh job scheduled (every 6 hours)');
}

module.exports = { fetchNewsForTicker, getNewsForUser, refreshAllNews, startNewsRefreshJob };
