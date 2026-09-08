// Only load dotenv-safe if not in test environment (test env vars are set in setup.js)
if (process.env.NODE_ENV !== "test") {
  require("dotenv-safe").config();
}
const express = require("express");
const cors = require("cors");
const apiRoutes = require("./routes/apiRoutes");
const { errorHandler, notFoundHandler } = require("./middlewares/errorHandler");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api/osiris", apiRoutes);

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

module.exports = app;
