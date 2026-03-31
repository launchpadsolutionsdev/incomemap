function errorHandler(err, req, res, next) {
    console.error('Error:', err.message);
    console.error(err.stack);

    const statusCode = err.status || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Something went wrong. Please try again.'
        : err.message;

    if (req.path.startsWith('/api/')) {
        return res.status(statusCode).json({ error: message });
    }

    res.status(statusCode).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Error — incomemap</title>
            <link rel="stylesheet" href="/css/style.css">
        </head>
        <body style="background: var(--im-bg); display: flex; align-items: center; justify-content: center; min-height: 100vh;">
            <div style="text-align: center; padding: 2rem;">
                <h1 style="font-family: Georgia, serif; color: var(--im-primary); font-size: 2rem;">Something went wrong</h1>
                <p style="color: var(--im-text-muted); margin: 1rem 0;">${message}</p>
                <a href="/" style="color: var(--im-primary); text-decoration: underline;">Go home</a>
            </div>
        </body>
        </html>
    `);
}

module.exports = errorHandler;
