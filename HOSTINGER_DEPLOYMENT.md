# FinPilot — Hostinger Deployment Guide

**Alternative to AWS** — Deploy on Hostinger without relying on AWS services.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              Hostinger Shared/VPS Hosting              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────┐      ┌──────────────────┐   │
│  │   React Frontend     │      │  Node.js Backend │   │
│  │  (React 18 + Vite)   │────▶│ (Express + TS)   │   │
│  │  • Hosted in /public │      │ • Port 3000      │   │
│  │  • nginx/Apache      │      │ • PM2 process    │   │
│  └──────────────────────┘      └────────┬─────────┘   │
│                                         │              │
│                              ┌──────────▼──────────┐  │
│                              │ PostgreSQL Database │  │
│                              │ (cPanel Manager)    │  │
│                              └─────────────────────┘  │
│                                                       │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │
                    HTTPS (Let's Encrypt)
                            │
                    ┌───────┴────────┐
                    │                │
                    │  Your Domain   │
                    │  yourdomain.com│
                    └────────────────┘
```

---

## Prerequisites

### On Your Local Machine
- **Git** installed
- **Node.js 20+** and npm
- **Terminal/SSH client**

### Hostinger Account
- **VPS or Business Hosting** (minimum — check Node.js support)
- **cPanel access** (or similar control panel)
- **SSH access enabled**
- **PostgreSQL database** (available in most plans)

---

## Step 1: Prepare Your Application

### 1.1 Build Backend

```bash
cd finpilot/backend

# Install dependencies
npm install

# Build TypeScript
npm run build

# Generate Prisma client
npx prisma generate
```

### 1.2 Build Frontend

```bash
cd finpilot/frontend

# Install dependencies
npm install

# Create production build
npm run build

# Output goes to: finpilot/frontend/dist/
```

---

## Step 2: Set Up Hostinger Database

### 2.1 Create PostgreSQL Database

1. **Login to Hostinger cPanel**
2. Navigate to **Databases** → **PostgreSQL**
3. Click **Create New Database**
   - **Database Name:** `finpilot`
   - **Username:** `finpilot_user`
   - **Password:** Generate a strong random password (30+ chars, mix of upper/lower/numbers/symbols)
   - **Note:** Save these credentials

### 2.2 Get Database Connection Details

In cPanel, find:
- **Host:** Usually `localhost` or `127.0.0.1` (if on same server)
- **Port:** Usually `5432` (default PostgreSQL)
- **Database:** `finpilot`
- **Username:** `finpilot_user`
- **Password:** The one you created

---

## Step 3: Deploy Backend

### 3.1 SSH Access to Hostinger

```bash
ssh username@your-hostinger-server.com
# Enter password when prompted
```

### 3.2 Clone Repository

```bash
cd /home/username
git clone https://github.com/your-username/finpilot.git
cd finpilot/backend
```

### 3.3 Create Production `.env` File

```bash
# Create .env file
nano .env
```

**Paste this content:**

```env
# Environment
NODE_ENV=production
PORT=3000

# Database (from Hostinger cPanel)
DATABASE_URL="postgresql://finpilot_user:YOUR_SECURE_PASSWORD@localhost:5432/finpilot?schema=public"

# JWT (Generate a strong random string)
JWT_SECRET=your-256-bit-random-string-min-32-chars-use-$(openssl rand -base64 32)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS (Point to your frontend domain)
CORS_ORIGIN=https://yourdomain.com

# App URL
APP_URL=https://yourdomain.com

# Logging
LOG_LEVEL=info

# Optional: OpenAI API key (if using AI features)
OPENAI_API_KEY=sk-your-api-key

# Optional: Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id

# Optional: Email notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
SMTP_FROM=noreply@yourdomain.com
```

Save: `Ctrl+X` → `Y` → `Enter`

### 3.4 Install Dependencies & Build

```bash
npm install

# Generate Prisma client
npx prisma generate

# Build TypeScript
npm run build

# Run database migrations
npx prisma migrate deploy
```

### 3.5 Install PM2 (Process Manager)

```bash
npm install -g pm2

# Start your backend
pm2 start dist/main.js --name "finpilot-api" --env .env

# Save PM2 config to restart on reboot
pm2 startup
pm2 save
```

**Verify PM2 is running:**

```bash
pm2 status
pm2 logs finpilot-api
```

---

## Step 4: Deploy Frontend

### 4.1 Upload Frontend Build

#### Option A: Using FTP (Easiest)

1. Download **FileZilla** or any FTP client
2. Connect to Hostinger with FTP credentials
3. Navigate to **public_html** folder
4. Upload all files from `finpilot/frontend/dist/` to `public_html`

#### Option B: Using SCP (Command Line)

```bash
# From your local machine
scp -r finpilot/frontend/dist/* username@your-hostinger-server.com:/home/username/public_html/
```

### 4.2 Configure Web Server for React Router

Create `.htaccess` file in `public_html`:

```bash
nano .htaccess
```

**Paste this content:**

```apache
# Enable mod_rewrite
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Don't rewrite files or directories
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d

  # Rewrite all requests to index.html (for React Router)
  RewriteRule ^(.*)$ index.html [L]
</IfModule>

# Caching for assets
<FilesMatch "\.(?:js|css|woff2|svg|png|jpg)$">
    Header set Cache-Control "max-age=31536000, public"
</FilesMatch>
```

Save: `Ctrl+X` → `Y` → `Enter`

---

## Step 5: Configure Frontend API Endpoint

### 5.1 Update Frontend Config

In `finpilot/frontend/src/` or your axios config:

```typescript
// src/lib/api.ts or similar
const API_BASE = process.env.VITE_API_URL || 'https://yourdomain.com/api';

// Example with axios
import axios from 'axios';

const apiClient = axios.create({
  baseURL: API_BASE,
});

export default apiClient;
```

### 5.2 Create `.env.production` in Frontend

```bash
VITE_API_URL=https://yourdomain.com/api
```

---

## Step 6: Configure Nginx/Apache Reverse Proxy

### Option A: If Using cPanel with Nginx

1. **Go to cPanel** → **Nginx Configuration**
2. Add upstream for backend:

```nginx
upstream backend {
    server 127.0.0.1:3000;
}

server {
    server_name yourdomain.com;
    listen 443 ssl http2;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Frontend
    location / {
        root /home/username/public_html;
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api/ {
        proxy_pass http://backend/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Option B: Using Apache

Create `.htaccess` in `public_html`:

```apache
# Proxy API requests to backend
<IfModule mod_proxy.c>
  <IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^api/(.*)$ http://127.0.0.1:3000/api/$1 [P]
    RewriteRule ^(.*)$ - [L]
  </IfModule>
</IfModule>
```

---

## Step 7: Set Up HTTPS/SSL

### 7.1 Enable Let's Encrypt (Free)

1. **In cPanel** → **AutoSSL**
2. Click **Run AutoSSL Now**
3. Wait for certificate to install (usually instant)

### 7.2 Force HTTPS

In `.htaccess`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTPS} off
  RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>
```

---

## Step 8: Verify Deployment

### 8.1 Check Backend Health

```bash
# SSH into Hostinger
curl http://127.0.0.1:3000/health

# Or from your browser
curl https://yourdomain.com/api/health
```

### 8.2 Check Frontend

Visit: `https://yourdomain.com` in your browser

### 8.3 Check Logs

```bash
# Backend logs
pm2 logs finpilot-api

# Or tail
tail -f ~/.pm2/logs/finpilot-api-out.log
```

---

## Step 9: Post-Deployment Configuration

### 9.1 Database Backups

```bash
# Create manual backup
pg_dump -U finpilot_user -d finpilot > backup_$(date +%Y%m%d).sql

# Schedule daily backups via cron (SSH)
crontab -e
# Add: 0 2 * * * /home/username/backup-db.sh
```

### 9.2 Monitor PM2 Process

```bash
# Check status
pm2 status

# Restart if needed
pm2 restart finpilot-api

# Watch real-time
pm2 monit
```

### 9.3 Update Backend Code

When you push updates:

```bash
ssh username@your-hostinger-server.com

cd /home/username/finpilot/backend

git pull origin main

npm install

npx prisma migrate deploy

npm run build

pm2 restart finpilot-api
```

---

## Step 10: Environment Variables Summary

### Backend `.env` (Production)

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://finpilot_user:PASSWORD@localhost:5432/finpilot?schema=public
JWT_SECRET=generate-strong-random-string-32-chars-min
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info
APP_URL=https://yourdomain.com
OPENAI_API_KEY=optional
GOOGLE_CLIENT_ID=optional
SMTP_HOST=optional
SMTP_PORT=optional
SMTP_USER=optional
SMTP_PASS=optional
SMTP_FROM=optional
```

### Frontend Environment

```env
VITE_API_URL=https://yourdomain.com/api
```

---

## Troubleshooting

### Issue: Backend Won't Start

```bash
# Check logs
pm2 logs finpilot-api

# Check if port 3000 is in use
lsof -i :3000

# Restart PM2
pm2 restart finpilot-api

# View PM2 errors
pm2 save
pm2 resurrect
```

### Issue: Database Connection Failed

```bash
# Verify DATABASE_URL in .env is correct
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check credentials in cPanel
# Recreate database if needed
```

### Issue: Frontend Not Loading

```bash
# Check .htaccess is correct
cat public_html/.htaccess

# Verify files uploaded
ls -la public_html/

# Check web server error logs
tail -f /var/log/apache2/error.log  # or nginx error log
```

### Issue: CORS Errors

- Update `CORS_ORIGIN` in backend `.env` to match your domain
- Restart backend: `pm2 restart finpilot-api`

### Issue: API Calls Return 404

- Verify reverse proxy configuration
- Check backend is running: `pm2 status`
- Test direct connection: `curl http://127.0.0.1:3000/api/health`

---

## Performance Tips

1. **Enable Gzip Compression** in web server config
2. **Database Indexing** — Prisma migrations should handle this
3. **Connection Pooling** — Consider PgBouncer if high traffic
4. **Caching** — Add Redis (if available on Hostinger)
5. **CDN** — Cloudflare free tier for frontend assets

---

## Comparison: AWS vs Hostinger

| Aspect | AWS | Hostinger |
|--------|-----|-----------|
| **Cost** | $50-500+/month | $5-30/month |
| **Setup Complexity** | High (Terraform) | Low (cPanel UI) |
| **Auto-scaling** | Yes | Limited |
| **Database** | Aurora (auto-scaling) | PostgreSQL (fixed) |
| **SSL Certificate** | AWS Certificate Manager | Let's Encrypt (free) |
| **Monitoring** | CloudWatch | cPanel stats |
| **Support** | Community + Premium | 24/7 live chat |
| **Reliability** | 99.99% SLA | 99.9% SLA |

**Hostinger is ideal for:** MVP, early-stage, budget-conscious, predictable traffic
**AWS is ideal for:** Enterprise, high traffic, complex infrastructure, auto-scaling needs

---

## Useful Commands

```bash
# SSH into Hostinger
ssh username@server.com

# Navigate to backend
cd /home/username/finpilot/backend

# Check backend status
pm2 status
pm2 logs finpilot-api

# Restart backend
pm2 restart finpilot-api

# Pull latest code
git pull origin main

# Rebuild & migrate
npm run build
npx prisma migrate deploy
pm2 restart finpilot-api

# Check database
psql -U finpilot_user -d finpilot -c "SELECT COUNT(*) FROM users;"

# Monitor real-time
pm2 monit
```

---

## Next Steps

1. ✅ Set up Hostinger PostgreSQL database
2. ✅ Deploy backend with PM2
3. ✅ Upload frontend to public_html
4. ✅ Configure reverse proxy
5. ✅ Set up SSL certificate
6. ✅ Test both frontend & backend
7. ✅ Configure automated backups
8. ✅ Monitor logs & performance

Good luck! 🚀
