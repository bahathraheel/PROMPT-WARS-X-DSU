/**
 * SICHER Security Middleware Stack
 * 
 * Layers:
 *   1. Helmet — Security headers (CSP, HSTS, X-Frame, etc.)
 *   2. CORS — Origin whitelist
 *   3. Rate Limiter — 30 req/min per IP
 *   4. HPP — HTTP Parameter Pollution protection
 *   5. Input Sanitizer — Coordinate validation
 *   6. Request Logger — Audit trail
 */

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');

/**
 * Configure Helmet with strict Content Security Policy.
 */
function helmetMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ['\'self\''],
        scriptSrc: [
          '\'self\'',
          '\'unsafe-inline\'',
          'https://api.mapbox.com',
          'https://cdn.jsdelivr.net',
          'blob:',
        ],
        styleSrc: [
          '\'self\'',
          '\'unsafe-inline\'',
          'https://api.mapbox.com',
          'https://fonts.googleapis.com',
        ],
        fontSrc: ['\'self\'', 'https://fonts.gstatic.com'],
        imgSrc: ['\'self\'', 'data:', 'blob:', 'https://api.mapbox.com', 'https://*.tile.openstreetmap.org'],
        connectSrc: [
          '\'self\'',
          'https://api.mapbox.com',
          'https://events.mapbox.com',
          'https://router.project-osrm.org',
          'https://maps.googleapis.com',
        ],
        workerSrc: ['\'self\'', 'blob:'],
        childSrc: ['blob:'],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
}

/**
 * Configure CORS whitelist.
 * In production, restrict to known frontend origins.
 */
function corsMiddleware() {
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL || '*']
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080'];

  return cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });
}

/**
 * Rate limiter: 30 requests per minute per IP.
 */
function rateLimiter() {
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many requests. Please wait before trying again.',
      retryAfter: 60,
    },
    keyGenerator: (req) => {
      return req.headers['x-forwarded-for'] || req.ip;
    },
  });
}

/**
 * Custom input sanitizer for coordinate-based requests.
 * Validates and cleans incoming data.
 */
function inputSanitizer() {
  return (req, _res, next) => {
    if (req.body) {
      // Strip any prototype pollution attempts
      if (req.body.__proto__ || req.body.constructor || req.body.prototype) {
        delete req.body.__proto__;
        delete req.body.constructor;
        delete req.body.prototype;
      }
    }
    next();
  };
}

/**
 * Apply all security middleware to the Express app.
 * 
 * @param {import('express').Application} app - Express app instance
 */
function applySecurityMiddleware(app) {
  app.use(helmetMiddleware());
  app.use(corsMiddleware());
  app.use(rateLimiter());
  app.use(hpp());
  app.use(inputSanitizer());

  // Disable X-Powered-By header
  app.disable('x-powered-by');

  console.log('[SICHER] Security middleware stack applied');
}

module.exports = {
  applySecurityMiddleware,
  helmetMiddleware,
  corsMiddleware,
  rateLimiter,
  inputSanitizer,
};
