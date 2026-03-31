const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
});

// Auto-initialize schema on first connection
async function initSchema() {
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schema);
        console.log('Database schema initialized successfully');
    } catch (err) {
        console.error('Schema initialization error:', err.message);
    }
}

initSchema();

module.exports = pool;
