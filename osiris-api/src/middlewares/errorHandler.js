const AppError = require("../errors/AppError");

/**
 * Sanitizes error details to avoid exposing sensitive information
 */
function sanitizeError(error) {
  const sanitized = {
    message: error.message,
    ...(error.statusCode && { statusCode: error.statusCode }),
    ...(error.timestamp && { timestamp: error.timestamp }),
  };

  return sanitized;
}

/**
 * Logs error details for debugging (excludes sensitive data)
 */
function logError(error, req) {
  const isDevelopment = process.env.NODE_ENV !== "production";

  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    statusCode: error.statusCode || 500,
    message: error.message,
    ...(isDevelopment && error.stack && { stack: error.stack }),
    ...(error.isOperational !== undefined && { isOperational: error.isOperational }),
  };

  // Don't log passwords, tokens, or other sensitive fields
  if (req.body) {
    const safeBody = { ...req.body };
    delete safeBody.password;
    delete safeBody.token;
    delete safeBody.api_key;
    logData.body = safeBody;
  }

  console.error("[ERROR]", JSON.stringify(logData, null, 2));
}

/**
 * Handles database errors
 */
function handleDatabaseError(error) {
  let message = "Database error occurred.";
  let statusCode = 500;

  // MySQL/MariaDB error codes
  switch (error.code) {
    case "ER_DUP_ENTRY":
      message = "Duplicate entry. This record already exists.";
      statusCode = 409;
      break;
    case "ER_NO_REFERENCED_ROW":
    case "ER_NO_REFERENCED_ROW_2":
      message = "Referenced resource not found.";
      statusCode = 404;
      break;
    case "ER_ROW_IS_REFERENCED":
    case "ER_ROW_IS_REFERENCED_2":
      message = "Cannot delete. Resource is being used.";
      statusCode = 409;
      break;
    case "ER_BAD_FIELD_ERROR":
      message = "Invalid field in query.";
      statusCode = 400;
      break;
    case "ER_PARSE_ERROR":
      message = "Query syntax error.";
      statusCode = 400;
      break;
    case "ECONNREFUSED":
      message = "Database connection refused.";
      statusCode = 503;
      break;
    case "PROTOCOL_CONNECTION_LOST":
      message = "Database connection lost.";
      statusCode = 503;
      break;
    default:
      message = "Database error occurred.";
      statusCode = 500;
  }

  return new AppError(message, statusCode, false);
}

/**
 * Global error handler middleware
 */
function errorHandler(error, req, res, next) {
  const isDevelopment = process.env.NODE_ENV !== "production";

  // Handle database errors
  if (error.code && error.code.startsWith("ER_")) {
    error = handleDatabaseError(error);
  }

  // Handle MySQL connection errors
  if (error.code === "ECONNREFUSED" || error.code === "PROTOCOL_CONNECTION_LOST") {
    error = handleDatabaseError(error);
  }

  // Default to 500 if no status code
  const statusCode = error.statusCode || 500;
  const isOperational = error.isOperational !== undefined ? error.isOperational : false;

  // Log the error
  logError(error, req);

  // Prepare response
  const response = {
    error: {
      message: error.message || "Internal server error.",
      statusCode,
      timestamp: error.timestamp || new Date().toISOString(),
    },
  };

  // Add stack trace only in development for unexpected errors
  if (isDevelopment && !isOperational && error.stack) {
    response.error.stack = error.stack;
  }

  // Send response
  return res.status(statusCode).json(response);
}

/**
 * Handles 404 - Route not found
 */
function notFoundHandler(req, res) {
  return res.status(404).json({
    error: {
      message: "Route not found.",
      statusCode: 404,
      timestamp: new Date().toISOString(),
    },
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
