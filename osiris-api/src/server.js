const app = require("./index");
const env = require("./config/env");
const testConnect = require("./db/testConnect");

async function startServer() {
  try {
    await testConnect();
    app.listen(env.port, () => {
      console.log(`API iniciada na porta ${env.port}.`);
    });
  } catch (error) {
    console.error("Não foi possível iniciar a API:", error.message);
    process.exit(1);
  }
}

startServer();

