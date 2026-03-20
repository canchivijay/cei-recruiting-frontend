# CEI Recruiting — Production Deployment Guide

Full-stack recruitment platform with AI resume screening, Supabase database, and secure backend.

---

## Architecture

```
Browser (React + Vite)
    │
    ├─→ Supabase (PostgreSQL)     ← auth, jobs, candidates, interviews
    └─→ Your Backend (Express)   ← Anthropic API calls (key stays server-side)
```

---

## Step 1 — Create a Supabase Project

1. Go to **https://supabase.com** → New Project
2. Choose a name (e.g. `cei-recruiting`) and a strong database password
3. Select a region close to your users
4. Wait ~2 minutes for provisioning

### Run the schema

1. In Supabase dashboard → **SQL Editor** → New Query
2. Paste the entire contents of `supabase_schema.sql`
3. Click **Run**

### Get your API keys

Dashboard → **Project Settings** → **API**:
- **Project URL** → `VITE_SUPABASE_URL`
- **anon public key** → `VITE_SUPABASE_ANON_KEY`

### Enable Email Auth

Dashboard → **Authentication** → **Providers** → Email → Enable

---

## Step 2 — Deploy the Backend

### Locally (for testing)

```bash
cd backend
cp .env.example .env
# Edit .env: add your ANTHROPIC_API_KEY

npm install
npm run dev
# Runs on http://localhost:3001
```

### On Railway (free tier, recommended)

1. Go to **https://railway.app** → New Project → Deploy from GitHub
2. Push your `backend/` folder to a GitHub repo
3. Railway auto-detects Node.js and runs `npm start`
4. Add environment variables in Railway dashboard:
   - `ANTHROPIC_API_KEY` = `sk-ant-...`
   - `FRONTEND_URL` = your Vercel URL (add after step 3)
5. Copy the Railway deployment URL (e.g. `https://cei-api.railway.app`)

### On Render (alternative)

1. **https://render.com** → New Web Service → Connect GitHub
2. Build command: `npm install`
3. Start command: `node server.js`
4. Add same environment variables

---

## Step 3 — Deploy the Frontend

### Set up env vars

```bash
cd frontend
cp .env.example .env.local
```

Edit `.env.local`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_API_URL=https://your-backend.railway.app
```

### Deploy to Vercel (recommended)

```bash
npm install -g vercel
cd frontend
vercel
# Follow prompts: link to new project, set env vars when asked
```

Or via GitHub:
1. Push `frontend/` to GitHub
2. Go to **https://vercel.com** → New Project → Import repo
3. Add env vars in Vercel dashboard (Settings → Environment Variables)
4. Deploy

### Deploy to Netlify (alternative)

```bash
cd frontend
npm install
npm run build
# Drag dist/ folder to netlify.com/drop
```

---

## Step 4 — Final wiring

1. Copy your Vercel URL (e.g. `https://cei-recruiting.vercel.app`)
2. Go back to Railway/Render backend → update `FRONTEND_URL` env var
3. In Supabase dashboard → **Authentication** → **URL Configuration**:
   - Add your Vercel URL to **Redirect URLs**

---

## Local Development (full stack)

```bash
# Terminal 1 — Backend
cd backend
npm install
cp .env.example .env   # fill in ANTHROPIC_API_KEY
npm run dev

# Terminal 2 — Frontend
cd frontend
npm install
cp .env.example .env.local   # fill in Supabase keys + VITE_API_URL=http://localhost:3001
npm run dev
# Opens http://localhost:5173
```

---

## Project Structure

```
cei-recruiting/
├── supabase_schema.sql      ← Run this in Supabase SQL Editor
├── README.md
│
├── backend/
│   ├── server.js            ← Express API (Anthropic key lives here)
│   ├── package.json
│   └── .env.example         ← Copy to .env
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    ├── .env.example         ← Copy to .env.local
    └── src/
        ├── main.jsx
        ├── supabase.js      ← Supabase client
        └── App.jsx          ← Full application
```

---

## Cost Estimate

| Service    | Free Tier                          | Paid starts at |
|------------|------------------------------------|----------------|
| Supabase   | 500MB DB, 2GB bandwidth, unlimited auth | $25/mo     |
| Railway    | $5 credit/mo (≈ 500 hrs)           | Pay as you go  |
| Vercel     | Unlimited deploys, 100GB bandwidth | $20/mo         |
| Anthropic  | Pay per use (~$0.003/resume parsed)| —              |

**For a team of 4 recruiters with moderate usage: ~$0–5/month total.**

---

## Environment Variables Reference

### Backend `.env`
| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (sk-ant-...) |
| `FRONTEND_URL` | Your deployed frontend URL (for CORS) |
| `PORT` | Server port (default: 3001) |

### Frontend `.env.local`
| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_API_URL` | Your backend URL |

---

## Upgrading from window.storage version

Data from the Claude artifact (window.storage) cannot be migrated automatically — you'll start fresh in the production version, which is expected since it's a real database now. Recruiter accounts are created via email signup (Supabase Auth) instead of the custom password system.
