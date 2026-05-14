# 🌍 SwahiliSME Platform

> *"Teknolojia kwa Lugha Yetu, Mafanikio kwa Biashara Zetu"*
> *"Technology in Our Language, Success for Our Businesses"*

[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

---

## 📖 Our Vision

**The Why:** In everything we do, we believe in the beauty of the human experience. We believe that technology should be a light that helps every person shine and reach their goals.

**The How:** The way we do this is by making tools that truly understand what people need and how they feel. We build our products to be helpful, friendly, and easy for everyone.

**The What:** We just happen to make great AI and data products.

---

## 🎯 What is SwahiliSME Platform?

An **AI-powered business management platform** designed specifically for **Small and Medium Enterprises (SMEs) in East Africa**, with complete support for the **Swahili language**.

### The Problem We Solve

Many SME owners in East Africa struggle with:
- ❌ Manual bookkeeping and paper records
- ❌ Poor visibility into business finances
- ❌ Language barriers (most tools are English-only)
- ❌ No access to formal credit due to lack of financial records
- ❌ Limited knowledge of regulatory requirements (TRA, BRELA, SIDO)

### Our Solution

| Module | Description | Status |
|--------|-------------|--------|
| **📒 Daftari Yangu** (My Ledger) | Voice-to-text bookkeeping in Swahili | 🚧 In Progress |
| **🎓 Mshauri Wangu** (My Advisor) | AI compliance chatbot for TRA/BRELA/SIDO | 🚧 In Progress |
| **📊 Analytics Dashboard** | Revenue, cost, profit visualizations | ✅ Complete |
| **💬 WhatsApp Integration** | Weekly business summaries via WhatsApp | ✅ Complete |
| **📱 PWA** | Offline-first mobile web app | ✅ Complete |
| **📄 Business Health Card** | PDF report for loan applications | ✅ Complete |

---

## 🚀 Live Demo

### Backend API
```bash
# Root endpoint
curl http://localhost:8000/

# Dashboard summary
curl http://localhost:8000/api/v1/dashboard/summary?user_id=test123

# Chart data
curl http://localhost:8000/api/v1/dashboard/revenue-cost-profit?user_id=test123

# Top products
curl http://localhost:8000/api/v1/dashboard/top-products?user_id=test123

# Spending patterns
curl http://localhost:8000/api/v1/dashboard/spending-patterns?user_id=test123
API Response Example
json
{
  "period": "week",
  "total_revenue": 125000,
  "total_cost": 58000,
  "net_profit": 67000,
  "profit_margin": 53.6,
  "transactions_count": 42
}
📊 Dashboard Features
1.6.1 Revenue / Cost / Profit Charts
Interactive area chart showing weekly trends

Real-time profit margin calculation

Swahili labels and formatting

1.6.2 Top Products View
Rank products by revenue contribution

Display units sold

Visual bar chart representation

1.6.3 Spending Patterns
Pie chart breakdown by expense category

Percentage distribution

Category comparison

🛠 Tech Stack
Backend
Technology	Purpose
FastAPI	High-performance REST API
Python 3.11	Core programming language
PostgreSQL	Production database
SQLite	Offline local storage
Celery + Redis	Async task queue
AI/ML
Technology	Purpose
OpenAI Whisper	Swahili speech recognition
spaCy	Named Entity Recognition
Claude/GPT-4	RAG compliance chatbot
FAISS/Chroma	Vector database
Frontend
Technology	Purpose
React 18	UI framework
Recharts	Data visualization
PWA	Offline-first capability
WhatsApp Cloud API	Messaging integration
DevOps
Technology	Purpose
Docker	Containerization
GitHub Actions	CI/CD pipeline
Railway/Vercel	Cloud deployment
📁 Project Structure
text
swahilisme-platform/
├── backend/                 # FastAPI backend
│   ├── api/
│   │   ├── routes/         # API endpoints
│   │   │   ├── dashboard.py    # Analytics endpoints
│   │   │   └── whatsapp.py     # WhatsApp webhook
│   │   └── app.py          # Main FastAPI app
│   └── services/           # Business logic
│       ├── analytics.py    # Dashboard calculations
│       ├── asr/           # Speech recognition
│       ├── nlp/           # Language processing
│       ├── rag/           # Compliance chatbot
│       └── pdf/           # Health card generator
├── frontend/               # React PWA
│   ├── src/
│   │   ├── components/
│   │   │   └── AnalyticsDashboard.js
│   │   ├── hooks/
│   │   ├── i18n/          # Swahili translations
│   │   └── styles/
│   └── public/            # PWA assets
├── data/                  # Datasets
├── models/                # Trained ML models
├── tests/                 # Unit & integration tests
├── infrastructure/        # Docker, nginx configs
├── docs/                  # Documentation
├── scripts/               # Deployment scripts
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
🏃‍♂️ Quick Start
Prerequisites
Python 3.11+

Node.js 18+

Git

1. Clone the repository
bash
git clone https://github.com/PatrickIIT/swahilisme-platform.git
cd swahilisme-platform
2. Backend Setup
bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env

# Run the server
uvicorn backend.api.app:app --reload
3. Frontend Setup
bash
cd frontend
npm install
npm start
4. Access the application
Backend API: http://localhost:8000

API Documentation: http://localhost:8000/docs

Frontend Dashboard: http://localhost:3000

📱 WhatsApp Integration
The platform sends weekly business summaries via WhatsApp:

javascript
// Weekly summary template (Swahili)
🌟 *MUHTASARI WA WIKI — {business_name}*

💰 Mapato: TZS {revenue}
💸 Gharama: TZS {cost}
📈 Faida: TZS {profit}
📦 Miamala: {transactions}

---
_SwahiliSME — Msaidizi wako wa biashara_
Webhook Setup
Configure Meta Developer account

Set webhook URL: https://your-domain.com/api/v1/whatsapp/webhook

Verify with token: swahilisme_verify_2026

📄 Business Health Card
After 90 days and 30+ transactions, users can generate a professional PDF report:

Business summary with revenue/cost/profit

Top performing products

Spending analysis

Loan application ready

Required legal disclaimer in Swahili

🗺️ Roadmap
Phase	Features	Timeline
MVP v1.0	Dashboard + WhatsApp + PWA	✅ May 2026
v1.1	Daftari Yangu (voice bookkeeping)	📋 June 2026
v1.2	Mshauri Wangu (compliance chatbot)	📋 July 2026
v1.3	M-Pesa integration	📋 August 2026
v2.0	Multi-language (English, French)	📋 Q4 2026
v3.0	SME marketplace & credit scoring	📋 2027
🤝 Contributing
We welcome contributions! Please see our Contributing Guidelines.

Fork the repository

Create your feature branch (git checkout -b feature/AmazingFeature)

Commit your changes (git commit -m 'Add some AmazingFeature')

Push to the branch (git push origin feature/AmazingFeature)

Open a Pull Request

📞 Support & Contact
Project Lead: Patrick IIT

Email: zda24m007@iitmz.ac.in

GitHub: @PatrickIIT

Repository: swahilisme-platform

📜 License
This project is proprietary and owned by DASUC Project.
All rights reserved. See LICENSE for details.

🙏 Acknowledgments
DASUC for project sponsorship

IITM Zanzibar for academic support

TRA, BRELA, SIDO for regulatory guidance

Open Source Community for amazing tools

⭐ Star History
If you find this project useful, please give it a star! ⭐

<div align="center">
Built with ❤️ for East African SMEs

"Teknolojia kwa Lugha Yetu, Mafanikio kwa Biashara Zetu"

</div> '@ | Out-File -FilePath "README.md" -Encoding utf8
Write-Host "✅ README.md has been updated!" -ForegroundColor Green

