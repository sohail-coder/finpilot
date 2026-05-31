# FinPilot — Hostinger + Supabase Deployment Guide

**Free Tier Deployment** — Node.js backend on Hostinger + Supabase PostgreSQL (free plan)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│              Hostinger Shared/VPS Hosting               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────┐      ┌──────────────────────┐  │
│  │  React Frontend    │      │  Node.js Backend     │  │
│  │ (Vite SPA)         │────▶│ (Express + TS)       │  │
│  │ • public_html      │      │ • Port 3000          │  │
│  │ • .htaccess        │      │ • PM2 process mgr    │  │
│  └────────────────────┘      └──────────┬───────────┘  │
│                                         │               │
└─────────────────────────────────────────┼───────────────┘
                                          │
                            ┌─────────────▼──────────────┐
                            │   Supabase PostgreSQL      │
                            │   (Cloud Hosted)           │
                            │   • Free plan              │
                            │   • Automatic backups      │
                            │   • Real-time subscriptions│
                            └────────────────────────────┘
                                          ▲
                                    HTTPS Secured
```

---

## Why Supabase Free Plan?

| Feature | Hostinger DB | Supabase Free |
|---------|--------------|---------------|
| **Cost** | $0-10/month | $0 |
| **Data Storage** | 10GB+ | 500MB |
| **API Requests** | Unlimited | Unlimited |
| **Backup** | Manual | Automatic |
| **Uptime** | 99.9% | 99% |
| **Auto-scaling** | No | Yes (free tier) |
| **Real-time Updates** | No | Yes |
| **Perfect for** | MVP/Testing | MVP/Early Stage |

**Supabase Free is ideal for:** MVP, early-stage development, testing, low traffic

---

## Step 1: Create Supabase Account & Project

### 1.1 Sign Up

1. Go to [https://supabase.com](https://supabase.com)
2. Click **Start Your Project**
3. Sign up with GitHub, Google, or email
4. Create a **new organization**

### 1.2 Create Project

1. Click **+ New Project**
2. Fill in details:
   - **Project Name:** `finpilot`
   - **Database Password:** Generate strong password (save it!)
   - **Region:** Choose closest to your users (e.g., `us-east-1`)
   - **Plan:** Free
3. Click **Create New Project** (wait 2-3 minutes)

### 1.3 Get Connection Details

Once project is ready:

1. Go to **Settings** → **Database**
2. Find **Connection String** section
3. Copy the **Connection string** (looks like):
   ```
   postgresql://postgres:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```

4. Also note:
   - **Project URL:** `https://nhtjjmeloyjrokltsyne.supabase.co`
   - **API Key:** In **Settings** → **API**

---

## Step 2: Update Backend .env for Supabase

### 2.1 SSH to Hostinger

```bash
ssh username@your-hostinger-server.com
cd /home/username/finpilot/backend
```

### 2.2 Create .env File with Supabase

```bash
nano .env
```

**Paste this content:**

```env
# ═══════════════════════════════════════════════════════════════
# CORE CONFIGURATION
# ═══════════════════════════════════════════════════════════════

NODE_ENV=production
PORT=3000

# ═══════════════════════════════════════════════════════════════
# DATABASE — Supabase PostgreSQL (Free Plan)
# ═══════════════════════════════════════════════════════════════
# Get from: Supabase Dashboard → Settings → Database → Connection String
# Format: postgresql://postgres:PASSWORD@HOST:PORT/postgres
#
DATABASE_URL="postgresql://postgres:YOUR_SUPABASE_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

# ═══════════════════════════════════════════════════════════════
# JWT (Authentication)
# ═══════════════════════════════════════════════════════════════
# Generate: openssl rand -base64 32
#
JWT_SECRET=GENERATE_STRONG_RANDOM_32_CHARS
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ═══════════════════════════════════════════════════════════════
# CORS & FRONTEND
# ═══════════════════════════════════════════════════════════════

CORS_ORIGIN=https://yourdomain.com
APP_URL=https://yourdomain.com

# ═══════════════════════════════════════════════════════════════
# LOGGING
# ═══════════════════════════════════════════════════════════════

LOG_LEVEL=info

# ═══════════════════════════════════════════════════════════════
# OPTIONAL: OpenAI, Google Auth, Email
# ═══════════════════════════════════════════════════════════════

OPENAI_API_KEY=sk-your-key-optional
GOOGLE_CLIENT_ID=optional
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=optional
SMTP_PASS=optional
SMTP_FROM=noreply@yourdomain.com
```

Save: `Ctrl+X` → `Y` → `Enter`

---

## Step 3: Initialize Supabase Database Schema

### 3.1 Run Migrations

```bash
cd /home/username/finpilot/backend

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Build backend
npm run build

# Push schema to Supabase (creates tables)
npx prisma db push
```

**Note:** This creates all tables defined in your `prisma/schema.prisma` in Supabase.

### 3.2 Verify Tables Created

In Supabase Dashboard:
1. Go to **SQL Editor** → **New Query**
2. Run:
   ```sql
   SELECT tablename FROM pg_tables WHERE schemaname = 'public';
   ```
3. Should show: `users`, `transactions`, `budgets`, etc.

---

## Step 4: Deploy Backend with PM2

### 4.1 Install & Start Backend

```bash
# Install PM2 globally
npm install -g pm2

# Start backend
pm2 start dist/main.js --name "finpilot-api" --env .env

# Make it restart on server reboot
pm2 startup
pm2 save
```

### 4.2 Verify Backend Running

```bash
pm2 status
pm2 logs finpilot-api

# Test health endpoint
curl http://127.0.0.1:3000/health
```

---

## Step 5: Deploy Frontend (Same as Before)

### 5.1 Build Frontend

```bash
cd /home/username/finpilot/frontend
npm install
npm run build
```

### 5.2 Upload to Hostinger

**Option A: FTP**
- Use FileZilla
- Upload `dist/` contents to `public_html`

**Option B: SCP**
```bash
scp -r finpilot/frontend/dist/* username@server.com:/home/username/public_html/
```

### 5.3 Configure .htaccess (React Router)

Create `.htaccess` in `public_html`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Don't rewrite real files or directories
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d

  # Rewrite to index.html for React Router
  RewriteRule ^(.*)$ index.html [L]
</IfModule>

# API proxy to backend
<IfModule mod_proxy.c>
  <IfModule mod_rewrite.c>
    RewriteRule ^api/(.*)$ http://127.0.0.1:3000/api/$1 [P]
  </IfModule>
</IfModule>

# Force HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Caching
<FilesMatch "\.(?:js|css|svg|png|jpg)$">
    Header set Cache-Control "max-age=31536000, public"
</FilesMatch>
```

---

## Step 6: Enable SSL/HTTPS

### 6.1 In cPanel

1. Go to **AutoSSL**
2. Click **Run AutoSSL Now**
3. Wait for Let's Encrypt certificate

### 6.2 Verify HTTPS Works

```bash
curl https://yourdomain.com
```

---

## Step 7: Update Frontend API Endpoint

Make sure your frontend is configured to use the backend API:

**Frontend config (vite.config.ts or similar):**

```typescript
const API_BASE = process.env.VITE_API_URL || 'https://yourdomain.com/api';
```

**Create frontend/.env.production:**

```env
VITE_API_URL=https://yourdomain.com/api
```

---

## Step 8: Test End-to-End

### Frontend
```bash
# Visit in browser
https://yourdomain.com
```

### Backend
```bash
# Check running
pm2 status

# View logs
pm2 logs finpilot-api
```

### API Health Check
```bash
curl https://yourdomain.com/api/health
```

### Database Connection
```bash
# From Hostinger backend
psql "postgresql://postgres:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \
  -c "SELECT COUNT(*) FROM users;"
```

---

## Supabase Console Features

Visit Dashboard → [https://supabase.com](https://supabase.com)

- **SQL Editor** — Run raw SQL queries
- **Table Editor** — View/edit data visually
- **Authentication** — Manage users (built-in)
- **Realtime** — Enable real-time subscriptions
- **Storage** — File uploads (5GB free)
- **Edge Functions** — Serverless functions (optional)
- **Backups** — Automatic daily backups

---

## Monitoring & Maintenance

### Check Backend Logs
```bash
ssh username@your-server.com
pm2 logs finpilot-api
```

### Check Supabase Status
Visit [https://status.supabase.com](https://status.supabase.com)

### Backup Data from Supabase
```bash
# Export all data
pg_dump "postgresql://postgres:PASSWORD@HOST:PORT/postgres" > backup.sql

# Or use Supabase UI: Settings → Database → Backups
```

### Update Code
```bash
cd /home/username/finpilot/backend
git pull origin main
npm install
npm run build
npx prisma migrate deploy  # if schema changed
pm2 restart finpilot-api
```

---

## Supabase Free Tier Limits

| Limit | Free Plan |
|-------|-----------|
| **Database Size** | 500 MB |
| **Storage** | 1 GB |
| **Bandwidth** | 50 GB/month |
| **Concurrent Connections** | 2 |
| **API Calls** | Unlimited |
| **Auto-backups** | Daily (7-day retention) |

**When to upgrade:**
- Database size > 500 MB
- Need more concurrent connections
- Production app with SLA requirements

---

## Environment Variables Summary

### Backend (.env on Hostinger)

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://postgres:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
JWT_SECRET=generate-strong-random-string
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=https://yourdomain.com
APP_URL=https://yourdomain.com
LOG_LEVEL=info
```

### Frontend (.env.production in frontend/)

```env
VITE_API_URL=https://yourdomain.com/api
```

---

## Useful Commands

```bash
# SSH to Hostinger
ssh username@your-server.com

# Backend folder
cd /home/username/finpilot/backend

# PM2 commands
pm2 status
pm2 logs finpilot-api
pm2 restart finpilot-api
pm2 stop finpilot-api
pm2 monit

# Database check
psql "postgresql://postgres:PASSWORD@HOST/postgres" -c "SELECT version();"

# Pull & redeploy
git pull origin main
npm run build
npx prisma migrate deploy
pm2 restart finpilot-api
```

---

## Architecture Comparison

| Aspect | Hostinger + Hostinger DB | Hostinger + Supabase |
|--------|--------------------------|---------------------|
| **Database Cost** | Included (shared) | Free (500 MB) |
| **Database Uptime** | 99.9% | 99%+ |
| **Maintenance** | Manual backups | Automatic backups |
| **Scalability** | Limited | Better (auto-scaling) |
| **Setup Complexity** | Medium | Easy |
| **Best for** | Long-term, stable traffic | MVP, testing, early-stage |

---

## Troubleshooting

### Backend Won't Connect to Supabase

```bash
# Check connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# View errors
pm2 logs finpilot-api
```

### Database Size Limit Reached

- Upgrade Supabase plan
- Or export data & purge old records

### Slow API Responses

1. Check Supabase dashboard for performance
2. Add database indexes to hot queries
3. Use Supabase built-in caching

### SSL Certificate Error

```bash
# Renew in cPanel
# Or use: certbot renew (if SSH access available)
```

---

## Next Steps

1. ✅ Create Supabase account & project
2. ✅ Get PostgreSQL connection string
3. ✅ Deploy backend with .env pointing to Supabase
4. ✅ Run `npx prisma db push`
5. ✅ Deploy frontend to Hostinger
6. ✅ Configure reverse proxy & SSL
7. ✅ Test end-to-end
8. ✅ Monitor logs

---

## Summary

**Your deployment stack:**
- 🖥️ **Frontend:** React on Hostinger (`public_html`)
- 🔧 **Backend:** Node.js on Hostinger (PM2, port 3000)
- 🗄️ **Database:** Supabase PostgreSQL (free plan, 500MB)
- 🔐 **SSL:** Let's Encrypt (free, via cPanel)
- 💰 **Cost:** ~$5-10/month total (Hostinger only)

Good luck! 🚀
