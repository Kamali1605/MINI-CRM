# Aura Mini CRM — Xeno Engineering Assignment

> **AI-native Mini CRM** for helping a D2C brand reach its shoppers intelligently.
> Built for the Xeno SDE/FDE take-home assignment.

---

## 🚀 Live Demo

| Service | URL |
|---------|-----|
| CRM App | _Deploy to Vercel_ |
| Channel Stub | _Deploy to Railway_ |

---

## 📁 Repository Structure

This monorepo contains two apps:

```
xeno/
├── apps/
│   ├── crm/                  # Next.js 15 CRM application
│   │   ├── app/              # Pages + API routes (App Router)
│   │   │   ├── page.tsx      # Dashboard
│   │   │   ├── campaigns/    # Campaign list + detail
│   │   │   ├── customers/    # Customer list + detail
│   │   │   ├── segments/     # Segment builder
│   │   │   ├── ai-assistant/ # Aria chat interface
│   │   │   └── api/          # All REST API routes
│   │   ├── components/       # React UI components
│   │   ├── lib/              # DB, AI, filter engine, types
│   │   └── scripts/          # DB migration + seed scripts
│   │
│   └── channel-stub/         # Express.js channel simulation service
│       └── src/index.js      # Simulates WhatsApp/SMS/Email/RCS delivery
│
├── package.json              # Root workspace + scripts
└── README.md                 # This file
```

---

## 🧠 What I Built

### Core Features

| Feature | Description |
|---------|-------------|
| **Data Ingestion** | 200 seed customers with realistic Indian names, cities, tags and ~1000 orders across 6 categories |
| **Segment Builder** | Rule-based filter engine (AND/OR, 7 fields, 9 operators) + AI natural-language → segment |
| **Campaign Engine** | Create → Send → Track. Personalised messages with `{{name}}` substitution |
| **Channel Stub** | Separate Express service simulating WhatsApp/SMS/Email/RCS with async callbacks |
| **Analytics** | Live campaign stats (sent → delivered → opened → clicked → converted), dashboard charts |
| **AI Assistant (Aria)** | Multi-turn chat, segment creation, message drafting — powered by Groq LLaMA 3.3 70B |

### AI-Native Features
- **Segment AI** — Describe audience in plain English → AI generates filter rules → live customer count preview
- **Message AI** — Channel-aware message drafting (SMS/WhatsApp/Email/RCS) with personalisation
- **Aria Chat** — Full conversational assistant with session history, action cards (save segment, open campaign builder), suggested prompts

### Channel Stub Design
```
CRM                    Channel Stub              CRM
POST /send    ──────►  Simulates delivery   ──►  POST /api/receipts
                       (async, per channel        (idempotent, status
                        probabilities)             rank progression)
```
- WhatsApp: 92% delivery, 75% open, 18% click
- SMS: 88% delivery, 65% open, 8% click
- Email: 85% delivery, 35% open, 12% click
- RCS: 90% delivery, 70% open, 20% click
- **Retry logic**: 3 retries with exponential backoff when CRM receipt API is down

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│              Next.js CRM App (Vercel)                │
│  Dashboard · Customers · Segments · Campaigns · Chat │
│  ─────────────────────────────────────────────────  │
│              Next.js API Routes                      │
│  /api/campaigns  /api/segments  /api/receipts  ...   │
└──────────┬──────────────────────────┬───────────────┘
           │ SQL (pg)                 │ HTTP
           ▼                          ▼
    ┌─────────────┐         ┌──────────────────────┐
    │  PostgreSQL  │         │   Channel Stub        │
    │  (Supabase)  │         │   (Railway)           │
    │              │         │  POST /send           │
    │  customers   │         │  GET  /health         │
    │  orders      │         │  GET  /stats          │
    │  segments    │         └──────────────────────┘
    │  campaigns   │
    │  comms       │         ┌──────────────────────┐
    │  chat_sess.  │         │   Groq API            │
    └─────────────┘         │  llama-3.3-70b        │
                             │  Segment gen          │
                             │  Message drafting     │
                             │  Aria chat            │
                             └──────────────────────┘
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 18, TypeScript, Tailwind CSS |
| Charts | Recharts (area, bar charts) |
| UI Components | Radix UI primitives |
| Backend | Next.js API Routes (App Router) |
| Database | PostgreSQL via `pg` (Supabase) |
| AI | Groq API — `llama-3.3-70b-versatile` |
| Channel Stub | Express.js, Axios |
| Deployment | Vercel (CRM) + Railway (channel stub) |

---

## 🛠️ Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database (Supabase free tier recommended)
- Groq API key (free at [console.groq.com](https://console.groq.com))

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp apps/crm/.env.example apps/crm/.env.local
```

Fill in:
```env
DATABASE_URL=postgresql://...
DATABASE_SSL=true
GROQ_API_KEY=gsk_...
CHANNEL_STUB_URL=http://localhost:3001
```

### 3. Set up database
```bash
npm run db:migrate    # Creates tables + indexes
npm run db:seed       # 200 customers, ~1000 orders, 5 segments
```

### 4. Run locally (two terminals)

**Terminal 1 — CRM:**
```bash
cd apps/crm
npm run dev           # http://localhost:3000
```

**Terminal 2 — Channel Stub:**
```bash
cd apps/channel-stub
node src/index.js     # http://localhost:3001
```

---

## 🚢 Deployment

### CRM → Vercel
1. Import repo → set root directory to `apps/crm`
2. Add env vars: `DATABASE_URL`, `DATABASE_SSL=true`, `GROQ_API_KEY`, `CHANNEL_STUB_URL`

### Channel Stub → Railway
1. Deploy from `apps/channel-stub`
2. Set `CRM_RECEIPT_URL=https://your-crm.vercel.app/api/receipts`

### Database → Supabase
1. Create free PostgreSQL project
2. Run `npm run db:migrate` then `npm run db:seed`

---

## 📊 Database Schema

```sql
customers     -- 200 shoppers with tags, spend, order history
orders        -- ~1000 orders across 6 categories
segments      -- Saved filter rules (AI or manual)
campaigns     -- Message + channel + segment + denormalised stats
communications -- One row per customer per campaign, full lifecycle
chat_sessions  -- Aria conversation history (JSONB)
```

**Key design decisions:**
- Denormalised `stat_sent/delivered/opened/clicked/converted/failed` on campaigns for O(1) dashboard reads
- Status rank progression in receipts API — prevents regression (e.g. "clicked" can't go back to "sent")
- LATERAL subquery in filter engine for per-customer order aggregates without N+1

---

## 🤖 AI System Design

### Segment Generation
```
User: "high value customers who haven't ordered in 60 days"
        ↓
Groq (llama-3.3-70b) → FilterRuleGroup JSON
        ↓
Filter Engine → parameterised SQL → live customer count
        ↓
User confirms → segment saved
```

### Aria (Chat Assistant)
- Multi-turn conversation stored in `chat_sessions` (JSONB)
- Detects intent → emits `action` blocks for segment/campaign creation
- Action cards in UI let marketer save with one click
- Session title auto-generated from first message

---

## 📝 Design Tradeoffs

| Decision | Reasoning |
|----------|-----------|
| No real messaging provider | Stubbed as required — models the real async callback loop |
| PostgreSQL over NoSQL | Structured customer/order data suits relational queries |
| Groq LLaMA over GPT-4 | Free tier, fast, compatible API — swap with one line change |
| Denormalised campaign stats | O(1) reads vs. slow COUNT queries on communications table |
| No message queue | At this scale, Promise.all batching is sufficient. At prod scale → Redis/SQS |
| No authentication | Deliberately skipped. Would add NextAuth/Clerk in production |

---

## 📂 Separate Repositories

| Repo | Contents |
|------|----------|
| [MINI-CRM-frontend-codebase](https://github.com/Kamali1605/MINI-CRM-frontend-codebase) | Pages, components, hooks, config |
| [MINI-CRM-backend-codebase](https://github.com/Kamali1605/MINI-CRM-backend-codebase) | API routes, DB layer, AI, channel stub, scripts |

---

*Built by Dhuban for the Xeno Engineering Assignment — June 2026*
