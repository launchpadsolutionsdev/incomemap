const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/auth');
const path = require('path');

router.use(ensureAuth);

router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'dashboard.html'));
});

router.get('/calendar', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'calendar.html'));
});

router.get('/yield-tracker', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'yield-tracker.html'));
});

module.exports = router;
