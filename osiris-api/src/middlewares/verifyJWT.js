const jwt = require("jsonwebtoken");
const { UnauthorizedError } = require("../errors");

function verifyJWT(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Token not provided.");
  }

  const token = authorization.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    return next();
  } catch (error) {
    const message =
      error.name === "TokenExpiredError"
        ? "Token expired. Please login again."
        : "Invalid token.";

    throw new UnauthorizedError(message);
  }
}

module.exports = verifyJWT;
