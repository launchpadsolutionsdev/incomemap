const express = require('express');
const passport = require('passport');
const router = express.Router();

router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

router.get('/google/callback', (req, res, next) => {
    passport.authenticate('google', (err, user, info) => {
        if (err) {
            console.error('OAuth callback error:', err.message);
            return res.redirect('/?auth_error=callback_failed');
        }
        if (!user) {
            console.warn('OAuth callback: no user returned', info);
            return res.redirect('/?auth_error=no_user');
        }
        req.logIn(user, (loginErr) => {
            if (loginErr) {
                console.error('OAuth login error:', loginErr.message);
                return res.redirect('/?auth_error=login_failed');
            }
            res.redirect('/dashboard');
        });
    })(req, res, next);
});

router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/');
    });
});

module.exports = router;
