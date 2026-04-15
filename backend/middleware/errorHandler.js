/**
 * SICHER Global Error Handler
 * 
 * Catches all unhandled errors, sanitizes the response,
 * and logs structured error data for Cloud Logging.
 */

/**
 * Express error-handling middleware.
 * Must have 4 parameters to be recognized as error handler.
 */
function globalErrorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // Structured error log for Cloud Logging
  const errorLog = {
    severity: statusCode >= 500 ? 'ERROR' : 'WARNING',
    message: err.message,
    httpRequest: {
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      status: statusCode,
      remoteIp: req.headers['x-forwarded-for'] || req.ip,
      userAgent: req.headers['user-agent'],
    },
    timestamp: new Date().toISOString(),
  };

  // Include stack trace in development only
  if (!isProduction) {
    errorLog.stack = err.stack;
  }

  console.error(JSON.stringify(errorLog));

  // Sanitize error response — never leak internal details
  const response = {
    error: {
      message: isProduction ? getPublicMessage(statusCode) : err.message,
      code: statusCode,
      ...(err.details && { details: err.details }),
    },
  };

  res.status(statusCode).json(response);
}

/**
 * Returns a safe, generic error message for production.
 * 
 * @param {number} code - HTTP status code
 * @returns {string} Public-facing error message
 */
function getPublicMessage(code) {
  const messages = {
    400: 'Invalid request. Please check your input.',
    401: 'Authentication required.',
    403: 'Access denied.',
    404: 'Resource not found.',
    429: 'Too many requests. Please wait and try again.',
    500: 'An internal error occurred. Please try again later.',
    502: 'Service temporarily unavailable.',
    503: 'Service under maintenance. Please try again later.',
  };
  return messages[code] || 'An unexpected error occurred.';
}

/**
 * Handles unhandled promise rejections and uncaught exceptions.
 * Logs and exits gracefully (Cloud Run will restart the container).
 */
function setupProcessErrorHandlers() {
  process.on('unhandledRejection', (reason, promise) => {
    console.error(JSON.stringify({
      severity: 'CRITICAL',
      message: 'Unhandled Promise Rejection',
      reason: reason?.message || String(reason),
      stack: reason?.stack,
      timestamp: new Date().toISOString(),
    }));
  });

  process.on('uncaughtException', (error) => {
    console.error(JSON.stringify({
      severity: 'CRITICAL',
      message: 'Uncaught Exception — shutting down',
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }));
    process.exit(1);
  });

  console.log('[SICHER] Process error handlers registered');
}

module.exports = {
  globalErrorHandler,
  setupProcessErrorHandlers,
};
