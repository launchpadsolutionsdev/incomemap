const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/auth');
const pool = require('../db/pool');
const path = require('path');

router.use(ensureAuth);

// Holdings page
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'holdings.html'));
});

// Get holdings for user
router.get('/list', async (req, res) => {
    try {
        const { accountType } = req.query;
        let query = `
            SELECT h.*, p.account_type, p.name as portfolio_name
            FROM holdings h
            JOIN portfolios p ON h.portfolio_id = p.id
            WHERE p.user_id = $1
        `;
        const params = [req.user.id];

        if (accountType && accountType !== 'All') {
            query += ' AND p.account_type = $2';
            params.push(accountType);
        }

        query += ' ORDER BY h.ticker';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Holdings list error:', err.message);
        res.status(500).json({ error: 'Failed to load holdings' });
    }
});

// Add holding
router.post('/', async (req, res) => {
    try {
        const { portfolio_id, ticker, exchange, shares, avg_cost, currency } = req.body;

        if (!portfolio_id || !ticker || !exchange || !shares || !avg_cost) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Verify portfolio belongs to user
        const portfolio = await pool.query(
            'SELECT id FROM portfolios WHERE id = $1 AND user_id = $2',
            [portfolio_id, req.user.id]
        );
        if (portfolio.rows.length === 0) {
            return res.status(403).json({ error: 'Portfolio not found' });
        }

        const result = await pool.query(
            `INSERT INTO holdings (portfolio_id, ticker, exchange, shares, avg_cost, currency)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [portfolio_id, ticker.toUpperCase(), exchange, parseFloat(shares), parseFloat(avg_cost), currency || 'CAD']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Holding create error:', err.message);
        res.status(500).json({ error: 'Failed to add holding' });
    }
});

// Update holding
router.put('/:id', async (req, res) => {
    try {
        const { shares, avg_cost } = req.body;

        // Verify holding belongs to user
        const check = await pool.query(
            `SELECT h.id FROM holdings h
             JOIN portfolios p ON h.portfolio_id = p.id
             WHERE h.id = $1 AND p.user_id = $2`,
            [req.params.id, req.user.id]
        );
        if (check.rows.length === 0) {
            return res.status(403).json({ error: 'Holding not found' });
        }

        const result = await pool.query(
            `UPDATE holdings SET shares = $1, avg_cost = $2, updated_at = NOW()
             WHERE id = $3 RETURNING *`,
            [parseFloat(shares), parseFloat(avg_cost), req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Holding update error:', err.message);
        res.status(500).json({ error: 'Failed to update holding' });
    }
});

// Delete holding
router.delete('/:id', async (req, res) => {
    try {
        const check = await pool.query(
            `SELECT h.id FROM holdings h
             JOIN portfolios p ON h.portfolio_id = p.id
             WHERE h.id = $1 AND p.user_id = $2`,
            [req.params.id, req.user.id]
        );
        if (check.rows.length === 0) {
            return res.status(403).json({ error: 'Holding not found' });
        }

        await pool.query('DELETE FROM holdings WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Holding delete error:', err.message);
        res.status(500).json({ error: 'Failed to delete holding' });
    }
});

module.exports = router;
