# 🌍 SwahiliSME Platform

> *"Teknolojia kwa Lugha Yetu, Mafanikio kwa Biashara Zetu"*  
> *Technology in Our Language, Success for Our Businesses*

[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![Deployed on Railway](https://img.shields.io/badge/Backend-Railway-purple.svg)](https://railway.app)
[![Deployed on Vercel](https://img.shields.io/badge/Frontend-Vercel-black.svg)](https://vercel.com)

---

## 🎯 Vision

**People First. Service. Simplicity.**  
We build AI tools that understand what SME owners in East Africa need — in their language, for their reality.

---

## 📁 Repository Structure

```
swahilisme-platform/
│
├── backend/                        # FastAPI — deploy to Railway
│   ├── api/
│   │   ├── app.py                  # FastAPI entry point
│   │   └── routes/
│   │       ├── __init__.py
│   │       └── dashboard.py        # 1.6 Analytics endpoints
│   ├── services/
│   │   └── analytics.py            # Business logic
│   ├── requirements.txt            # Python dependencies
│   ├── Procfile                    # Railway start command
│   └── railway.json                # Railway config
│
├── frontend/                       # React PWA — deploy to Vercel
│   ├── public/
│   │   ├── index.html
│   │   ├── manifest.json           # 1.8.3 PWA config
│   │   └── sw.js                   # 1.8.3 Service Worker (offline)
│   ├── src/
│   │   ├── App.js
│   │   ├── index.js
│   │   ├── components/
│   │   │   └── AnalyticsDashboard.js   # 1.6.1 / 1.6.2 / 1.6.3
│   │   ├── hooks/
│   │   │   └── useOfflineSync.js       # 1.8.3 Offline hook
│   │   └── i18n/
│   │       └── sw.json                 # 1.8.1 Swahili strings
│   ├── package.json
│   └── vercel.json                 # Vercel config
│
├── .env.example                    # Environment variables template
├── .gitignore
└── README.md
```

---

## 🚀 Deployment (Step-by-Step)

### Backend → Railway

1. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub**
2. Select `swahilisme-platform` repo → select **`backend/`** as root
3. Add environment variables from `.env.example`
4. Railway auto-detects `Procfile` and deploys

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project → Import Git Repository**
2. Select `swahilisme-platform` → set **Root Directory** to `frontend`
3. Add env variable: `REACT_APP_API_URL=https://your-railway-url.up.railway.app`
4. Click Deploy

### Database → Supabase

1. Go to your [Supabase dashboard](https://supabase.com/dashboard)
2. Create a new project → copy the **Connection String**
3. Add to Railway env vars as `DATABASE_URL`

---

## 🏃 Local Development

```bash
# Clone
git clone https://github.com/PatrickIIT/swahilisme-platform.git
cd swahilisme-platform

# Backend
cd backend
pip install -r requirements.txt
cp ../.env.example .env
uvicorn api.app:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger UI)

# Frontend (new terminal)
cd frontend
npm install
npm start
# → http://localhost:3000
```

---

## 📊 Live API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Welcome message |
| `GET /health` | Health check |
| `GET /api/v1/dashboard/summary` | Revenue/cost/profit summary |
| `GET /api/v1/dashboard/revenue-cost-profit` | Chart time-series data |
| `GET /api/v1/dashboard/top-products` | Top products by revenue |
| `GET /api/v1/dashboard/spending-patterns` | Expense category breakdown |

---

## 🗺️ Roadmap

| Phase | Features | Timeline |
|-------|----------|----------|
| **MVP v1.0** | Dashboard + WhatsApp + PWA | ✅ May 2026 |
| **v1.1** | Daftari Yangu (voice bookkeeping) | June 2026 |
| **v1.2** | Mshauri Wangu (compliance chatbot) | July 2026 |
| **v1.3** | M-Pesa integration | August 2026 |
| **v2.0** | Multi-language, cloud scale | Q4 2026 |

---

<div align="center">

Built with ❤️ for African SMEs · DASUC Project 2026  
*"Teknolojia kwa Lugha Yetu, Mafanikio kwa Biashara Zetu"*

</div>
