require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const passport = require('passport');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const pool = require('./db/pool');

const app = express();
const PORT = process.env.PORT || 3000;

// Security
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://accounts.google.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://accounts.google.com"],
            frameSrc: ["https://accounts.google.com"]
        }
    }
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Sessions
app.use(session({
    store: new PgSession({
        pool: pool,
        tableName: 'session',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());
require('./middleware/auth').configurePassport(passport);

// Make user available to all templates
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    next();
});

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/portfolios', require('./routes/portfolios'));
app.use('/holdings', require('./routes/holdings'));
app.use('/projections', require('./routes/projections'));
app.use('/api', require('./routes/api'));

// Landing page
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, 'views', 'landing.html'));
});

// Error handling
app.use(require('./middleware/errors'));

app.listen(PORT, () => {
    console.log(`IncomeMap running on port ${PORT}`);
});

module.exports = app;
