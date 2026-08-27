const mysql = require("mysql2/promise");
const env = require("../config/env");

const pool = mysql.createPool({
  ...env.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;

