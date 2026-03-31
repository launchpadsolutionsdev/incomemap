const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/auth');
const projectionsService = require('../services/projections');
const path = require('path');

router.use(ensureAuth);

// Projections page
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'projections.html'));
});

// Calculate projection
router.post('/calculate', async (req, res) => {
    try {
        const {
            currentAnnualIncome,
            portfolioValue,
            monthlyContribution,
            dividendGrowthRate,
            averageYield,
            years
        } = req.body;

        const result = projectionsService.calculate({
            currentAnnualIncome: parseFloat(currentAnnualIncome) || 0,
            portfolioValue: parseFloat(portfolioValue) || 0,
            monthlyContribution: parseFloat(monthlyContribution) || 0,
            dividendGrowthRate: parseFloat(dividendGrowthRate) || 5,
            averageYield: parseFloat(averageYield) || 4,
            years: parseInt(years) || 10
        });

        res.json(result);
    } catch (err) {
        console.error('Projection error:', err.message);
        res.status(500).json({ error: 'Failed to calculate projection' });
    }
});

module.exports = router;
