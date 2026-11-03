// Optimize libuv threadpool size for concurrent CPU-bound crypto/bcrypt tasks
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || "16";

const app = require("./index");
const testConnect = require("./db/testConnect");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await testConnect();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`API iniciada na porta ${PORT}.`);
    });
  } catch (error) {
    console.error("Não foi possível iniciar a API:", error.message);
    process.exit(1);
  }
}

startServer();
