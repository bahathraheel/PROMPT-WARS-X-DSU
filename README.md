# 🛡️ SICHER — Safety-First Navigation Platform

> **Find the safest walking route.** SICHER scores every path by lighting, foot traffic, CCTV coverage, and emergency service proximity—then shows you which way to walk.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18
- **npm** ≥ 9
- (Optional) **Python** ≥ 3.12 for the FastAPI engine

### 1. Install Dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys (or leave defaults for demo mode)
```

### 3. Run Development Server

```bash
# Start Express backend (port 8080)
cd backend && npm run dev

# In another terminal: Start Next.js frontend (port 3001)
cd frontend && npm run dev
```

### 4. LIVE URL
https://sicher-764833808302.us-central1.run.app

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Next.js React  │────▶│  Express Gateway  │────▶│  OSRM Routing   │
│  Mapbox GL JS   │     │  /api/route       │     │  (external)     │
│  3D Globe Intro │     │  /api/geocode     │     └─────────────────┘
└─────────────────┘     │  /api/history     │     ┌─────────────────┐
                        │  Security Stack   │────▶│ Safety Scorer   │
                        └──────────────────┘     │ (safety_grid)   │
                                                  └─────────────────┘
```

## 📁 Project Structure

| Directory | Purpose |
|---|---|
| `frontend/` | Next.js 14 React app with Mapbox GL JS |
| `backend/` | Express.js API gateway with security middleware |
| `engine/` | Python FastAPI safety scoring engine |
| `tests/` | Jest + Pytest test suites |

## 🔒 Security

- **Helmet** CSP headers
- **Rate limiting** (30 req/min per IP)
- **Input validation** (Joi + Pydantic)
- **CORS** whitelist
- **Non-root** Docker user
- **No API keys** in frontend bundle

## ☁️ Google Cloud Services

| Service | Usage |
|---|---|
| Cloud Run | Serverless deployment |
| Secret Manager | API key storage |
| Cloud Monitoring | Custom metrics (latency, scores) |
| Cloud Logging | Structured JSON logs |
| Maps Geocoding | Address → coordinates |

## 🧪 Testing

```bash
# JavaScript tests (backend)
cd backend && npm test

# Python tests (engine)
cd engine && python -m pytest ../tests/unit/test_scorer.py -v

# Validation script
cd backend && npm run validate
```

## 🐳 Docker

```bash
# Build
docker build -t sicher .

# Run (mirrors Cloud Run: 512Mi)
docker run -p 8080:8080 --memory=512m sicher
```

## 🚀 Deploy to Cloud Run

```bash
gcloud run deploy sicher \
  --source . \
  --region us-central1 \
  --memory 512Mi \
  --cpu 1 \
  --port 8080 \
  --allow-unauthenticated \
  --project YOUR_PROJECT_ID
```

## ♿ Accessibility

- WCAG 2.1 AA compliant
- Full keyboard navigation
- Screen reader announcements
- `prefers-reduced-motion` support
- Skip navigation links
- 4.5:1 contrast ratio

---

Built for **PROMPT-WARS-X-DSU** 🛡️