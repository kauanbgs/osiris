// index.js — monta o app Express da API: CORS, leitura de JSON, rotas em /api/osiris e tratamento de erros.
// O atalho /api/exec continua levando ao terminal, que roda no PC do usuário pelo app desktop.
// Only load dotenv-safe if not in test environment (test env vars are set in setup.js)
if (process.env.NODE_ENV !== "test") {
  require("dotenv-safe").config();
}
const express = require("express");
const cors = require("cors");
const apiRoutes = require("./routes/apiRoutes");
const verifyJWT = require("./middlewares/verifyJWT");
const PonteDesktopController = require("./controllers/ponteDesktopController");
const { errorHandler, notFoundHandler } = require("./middlewares/errorHandler");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Atalho antigo usado por versões anteriores do app mobile.
app.post("/api/exec", verifyJWT, PonteDesktopController.executarComando);

app.use("/api/osiris", apiRoutes);

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

module.exports = app;
