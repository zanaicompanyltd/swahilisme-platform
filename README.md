# 🌍 SwahiliSME Platform

> *"Teknolojia kwa Lugha Yetu, Mafanikio kwa Biashara Zetu"*
> *"Technology in Our Language, Success for Our Businesses"*

[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![Backend](https://img.shields.io/badge/Backend-Railway-purple.svg)](https://railway.app)
[![Frontend](https://img.shields.io/badge/Frontend-Vercel-black.svg)](https://swahilisme-platform.vercel.app)
[![Database](https://img.shields.io/badge/Database-Supabase-green.svg)](https://supabase.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

---

## 🌐 Live Links

| Service | URL |
|---------|-----|
| **Frontend (Vercel)** | https://swahilisme-platform.vercel.app |
| **Backend API (Railway)** | https://swahilisme-platform-production-b5b9.up.railway.app/ |
| **API Docs (Swagger)** | https://swahilisme-platform-production-b5b9.up.railway.app/docs |
| **Database (Supabase)** | https://supabase.com/dashboard/org/tfegkxauyfsscdmwsuxn |

---

## 📖 Our Vision

**The Why:** In everything we do, we believe in the beauty of the human experience. We believe that technology should be a light that helps every person shine and reach their goals.

**The How:** We make tools that truly understand what people need and how they feel. We build products to be helpful, friendly, and easy for everyone.

**The What:** We just happen to make great AI and data products.

### Our Values
| Value | Meaning |
|-------|---------|
| **People First** | We care about the person more than the tool |
| **Service** | We build to help others, not ourselves |
| **Simplicity** | We make hard things easy for everyone to use |

---

## 🎯 What is SwahiliSME Platform?

An **AI-powered business management platform** for **Small and Medium Enterprises (SMEs) in East Africa**, built entirely in **Swahili** — the language 43 million people actually speak.

### The Problem We Solve

| Problem | Impact |
|---------|--------|
| ❌ Manual bookkeeping on paper | No financial visibility |
| ❌ English-only digital tools | Language barrier for most SME owners |
| ❌ No formal financial records | Excluded from credit markets |
| ❌ Unknown regulatory requirements | TRA/BRELA/SIDO penalties |
| ❌ No internet in many areas | Digital tools are unusable offline |

### Our Solution — Module Overview

| # | Module | Description | Status |
|---|--------|-------------|--------|
| 1.3 | **📒 Daftari Yangu** | Voice-to-text bookkeeping in Swahili; generates Business Health Card PDF | 🚧 v1.1 |
| 1.4 | **🎓 Mshauri Wangu** | RAG-based AI chatbot for TRA/BRELA/SIDO compliance questions | 🚧 v1.2 |
| 1.5 | **💼 Sales & Expense Tracker** | Text-based transaction input with P&L engine | 🚧 v1.1 |
| 1.6 | **📊 Analytics Dashboard** | Revenue/cost/profit charts, top products, spending patterns | ✅ MVP |
| 1.7 | **💬 WhatsApp Integration** | Weekly automated business summaries via WhatsApp | ✅ MVP |
| 1.8 | **📱 Frontend PWA** | Offline-first mobile web app in Swahili | ✅ MVP |

---

## 📁 Repository Structure

```
swahilisme-platform/
│
├── backend/                              # FastAPI — deployed on Railway
│   ├── api/
│   │   ├── __init__.py
│   │   ├── app.py                        # FastAPI entry point + CORS
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── dashboard.py              # 1.6.1 / 1.6.2 / 1.6.3 endpoints
│   │       ├── transactions.py           # 1.5.1 / 1.5.3 transaction input
│   │       ├── whatsapp.py               # 1.7.1 webhook + 1.7.2 summary trigger
│   │       ├── compliance.py             # 1.4 Mshauri Wangu endpoints
│   │       └── auth.py                   # User authentication
│   ├── services/
│   │   ├── __init__.py
│   │   ├── analytics.py                  # 1.6 Dashboard business logic
│   │   ├── asr/                          # 1.3.1 Whisper ASR (Tanzanian Swahili)
│   │   ├── nlp/                          # 1.3.2 NER pipeline (amount/category/date)
│   │   ├── rag/                          # 1.4.2 RAG pipeline (Claude/GPT backbone)
│   │   ├── whatsapp/                     # 1.7 WhatsApp Cloud API client + tasks
│   │   │   ├── client.py                 # 1.7.1 API setup
│   │   │   └── tasks.py                  # 1.7.2 Celery weekly summary scheduler
│   │   └── pdf/                          # 1.3.4 Business Health Card generator
│   ├── db/
│   │   └── migrations/                   # Supabase SQL migrations
│   ├── requirements.txt                  # Python dependencies
│   ├── Procfile                          # Railway: uvicorn start command
│   └── railway.json                      # Railway deployment config
│
├── frontend/                             # React PWA — deployed on Vercel
│   ├── public/
│   │   ├── index.html                    # App shell (lang="sw")
│   │   ├── manifest.json                 # 1.8.3 PWA manifest
│   │   └── sw.js                         # 1.8.3 Service Worker (offline queue)
│   ├── src/
│   │   ├── App.js                        # Root component
│   │   ├── index.js                      # React entry point
│   │   ├── components/
│   │   │   ├── AnalyticsDashboard.js     # 1.6.1 / 1.6.2 / 1.6.3 full dashboard
│   │   │   ├── DaftariYangu.js           # 1.3 Voice bookkeeping UI (v1.1)
│   │   │   ├── MshauriWangu.js           # 1.4 Compliance chatbot UI (v1.2)
│   │   │   └── TransactionForm.js        # 1.5.1 Text transaction input (v1.1)
│   │   ├── hooks/
│   │   │   └── useOfflineSync.js         # 1.8.3 Service Worker registration + sync
│   │   └── i18n/
│   │       └── sw.json                   # 1.8.1 All Swahili UI strings
│   ├── package.json
│   ├── .env                              # SKIP_PREFLIGHT_CHECK=true
│   └── vercel.json                       # Vercel SPA routing config
│
├── data/
│   ├── raw/                              # Raw regulatory documents (TRA/BRELA/SIDO)
│   ├── processed/                        # Vector store embeddings for RAG
│   └── external/                         # M-Pesa, Airtel Money datasets
│
├── models/                               # Trained ML models (Whisper fine-tuned)
├── tests/
│   ├── unit/                             # 1.9.1 Unit tests
│   ├── integration/                      # 1.9.2 Integration tests
│   └── e2e/                              # 1.9.3 UAT with SME proxy users
│
├── docs/
│   ├── BA_BABOK_Guidelines.pdf           # 1.10.1 Business Analysis guideline
│   ├── PM_PMBOK_Guidelines.pdf           # 1.10.2 Project Management guideline
│   └── DEPLOYMENT.md                     # Step-by-step deployment guide
│
├── scripts/
│   └── seed_demo_data.py                 # Seed Supabase with demo transactions
│
├── .env.example                          # All environment variables documented
├── .gitignore
├── Dockerfile                            # Full-stack container (optional)
├── docker-compose.yml                    # Local dev with DB + Redis
└── README.md
```

---

## 🗂️ Work Breakdown Structure (WBS)

```
1. SwahiliSME Platform MVP
   │
   ├── 1.1 Project Management
   │       1.1.1 Project Charter
   │       1.1.2 Stakeholder Register
   │       1.1.3 Risk Register
   │       1.1.4 Daily Stand-up Facilitation
   │
   ├── 1.2 Business Analysis (CBAP / BABOK v3)
   │       1.2.1 Requirements Elicitation
   │       1.2.2 User Stories & Acceptance Criteria
   │       1.2.3 Business Rules Catalogue
   │       1.2.4 Requirements Traceability Matrix (RTM)
   │
   ├── 1.3 Module 1: Daftari Yangu (My Ledger) 🚧 v1.1
   │       1.3.1 ASR Integration (Whisper / Tanzanian Swahili + Kiunguja)
   │       1.3.2 NLP Pipeline (NER: amount, category, date, product)
   │       1.3.3 Ledger Storage & Offline Sync (SQLite WAL + PostgreSQL)
   │       1.3.4 Business Health Card PDF Generator (90 days / 30+ txn)
   │
   ├── 1.4 Module 2: Mshauri Wangu (My Advisor) 🚧 v1.2
   │       1.4.1 Regulatory Knowledge Base (TRA / BRELA / SIDO)
   │       1.4.2 RAG Pipeline (Claude / GPT-4 backbone + FAISS vector store)
   │       1.4.3 Confidence-Gating System (threshold: 0.75 / 0.50)
   │       1.4.4 Human Escalation Workflow (legal team / helpdesk)
   │
   ├── 1.5 Sales & Expense Tracker 🚧 v1.1
   │       1.5.1 Transaction Input (text)
   │       1.5.2 Category Management
   │       1.5.3 Revenue / Cost / Profit Calculation Engine
   │
   ├── 1.6 Analytics Dashboard ✅ MVP COMPLETE
   │       1.6.1 Revenue / Cost / Profit Charts (area chart, time-series)
   │       1.6.2 Top Products View (bar chart + ranked table)
   │       1.6.3 Spending Patterns (donut chart + progress bars)
   │
   ├── 1.7 WhatsApp Integration ✅ MVP COMPLETE
   │       1.7.1 WhatsApp Cloud API Setup (Meta webhook verification)
   │       1.7.2 Weekly Summary Webhook (Celery scheduler, Sunday 8AM EAT)
   │
   ├── 1.8 Frontend PWA ✅ MVP COMPLETE
   │       1.8.1 Swahili UI Components (i18n: sw.json, Georgia serif)
   │       1.8.2 Mobile-Responsive Layout (flex, min-width breakpoints)
   │       1.8.3 Offline-First PWA Configuration (Service Worker + background sync)
   │
   ├── 1.9 Testing & QA
   │       1.9.1 Unit Tests (pytest, Jest)
   │       1.9.2 Integration Tests (API contract tests)
   │       1.9.3 UAT with SME Proxy Users (voice dialect testing)
   │
   └── 1.10 Documentation & Presentation
           1.10.1 BA Guideline Document (CBAP / BABOK v3)
           1.10.2 PM Guideline Document (PMP / PMBOK 7th Ed.)
           1.10.3 Proposal Sections
           1.10.4 Slide Deck
           1.10.5 Demo Scripts (Swahili)
```

---

## 🚀 Live API — Test It Now

```bash
# ✅ Health check
curl https://swahilisme-platform-production-b5b9.up.railway.app/health

# ✅ 1.6.1 Revenue/Cost/Profit summary
curl "https://swahilisme-platform-production-b5b9.up.railway.app/api/v1/dashboard/summary?user_id=test123&period=week"

# ✅ 1.6.1 Chart time-series data
curl "https://swahilisme-platform-production-b5b9.up.railway.app/api/v1/dashboard/revenue-cost-profit?user_id=test123"

# ✅ 1.6.2 Top products
curl "https://swahilisme-platform-production-b5b9.up.railway.app/api/v1/dashboard/top-products?user_id=test123"

# ✅ 1.6.3 Spending patterns
curl "https://swahilisme-platform-production-b5b9.up.railway.app/api/v1/dashboard/spending-patterns?user_id=test123"

# ✅ Business Health Card status
curl "https://swahilisme-platform-production-b5b9.up.railway.app/api/v1/dashboard/health-card-status?user_id=test123"
```

### Example API Response (1.6.1 Summary)
```json
{
  "period": "week",
  "total_revenue": 125000,
  "total_cost": 58000,
  "net_profit": 67000,
  "profit_margin": 53.6,
  "transactions_count": 42
}
```

---

## 🛠 Tech Stack

### Backend
| Technology | Purpose | WBS |
|------------|---------|-----|
| FastAPI (Python 3.11) | REST API framework | 1.5 / 1.6 / 1.7 |
| PostgreSQL (Supabase) | Production database | 1.3.3 |
| SQLite + WAL | Offline local storage | 1.3.3 / 1.8.3 |
| Celery + Redis | WhatsApp task scheduler | 1.7.2 |

### AI / ML
| Technology | Purpose | WBS |
|------------|---------|-----|
| OpenAI Whisper (fine-tuned) | Tanzanian Swahili + Kiunguja ASR | 1.3.1 |
| spaCy + Transformers | NER: amount / category / date | 1.3.2 |
| Claude / GPT-4 (RAG) | Compliance chatbot answers | 1.4.2 |
| FAISS / Chroma | Regulatory KB vector store | 1.4.1 |

### Frontend
| Technology | Purpose | WBS |
|------------|---------|-----|
| React 18 + PWA | Offline-capable web app | 1.8 |
| Recharts | Data visualizations | 1.6.1 / 1.6.2 / 1.6.3 |
| sw.json (i18n) | Swahili UI strings | 1.8.1 |
| Service Worker | Offline queue + sync | 1.8.3 |
| WhatsApp Cloud API | Weekly push summaries | 1.7.1 |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| Railway | Backend hosting (FastAPI) |
| Vercel | Frontend hosting (React) |
| Supabase | PostgreSQL database + auth |
| GitHub Actions | CI/CD pipeline |

---

## 🏃 Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- Git

### Backend
```bash
git clone https://github.com/PatrickIIT/swahilisme-platform.git
cd swahilisme-platform/backend

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt
cp ../.env.example .env         # Fill in your values

uvicorn api.app:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs   (Swagger UI)
```

### Frontend
```bash
cd frontend
npm install
# Create .env with:
# REACT_APP_API_URL=http://localhost:8000
npm start
# → http://localhost:3000
```

---

## 🔐 Authentication

**Password login only — there is no SMS/OTP step.** The Africa's Talking SMS
OTP flow (and the WhatsApp OTP fallback) has been removed.

### Flow

```
Register:  POST /auth/register   { phone_number, full_name, password, ...profile }
           → 201 { access_token, refresh_token, user }        (logged in immediately)

Login:     POST /auth/login      { phone_number, password }
           → 200 { access_token, refresh_token, user }

Refresh:   POST /auth/refresh    { refresh_token }  → 200 { access_token }
Me:        GET  /auth/me         Authorization: Bearer <access_token>
Set/change password:
           POST /auth/set-password { new_password, current_password? }
           Authorization: Bearer <access_token>
```

### Security properties

- Passwords are hashed with **bcrypt** (cost 12) and never returned by the API;
  `user.to_dict()` exposes only `has_password: true|false`.
- Minimum length 8 characters, maximum 72 bytes (bcrypt limit).
- A wrong password and an unknown phone number return the **same** 401 message,
  so the API cannot be used to discover which numbers have accounts.
- `/auth/set-password` requires a valid Bearer token: it cannot be used to take
  over an account you are not already signed in to.
- `JWT_SECRET_KEY` must be set in production. If it is missing the server
  generates a random per-process key (tokens then stop working after a restart,
  but tokens can never be forged with a publicly known default).
- Logout is client-side: JWTs are stateless, so the browser discards the tokens
  (access 60 min, refresh 30 days).

### Existing accounts created during the OTP era

Their rows are untouched and the `otp_codes` table is preserved. Those rows
have `password_hash = NULL`, so they cannot log in until a password is set:

- while they still hold a valid token → `POST /auth/set-password` without
  `current_password`;
- otherwise an operator must reset the password for that user.

The new `users.password_hash` column is added automatically at startup by an
additive migration in `db/database.py` (`create_all()` never alters existing
tables). Existing rows keep `NULL`; no data is deleted.

---

## 🚀 Deployment (Railway / Docker)

### Import root — read this before changing anything

The backend modules import each other with **flat top-level paths**:

```python
from db.database import init_db      # not backend.db.database
from models.user import User         # not backend.models.user
from services.auth_service import ... # not backend.services.auth_service
from api.routes.auth import router   # not backend.api.routes.auth
```

That convention means **`backend/` itself must be the import root** — i.e. it
must be on `sys.path` / `PYTHONPATH`. Everything below follows from that rule:

| Context | Correct command | Import root |
|---|---|---|
| Docker / Railway | `/app/start.sh` | `/app/backend` (`WORKDIR` + `PYTHONPATH`) |
| Any plain `uvicorn` command | `uvicorn backend.api.app:app` (repo root) **or** `uvicorn api.app:app` (from `backend/`) | `/app/backend`, added by the app itself |
| Local dev | `cd backend && uvicorn api.app:app --reload` | `backend/` (cwd) |
| Local dev (script) | `python run.py` | `backend/` (set by the script) |

`backend/api/app.py` (and `backend/main.py`) now put the directory they live in
on `sys.path` **before** importing `db` / `models` / `services`. The import root
is therefore derived from the file's own location instead of from the working
directory or `PYTHONPATH`, so the app boots from *any* entrypoint — including a
platform start command such as
`uvicorn backend.api.app:app --host 0.0.0.0 --port $PORT` that bypasses
`start.sh` entirely. This is what a Railway dashboard **Start Command** override
does, and it is the reason a deploy can still crash with
`ModuleNotFoundError: No module named 'db'` even when the image is correct.

### Railway service settings

- **Start Command**: leave it **empty** (the image's `CMD ["/app/start.sh"]`
  is used), or set it to exactly `/app/start.sh`.
- **PORT**: Railway injects it; `start.sh` reads it and binds `0.0.0.0:$PORT`,
  falling back to `8000` when unset and ignoring non-numeric values.

🚫 **Do not put `--port $PORT` in the Railway Start Command.** Railway does not
always run that command through a shell, so `$PORT` arrives at uvicorn
literally and the container crash-loops with:

```text
Error: Invalid value for '--port': '$PORT' is not a valid integer.
```

That is exactly why the port is resolved inside `start.sh` instead of in the
start command. If a Start Command is saved in the Railway dashboard it
overrides the Dockerfile `CMD`, so clear it (or point it at `/app/start.sh`)
after deploying.

### Frontend says “Failed to fetch” (login / register does nothing)

That message comes from the **browser**, not the API: no response reached it
that it was allowed to read (dead host, service down, or missing CORS headers).
The backend's own log tells you nothing — it never saw the request.

Check the URL the build is actually calling:

```bash
curl -i https://<your-service>.up.railway.app/health
```

| Result | Meaning | Fix |
|---|---|---|
| `{"status":"ok"}` | API reachable | The build calls a different URL — set `REACT_APP_API_URL` to this one and redeploy |
| Railway page *“The train has not arrived at the station”* with **404** | Domain is **not provisioned** for that service | Railway → service → **Settings → Networking → Public Networking** → generate/copy the domain, then use that URL |
| Timeout / connection refused | Service down or not exposed | Check the deploy logs; generate a public domain |

Set the copied URL in **both** places, then redeploy the frontend:

1. `frontend/.env` → `REACT_APP_API_URL=https://<current-domain>`
2. Vercel → Project → **Settings → Environment Variables** → same name/value
   (Production), then **Redeploy without build cache**.

The login card now runs a `/health` probe on load and shows an orange banner
with the exact URL it cannot reach, so a stale domain is visible immediately
instead of only after submitting the form. The same URL is included in the
network error message (`Failed to fetch: <url> — …`).

`/health` is also the endpoint to check in the browser directly — it returns
`{"status":"ok","db_mode":"postgresql"}` when the API and database are up.

### Required environment variables

| Variable | Example | Notes |
|---|---|---|
| `DB_MODE` | `postgresql` | `sqlite` only for local dev |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | Supabase URL; `postgres://` is auto-rewritten to `postgresql+asyncpg://` |
| `GROQ_API_KEY` | `gsk_...` | Falls back to regex/mock services when unset |
| `JWT_SECRET_KEY` | random string | Never hard-code. Without it every restart generates an ephemeral key and all issued tokens stop working |

> Note: `api/routes/daftari.py` uses PostgreSQL-only SQL
> (`CURRENT_DATE - INTERVAL '30 days'`), so `/daftari/spending` and
> `/daftari/top-products` only return data on PostgreSQL, not on the SQLite
> fallback.

---

## 📱 WhatsApp Integration (1.7)

Weekly business summaries sent automatically every Sunday at 8:00 AM EAT:

```
🌟 *Muhtasari wa Wiki — Biashara ya Mama Zena*

📅 Wiki: 12 May – 18 May 2026

💰 Mapato:    TZS 125,000
💸 Gharama:   TZS  58,000
📈 Faida:     TZS  67,000
📦 Miamala:   42 iliyorekodiwa

🎉 Hongera! Biashara yako inakua vizuri.

_Kutoka SwahiliSME — Msaidizi wako wa biashara_ 🇹🇿
```

### Webhook Setup (1.7.1)
1. Go to [Meta Developers](https://developers.facebook.com) → create App
2. Set webhook URL: `https://swahilisme-platform-production-b5b9.up.railway.app/api/v1/whatsapp/webhook`
3. Verify token: `swahilisme_verify_2026`
4. Add `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` to Railway env vars

---

## 📄 Business Health Card (1.3.4)

After **90 days** of data and **30+ transactions**, users generate a PDF report for loan applications:

- Business name, owner, period
- Total revenue / cost / net profit
- Top 3 revenue-generating products
- Average daily revenue + 12-week trend chart
- Legal disclaimer in Swahili:
  > *"Hii ni muhtasari wa data ya biashara yako kwa matumizi ya maombi ya mkopo. Haijakaguliwa na wakala wa serikali."*

---

## 📊 Module 2 — Mshauri Wangu: Sample Q&A (1.4)

| User Question (Swahili) | Knowledge Source |
|-------------------------|-----------------|
| *"Nahitaji leseni gani kuuza nguo mitumba?"* | BRELA + Municipal council |
| *"TRA inataka nini kutoka kwangu?"* | TRA — TIN, VAT threshold, quarterly returns |
| *"Naweza kupata mkopo wa serikali?"* | SIDO loan programmes |
| *"Biashara yangu ina wafanyakazi watatu, nalipa nini?"* | PAYE + NSSF/NHIF |

**Confidence-Gating (1.4.3):**
- Score ≥ 0.75 → Answer returned with AI disclaimer
- Score 0.50–0.74 → Partial answer + "verify with expert"
- Score < 0.50 → Human escalation triggered (48hr SLA)

---

## 🗺️ Roadmap

| Phase | Features | Timeline | Status |
|-------|----------|----------|--------|
| **MVP v1.0** | 1.6 Dashboard + 1.7 WhatsApp + 1.8 PWA | May 2026 | ✅ Live |
| **v1.1** | 1.3 Daftari Yangu (voice) + 1.5 Expense Tracker | June 2026 | 📋 Planned |
| **v1.2** | 1.4 Mshauri Wangu (RAG compliance chatbot) | July 2026 | 📋 Planned |
| **v1.3** | M-Pesa / Airtel Money integration | August 2026 | 📋 Planned |
| **v2.0** | Multi-language (English, French) + forecasting | Q4 2026 | 📋 Planned |
| **v3.0** | SME-to-supplier marketplace + credit scoring API | 2027 | 📋 Planned |

---

## 🌍 Social Impact

This platform directly addresses:
- **SDG 8** — Decent Work & Economic Growth
- **SDG 10** — Reduced Inequalities

Every business that gains visibility into its finances is one step closer to formal credit, growth, and job creation. We prioritise youth- and women-owned micro-businesses.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/DaftariYangu-voice`
3. Commit your changes: `git commit -m 'feat(1.3): add Whisper ASR integration'`
4. Push: `git push origin feature/DaftariYangu-voice`
5. Open a Pull Request

---

## 📞 Contact

| | |
|-|-|
| **Project Lead** | Patrick IIT |
| **Email** | zda24m007@iitmz.ac.in |
| **GitHub** | [@PatrickIIT](https://github.com/PatrickIIT) |
| **Organisation** | ZanAI |
| **Sponsor** | DASUC |

---

## 📜 License

This project is proprietary and owned by **ZanAI**.
All rights reserved. © 2026 ZanAI / DASUC.

---

## 🙏 Acknowledgments

- **DASUC** — project sponsorship and vision
- **IITM Zanzibar** — academic support and infrastructure
- **TRA, BRELA, SIDO** — regulatory guidance for Module 2 knowledge base
- **Open Source Community** — FastAPI, React, Recharts, Whisper, spaCy

---

<div align="center">

Built with ❤️ for African SMEs · DASUC Project 2026

*"Teknolojia kwa Lugha Yetu, Mafanikio kwa Biashara Zetu"*

⭐ If this project helps you, please give it a star!

</div>
