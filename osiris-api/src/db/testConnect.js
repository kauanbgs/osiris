const pool = require("./connect");

async function testConnect() {
  const connection = await pool.promise().getConnection();
  connection.release();
  console.log("Conexão com o banco de dados estabelecida.");
}

module.exports = testConnect;
