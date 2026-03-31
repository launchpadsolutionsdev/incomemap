const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/auth');
const fmpService = require('../services/fmp');
const forexService = require('../services/forex');
const dividendService = require('../services/dividends');
const pool = require('../db/pool');

// Ticker search
router.get('/search', ensureAuth, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 1) return res.json([]);
        const results = await fmpService.searchTicker(q);
        res.json(results);
    } catch (err) {
        console.error('Search error:', err.message);
        res.json([]);
    }
});

// Get quote for a ticker
router.get('/quote/:ticker', ensureAuth, async (req, res) => {
    try {
        const quote = await fmpService.getQuote(req.params.ticker);
        res.json(quote);
    } catch (err) {
        console.error('Quote error:', err.message);
        res.status(500).json({ error: 'Failed to fetch quote' });
    }
});

// Get USD/CAD rate
router.get('/forex/usdcad', ensureAuth, async (req, res) => {
    try {
        const rate = await forexService.getUsdCadRate();
        res.json({ rate });
    } catch (err) {
        console.error('Forex error:', err.message);
        res.status(500).json({ error: 'Failed to fetch exchange rate' });
    }
});

// Get dashboard summary data
router.get('/dashboard/summary', ensureAuth, async (req, res) => {
    try {
        const { accountType } = req.query;
        const summary = await dividendService.getDashboardSummary(req.user.id, accountType);
        res.json(summary);
    } catch (err) {
        console.error('Dashboard summary error:', err.message);
        res.status(500).json({ error: 'Failed to load dashboard data' });
    }
});

// Get monthly income data for chart
router.get('/dashboard/monthly-income', ensureAuth, async (req, res) => {
    try {
        const { year, accountType } = req.query;
        const data = await dividendService.getMonthlyIncome(req.user.id, parseInt(year) || new Date().getFullYear(), accountType);
        res.json(data);
    } catch (err) {
        console.error('Monthly income error:', err.message);
        res.status(500).json({ error: 'Failed to load monthly income' });
    }
});

// Get upcoming payments
router.get('/dashboard/upcoming', ensureAuth, async (req, res) => {
    try {
        const { accountType } = req.query;
        const payments = await dividendService.getUpcomingPayments(req.user.id, accountType);
        res.json(payments);
    } catch (err) {
        console.error('Upcoming payments error:', err.message);
        res.status(500).json({ error: 'Failed to load upcoming payments' });
    }
});

// Get holdings with dividend data
router.get('/holdings/data', ensureAuth, async (req, res) => {
    try {
        const { accountType } = req.query;
        const holdings = await dividendService.getHoldingsWithDividends(req.user.id, accountType);
        res.json(holdings);
    } catch (err) {
        console.error('Holdings data error:', err.message);
        res.status(500).json({ error: 'Failed to load holdings data' });
    }
});

// Get calendar data
router.get('/calendar/data', ensureAuth, async (req, res) => {
    try {
        const { year, accountType } = req.query;
        const data = await dividendService.getCalendarData(req.user.id, parseInt(year) || new Date().getFullYear(), accountType);
        res.json(data);
    } catch (err) {
        console.error('Calendar error:', err.message);
        res.status(500).json({ error: 'Failed to load calendar data' });
    }
});

// Get yield on cost data
router.get('/yield-tracker/data', ensureAuth, async (req, res) => {
    try {
        const { accountType } = req.query;
        const data = await dividendService.getYieldOnCostData(req.user.id, accountType);
        res.json(data);
    } catch (err) {
        console.error('Yield tracker error:', err.message);
        res.status(500).json({ error: 'Failed to load yield data' });
    }
});

module.exports = router;
