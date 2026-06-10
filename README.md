# Aura Mini CRM — Xeno Engineering Assignment

An AI-native Mini CRM for helping a D2C brand reach its shoppers intelligently.

## Architecture

```
┌─────────────────────────┐         ┌──────────────────────┐
│    Next.js CRM App      │ ──────► │   Channel Stub       │
│  (Vercel)               │  POST   │   (Railway)          │
│                         │  /send  │                      │
│  • Dashboard            │         │  Simulates:          │
│  • Customers            │         │  • Delivery          │
│  • Segments (AI+Rules)  │ ◄─────  │  • Opens             │
│  • Campaigns            │  POST   │  • Clicks            │
│  • AI Chat (Aria)       │  /api   │  • Conversions       │
│                         │  /receipts                     │
└──────────┬──────────────┘         └──────────────────────┘
           │
           ▼
    ┌─────────────┐
    │  PostgreSQL │
    │  (Supabase/ │
    │   Railway)  │
    └─────────────┘
```

## Stack

- **Frontend/API:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Recharts
- **Database:** PostgreSQL (via `pg`)
- **AI:** OpenAI GPT-4o-mini (segment generation, message drafting, chat)
- **Channel stub:** Express.js (separate service, async callbacks)
- **Hosting:** Vercel (CRM) + Railway (channel stub + DB)

## Key Features

1. **Data ingestion** — 200 seed customers with realistic Indian purchase history (~1,500 orders)
2. **Segment builder** — Rule-based builder + AI natural-language → segment
3. **Campaigns** — Create, send, track per channel (WhatsApp/SMS/Email/RCS)
4. **Channel stub** — Separate service that simulates delivery/open/click/convert with real async callbacks
5. **Analytics** — Live stats per campaign, engagement funnel, 14-day activity chart
6. **AI Assistant (Aria)** — Chat-first interface for natural-language segment & campaign creation

## Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database (or use Supabase free tier)
- OpenAI API key

### 1. Install dependencies
```bash
npm install
```

### 2. Set up CRM environment
```bash
cp apps/crm/.env.example apps/crm/.env.local
# Fill in DATABASE_URL, OPENAI_API_KEY, CHANNEL_STUB_URL
```

### 3. Run migrations & seed
```bash
npm run db:migrate
npm run db:seed
```

### 4. Run locally
```bash
npm run dev
# CRM at http://localhost:3000
# Channel stub at http://localhost:3001
```

## Deployment

### CRM → Vercel
1. Import the repo to Vercel
2. Set root directory to `apps/crm`
3. Add environment variables: `DATABASE_URL`, `DATABASE_SSL=true`, `OPENAI_API_KEY`, `CHANNEL_STUB_URL`

### Channel stub → Railway
1. Create a Railway project from the `apps/channel-stub` directory
2. Set `CRM_RECEIPT_URL=https://your-crm.vercel.app/api/receipts`

### Database → Supabase or Railway PostgreSQL
1. Create a PostgreSQL instance
2. Run `npm run db:migrate` with your production `DATABASE_URL`
3. Run `npm run db:seed` to populate realistic data

## Design Decisions & Tradeoffs

- **No real messaging provider** — Fully stubbed as required. Channel stub models the real async callback loop used by providers like Twilio, Gupshup, etc.
- **PostgreSQL over NoSQL** — Structured customer/order data suits relational queries; segment filter engine generates parameterised SQL dynamically.
- **GPT-4o-mini over GPT-4** — Fast enough for segment/message generation at lower cost; can swap to GPT-4o for better quality.
- **No message queue (Redis/SQS)** — At this scale, Promise.all batching is sufficient. At production scale (millions of messages), a durable queue would be essential.
- **Denormalised campaign stats** — `stat_sent`, `stat_delivered` etc. on the campaign row for O(1) reads. Accuracy relies on receipt idempotency logic (receipts that would regress status are ignored).
- **No authentication** — Deliberately skipped. Would add NextAuth or Clerk in production.
