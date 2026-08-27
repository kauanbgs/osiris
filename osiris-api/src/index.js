require("dotenv-safe").config();
const express = require("express");
const cors = require("cors");
const apiRoutes = require("./routes/apiRoutes");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api/osiris", apiRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Erro interno do servidor." });
});

module.exports = app;
