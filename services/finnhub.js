const axios = require('axios');

const API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = 'https://finnhub.io/api/v1';

// Simple rate-limit queue: max 60 calls/min → 1 per second
const queue = [];
let processing = false;

function enqueue(fn) {
    return new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        processQueue();
    });
}

function processQueue() {
    if (processing || queue.length === 0) return;
    processing = true;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve).catch(reject).finally(() => {
        setTimeout(() => {
            processing = false;
            processQueue();
        }, 1100); // ~1 request per second to stay under 60/min
    });
}

function getFinnhubSymbol(ticker, exchange) {
    if (exchange === 'TSX') return `${ticker}.TO`;
    return ticker;
}

async function fetchCompanyNews(ticker, exchange, fromDate, toDate) {
    if (!API_KEY) {
        console.warn('FINNHUB_API_KEY not set — skipping news fetch');
        return [];
    }

    const symbol = getFinnhubSymbol(ticker, exchange);

    return enqueue(async () => {
        try {
            const { data } = await axios.get(`${BASE_URL}/company-news`, {
                params: {
                    symbol,
                    from: fromDate,
                    to: toDate,
                    token: API_KEY
                },
                timeout: 10000
            });

            if (!Array.isArray(data)) return [];

            return data.map(article => ({
                ticker,
                headline: article.headline,
                summary: article.summary,
                source: article.source,
                url: article.url,
                image_url: article.image,
                published_at: new Date(article.datetime * 1000)
            }));
        } catch (err) {
            console.error(`Finnhub news fetch error for ${symbol}:`, err.message);
            return [];
        }
    });
}

module.exports = { fetchCompanyNews, getFinnhubSymbol };
