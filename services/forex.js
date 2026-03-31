const axios = require('axios');
const pool = require('../db/pool');

let cachedRate = null;
let cacheDate = null;

async function getUsdCadRate() {
    const today = new Date().toISOString().split('T')[0];

    // Check memory cache
    if (cachedRate && cacheDate === today) {
        return cachedRate;
    }

    // Check DB cache
    try {
        const dbCached = await pool.query(
            'SELECT rate FROM forex_cache WHERE pair = $1 AND date = $2',
            ['USD/CAD', today]
        );
        if (dbCached.rows.length > 0) {
            cachedRate = parseFloat(dbCached.rows[0].rate);
            cacheDate = today;
            return cachedRate;
        }
    } catch (err) {
        console.error('Forex cache read error:', err.message);
    }

    // Fetch from Bank of Canada
    try {
        const { data } = await axios.get(
            'https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1',
            { timeout: 10000 }
        );

        const observations = data.observations;
        if (observations && observations.length > 0) {
            const rate = parseFloat(observations[0].FXUSDCAD.v);
            const rateDate = observations[0].d;

            // Store in DB
            await pool.query(
                `INSERT INTO forex_cache (pair, rate, date, source)
                 VALUES ($1, $2, $3, 'Bank of Canada')
                 ON CONFLICT (pair, date) DO UPDATE SET rate = $2, last_updated = NOW()`,
                ['USD/CAD', rate, rateDate]
            );

            cachedRate = rate;
            cacheDate = today;
            return rate;
        }
    } catch (err) {
        console.error('Bank of Canada API error:', err.message);
    }

    // Fallback: get most recent cached rate
    try {
        const fallback = await pool.query(
            'SELECT rate FROM forex_cache WHERE pair = $1 ORDER BY date DESC LIMIT 1',
            ['USD/CAD']
        );
        if (fallback.rows.length > 0) {
            return parseFloat(fallback.rows[0].rate);
        }
    } catch (err) {
        console.error('Forex fallback error:', err.message);
    }

    // Last resort fallback
    return 1.35;
}

module.exports = { getUsdCadRate };
