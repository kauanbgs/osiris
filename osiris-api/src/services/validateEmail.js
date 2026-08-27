const pool = require("../db/connect");

async function emailAlreadyExists(email) {
  const [rows] = await pool.execute(
    "SELECT id FROM usuarios WHERE email = ? LIMIT 1",
    [email],
  );

  return rows.length > 0;
}

module.exports = emailAlreadyExists;

