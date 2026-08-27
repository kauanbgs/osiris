const path = require("node:path");

require("dotenv-safe").config({
  path: path.resolve(process.cwd(), ".env"),
  example: path.resolve(process.cwd(), ".env.example"),
});

module.exports = {
  port: Number(process.env.PORT) || 5000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  database: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
};

