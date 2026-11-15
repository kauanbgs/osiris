// verifyJWT.js — confere o token de login enviado no cabeçalho Authorization das rotas protegidas.
// Recusa tokens revogados (logout) e tickets de uso restrito, como o do proxy do Navegador.
const jwt = require("jsonwebtoken");
const { UnauthorizedError } = require("../errors");
const { isTokenRevoked } = require("../services/tokenService");

async function verifyJWT(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Token not provided."));
  }

  const token = authorization.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Tickets com escopo (ex.: proxy do Navegador) não valem como login.
    if (payload.escopo) {
      return next(new UnauthorizedError("Invalid token."));
    }

    if (await isTokenRevoked(token)) {
      return next(new UnauthorizedError("Token has been revoked."));
    }

    req.userId = payload.sub;
    req.token = token;
    req.tokenPayload = payload;
    return next();
  } catch (error) {
    const message =
      error.name === "TokenExpiredError"
        ? "Token expired. Please login again."
        : error instanceof UnauthorizedError
        ? error.message
        : "Invalid token.";

    return next(new UnauthorizedError(message));
  }
}

module.exports = verifyJWT;
