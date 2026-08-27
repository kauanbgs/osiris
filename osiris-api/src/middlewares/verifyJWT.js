const jwt = require("jsonwebtoken");
const env = require("../config/env");

function verifyJWT(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido." });
  }

  const token = authorization.slice(7);

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.userId = payload.sub;
    return next();
  } catch (error) {
    const message =
      error.name === "TokenExpiredError"
        ? "Token expirado. Faça login novamente."
        : "Token inválido.";

    return res.status(401).json({ error: message });
  }
}

module.exports = verifyJWT;

