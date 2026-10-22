const mysql = require("mysql2");

const pool = mysql.createPool({
    connectionLimit: Number(process.env.DB_POOL_LIMIT) || 20,
    waitForConnections: true,
    queueLimit: 100,
    idleTimeout: 30000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

module.exports = pool;
