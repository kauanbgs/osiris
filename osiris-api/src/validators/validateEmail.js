const pool = require("../db/connect");

async function emailAlreadyExists(email) {
  const [rows] = await pool.promise().execute(
    "SELECT id_user FROM user WHERE email = ? LIMIT 1",
    [email],
  );

  return rows.length > 0;
}

module.exports = emailAlreadyExists;
