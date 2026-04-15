/**
 * SICHER — Express API Gateway
 * 
 * Main entry point. Configures middleware, routes, and serves
 * the Next.js frontend alongside the API.
 */

const express = require('express');
const path = require('path');
const morgan = require('morgan');
const { applySecurityMiddleware } = require('./middleware/security');
const { globalErrorHandler, setupProcessErrorHandlers } = require('./middleware/errorHandler');

// Route handlers
const routeRouter = require('./routes/route');
const historyRouter = require('./routes/history');
const geocodeRouter = require('./routes/geocode');
const healthRouter = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 8080;

// --- Process-level error handling ---
setupProcessErrorHandlers();

// --- Middleware Stack ---
// 1. Request logging (structured JSON in production, dev format otherwise)
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// 2. Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// 3. Security middleware (Helmet, CORS, Rate Limit, HPP)
applySecurityMiddleware(app);

// --- API Routes ---
app.use('/api/route', routeRouter);
app.use('/api/history', historyRouter);
app.use('/api/geocode', geocodeRouter);
app.use('/api/health', healthRouter);

// --- Serve Frontend ---
// Serve static files from the frontend build
const frontendPath = path.join(__dirname, '..', 'frontend', 'out');
app.use(express.static(frontendPath));

// Also serve from frontend/public for dev
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Don't serve HTML for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }

  const indexPath = path.join(frontendPath, 'index.html');
  const fallbackPath = path.join(__dirname, '..', 'frontend', 'public', 'index.html');
  
  try {
    if (require('fs').existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else if (require('fs').existsSync(fallbackPath)) {
      res.sendFile(fallbackPath);
    } else {
      res.status(200).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><title>SICHER</title></head>
        <body style="background:#0a0a0f;color:#e8e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center">
            <h1>🛡️ SICHER API</h1>
            <p>Safety-first navigation engine is running.</p>
            <p>API: <a href="/api/health" style="color:#00ff88">/api/health</a></p>
          </div>
        </body>
        </html>
      `);
    }
  } catch (_err) {
    res.status(500).json({ error: 'Frontend not available' });
  }
});

// --- Global Error Handler (must be last) ---
app.use(globalErrorHandler);

// --- Start Server ---
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║         🛡️  SICHER v1.0.0              ║
║   Safety-First Navigation Engine        ║
║                                         ║
║   Server:  http://localhost:${PORT}        ║
║   Health:  http://localhost:${PORT}/api/health ║
║   Env:     ${(process.env.NODE_ENV || 'development').padEnd(29)}║
╚══════════════════════════════════════════╝
    `);
  });
}

module.exports = app;
