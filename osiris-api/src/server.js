const app = require("./index");
const testConnect = require("./db/testConnect");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await testConnect();
    app.listen(PORT, () => {
      console.log(`API iniciada na porta ${PORT}.`);
    });
  } catch (error) {
    console.error("Não foi possível iniciar a API:", error.message);
    process.exit(1);
  }
}

startServer();
