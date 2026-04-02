const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('../db/pool');

function configurePassport(passport) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.warn('WARNING: Google OAuth credentials not set. Authentication will not work.');
        passport.serializeUser((user, done) => done(null, user.id));
        passport.deserializeUser(async (id, done) => done(null, null));
        return;
    }

    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BASE_URL || 'http://localhost:3000'}/auth/google/callback`
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const existing = await pool.query(
                'SELECT * FROM users WHERE google_id = $1',
                [profile.id]
            );

            if (existing.rows.length > 0) {
                await pool.query(
                    'UPDATE users SET updated_at = NOW() WHERE id = $1',
                    [existing.rows[0].id]
                );
                return done(null, existing.rows[0]);
            }

            const result = await pool.query(
                'INSERT INTO users (google_id, email, name) VALUES ($1, $2, $3) RETURNING *',
                [profile.id, profile.emails[0].value, profile.displayName]
            );

            // Create default portfolios for new user
            const userId = result.rows[0].id;
            await pool.query(
                `INSERT INTO portfolios (user_id, name, account_type) VALUES
                 ($1, 'My TFSA', 'TFSA'),
                 ($1, 'My RRSP', 'RRSP'),
                 ($1, 'Non-Registered', 'Non-Registered')`,
                [userId]
            );

            return done(null, result.rows[0]);
        } catch (err) {
            return done(err, null);
        }
    }));

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
            done(null, result.rows[0] || null);
        } catch (err) {
            done(err, null);
        }
    });
}

function ensureAuth(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    // Return JSON 401 for API/AJAX requests instead of redirecting
    if (req.xhr || req.headers.accept === 'application/json' || req.method !== 'GET') {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    res.redirect('/');
}

module.exports = { configurePassport, ensureAuth };
