const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/auth');
const pool = require('../db/pool');

router.use(ensureAuth);

// Get user's portfolios
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM portfolios WHERE user_id = $1 ORDER BY account_type',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Portfolios fetch error:', err.message);
        res.status(500).json({ error: 'Failed to load portfolios' });
    }
});

// Create portfolio
router.post('/', async (req, res) => {
    try {
        const { name, account_type } = req.body;
        if (!name || !account_type) {
            return res.status(400).json({ error: 'Name and account type are required' });
        }
        const valid = ['TFSA', 'RRSP', 'Non-Registered'];
        if (!valid.includes(account_type)) {
            return res.status(400).json({ error: 'Invalid account type' });
        }
        const result = await pool.query(
            'INSERT INTO portfolios (user_id, name, account_type) VALUES ($1, $2, $3) RETURNING *',
            [req.user.id, name, account_type]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Portfolio create error:', err.message);
        res.status(500).json({ error: 'Failed to create portfolio' });
    }
});

// Delete portfolio
router.delete('/:id', async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM portfolios WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Portfolio delete error:', err.message);
        res.status(500).json({ error: 'Failed to delete portfolio' });
    }
});

module.exports = router;
