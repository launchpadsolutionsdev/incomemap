-- IncomeMap Database Schema

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolios (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS holdings (
    id SERIAL PRIMARY KEY,
    portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    exchange VARCHAR(10) NOT NULL,
    shares DECIMAL(12,4) NOT NULL,
    avg_cost DECIMAL(12,4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'CAD',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dividend_cache (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) NOT NULL,
    exchange VARCHAR(10) NOT NULL,
    dividend_amount DECIMAL(12,6),
    dividend_yield DECIMAL(8,6),
    frequency VARCHAR(20),
    ex_date DATE,
    payment_date DATE,
    annual_dividend DECIMAL(12,6),
    last_updated TIMESTAMP DEFAULT NOW(),
    UNIQUE(ticker, exchange)
);

CREATE TABLE IF NOT EXISTS dividend_history (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) NOT NULL,
    exchange VARCHAR(10) NOT NULL,
    amount DECIMAL(12,6) NOT NULL,
    ex_date DATE NOT NULL,
    payment_date DATE,
    currency VARCHAR(3) DEFAULT 'CAD',
    last_updated TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forex_cache (
    id SERIAL PRIMARY KEY,
    pair VARCHAR(10) NOT NULL,
    rate DECIMAL(12,6) NOT NULL,
    date DATE NOT NULL,
    source VARCHAR(50) DEFAULT 'Bank of Canada',
    last_updated TIMESTAMP DEFAULT NOW(),
    UNIQUE(pair, date)
);

-- Session table for connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
    "sid" VARCHAR NOT NULL COLLATE "default",
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,
    PRIMARY KEY ("sid")
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_portfolio_id ON holdings(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_dividend_cache_ticker ON dividend_cache(ticker, exchange);
CREATE INDEX IF NOT EXISTS idx_dividend_history_ticker ON dividend_history(ticker, exchange);
CREATE INDEX IF NOT EXISTS idx_forex_cache_pair_date ON forex_cache(pair, date);
