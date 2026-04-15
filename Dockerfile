# ====================================================
# SICHER — Multi-Stage Dockerfile
# Stage 1: Build Next.js frontend (static export)
# Stage 2: Production Node.js server
# ====================================================

# --- Stage 1: Build Frontend ---
FROM node:20-alpine AS frontend-builder

WORKDIR /build/frontend

# Install dependencies
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --ignore-scripts 2>/dev/null || npm install

# Copy source and build
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Production ---
FROM node:20-alpine AS production

# Security: run as non-root
RUN addgroup -g 1001 -S sicher && \
    adduser -S sicher -u 1001 -G sicher

WORKDIR /app

# Install backend dependencies
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm ci --omit=dev --ignore-scripts 2>/dev/null || cd backend && npm install --omit=dev

# Copy backend source
COPY backend/ ./backend/

# Copy frontend build output
COPY --from=frontend-builder /build/frontend/out ./frontend/out

# Ensure data directory is writable
RUN mkdir -p /app/backend/data && \
    chown -R sicher:sicher /app

# Switch to non-root user
USER sicher

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8080/api/health || exit 1

# Environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Start the Express server
CMD ["node", "backend/server.js"]
