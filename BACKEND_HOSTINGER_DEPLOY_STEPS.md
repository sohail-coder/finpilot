# FinPilot Backend — Hostinger Deployment Steps

**Complete step-by-step guide to deploy backend on Hostinger**

---

## Prerequisites Checklist

- [ ] Hostinger SSH access credentials (username, password/key, server IP)
- [ ] Backend repository already connected to Hostinger
- [ ] Supabase database credentials in local `.env` (DATABASE_URL)
- [ ] Port 3000 available on Hostinger server
- [ ] Node.js installed on Hostinger (check with: `node --version`)

---

## Step 1: SSH into Hostinger & Navigate to Backend

```bash
# SSH into Hostinger (replace with your credentials)
ssh username@your-hostinger-server.com
# Enter password when prompted

# Navigate to backend
cd finpilot/backend

# Verify you're in the right directory
ls -la
# Should see: package.json, src/, prisma/, tsconfig.json, etc.
```

---

## Step 2: Install Node Dependencies

```bash
npm install

# This installs all packages from package.json
# (Express, TypeScript, Prisma, etc.)
# Wait for it to complete (usually 2-3 minutes)
```

---

## Step 3: Create Production .env File

```bash
# Create .env file on Hostinger
nano .env
```

**Copy-paste this content** (update with YOUR values):

```env
# Environment
NODE_ENV=production
PORT=3000

# Database (Your Supabase connection)
DATABASE_URL="postgresql://postgres:YOUR_SUPABASE_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"

# JWT (Generate new strong secret for production!)
JWT_SECRET=generate-a-new-strong-random-string-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS (Point to your frontend domain)
CORS_ORIGIN=https://yourdomain.com

# App URL
APP_URL=https://yourdomain.com

# Logging (Use 'info' for production, less verbose)
LOG_LEVEL=info

# OpenAI API Key
OPENAI_API_KEY=sk-your-openai-api-key-here

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# SMTP (Email notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
SMTP_FROM=your-email@gmail.com
```

**Save the file:** `Ctrl+X` → `Y` → `Enter`

---

## Step 4: Generate Prisma Client

```bash
# Generate Prisma client (required for database access)
npx prisma generate

# Output should show: ✔ Generated Prisma Client
```

---

## Step 5: Build TypeScript to JavaScript

```bash
# Compile TypeScript → JavaScript
npm run build

# This creates a 'dist/' folder with compiled code
# Wait for completion (usually 1-2 minutes)
```

---

## Step 6: Push Database Schema to Supabase

```bash
# This creates all tables from prisma/schema.prisma in Supabase
npx prisma db push

# You'll see a prompt asking if you want to push the schema
# Type: y (yes)

# Output should show: ✔ Your database is now in sync with your schema
```

---

## Step 7: Verify Database Schema Created

```bash
# Connect to your Supabase database and check tables
psql "postgresql://postgres:YOUR_SUPABASE_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres" \
  -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"

# Should list tables:
# - users
# - transactions
# - budgets
# - categories
# - etc.
```

**Alternative:** Check in Supabase Dashboard → Table Editor

---

## Step 8: Install PM2 Process Manager

```bash
# Install PM2 globally (only needed once)
npm install -g pm2

# Verify installation
pm2 --version
```

---

## Step 9: Start Backend with PM2

```bash
# Start the backend (using .env file)
pm2 start dist/main.js --name "finpilot-api" --env .env

# Output should show:
# ✔ App "finpilot-api" started successfully
```

---

## Step 10: Make Backend Auto-Start on Server Reboot

```bash
# Generate startup script
pm2 startup

# Copy the output command and run it (if prompted)
# Then save the configuration
pm2 save

# Verify
pm2 status
# Should show finpilot-api as "online"
```

---

## Step 11: Verify Backend is Running

```bash
# Check PM2 status
pm2 status
# Should show finpilot-api "online" (green)

# View logs
pm2 logs finpilot-api
# Should show: "Server running on port 3000"

# Test health endpoint
curl http://127.0.0.1:3000/health
# Should return JSON response
```

---

## Step 12: Test Database Connection

```bash
# From your backend directory, test database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"

# Should return: count
#                -------
#                    0
```

---

## Step 13: Configure Frontend to Connect to Backend

### On your local machine (before uploading frontend):

Update your frontend API configuration:

**File:** `frontend/src/lib/api.ts` (or similar)

```typescript
const API_BASE = process.env.VITE_API_URL || 'https://yourdomain.com/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

export default apiClient;
```

**Create:** `frontend/.env.production`

```env
VITE_API_URL=https://yourdomain.com/api
```

---

## Step 14: Build Frontend Locally

```bash
# On your LOCAL machine (not Hostinger SSH)
cd finpilot/frontend

npm install
npm run build

# Creates dist/ folder with optimized React build
```

---

## Step 15: Upload Frontend to Hostinger

### Option A: Using FTP (Easiest)

1. Download **FileZilla** (https://filezilla-project.org/)
2. Connect to Hostinger:
   - Host: `your-hostinger-server.com`
   - Username: FTP username (from cPanel)
   - Password: FTP password
   - Port: 21
3. Navigate to `public_html`
4. Drag & drop all files from `frontend/dist/` into `public_html`

### Option B: Using SCP (Command Line)

```bash
# From your local machine in finpilot/ folder
scp -r frontend/dist/* username@your-hostinger-server.com:/home/username/public_html/
```

---

## Step 16: Configure .htaccess for React Router & API Proxy

SSH into Hostinger:

```bash
ssh username@your-hostinger-server.com
cd /home/username/public_html

# Create/edit .htaccess
nano .htaccess
```

**Paste this content:**

```apache
# Enable rewrite engine
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Don't rewrite real files or directories
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d

  # Rewrite all requests to index.html (React Router)
  RewriteRule ^(.*)$ index.html [L]
</IfModule>

# Proxy API requests to backend port 3000
<IfModule mod_proxy.c>
  <IfModule mod_rewrite.c>
    RewriteRule ^api/(.*)$ http://127.0.0.1:3000/api/$1 [P,L]
  </IfModule>
</IfModule>

# Force HTTPS
<IfModule mod_rewrite.c>
  RewriteCond %{HTTPS} off
  RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>

# Enable gzip compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/plain text/html text/xml text/css text/javascript application/javascript application/xml+rss application/x-font-ttf font/opentype
</IfModule>

# Cache static assets
<FilesMatch "\.(?:js|css|woff2|svg|png|jpg|jpeg|gif)$">
    Header set Cache-Control "max-age=31536000, public"
</FilesMatch>

# Cache index.html (short time)
<FilesMatch "^index\.html$">
    Header set Cache-Control "max-age=3600, public"
</FilesMatch>
```

**Save:** `Ctrl+X` → `Y` → `Enter`

---

## Step 17: Enable SSL/HTTPS in cPanel

1. Log in to **Hostinger cPanel**
2. Go to **AutoSSL** (or **SSL/TLS Status**)
3. Click **Run AutoSSL Now** (or similar)
4. Wait for Let's Encrypt certificate (usually instant)

---

## Step 18: Test Everything

### Test Backend

```bash
# SSH to Hostinger
ssh username@your-hostinger-server.com

# Check backend status
pm2 status
# Should show finpilot-api "online"

# Check logs
pm2 logs finpilot-api
# Should show no errors
```

### Test Frontend

```bash
# In browser
https://yourdomain.com

# Should load React app without errors
# Open DevTools (F12) → Console tab
# No red error messages should appear
```

### Test API Connection

```bash
# In browser console or curl
curl https://yourdomain.com/api/health

# Should return JSON response like:
# {"status":"ok"}
```

### Test Database

Try logging in or creating data:
- Register a new user
- Create a transaction
- Check data appears in app

---

## Step 19: Verify Backend Stays Running

```bash
# SSH to Hostinger
ssh username@your-hostinger-server.com

# Check PM2 list
pm2 list

# Check startup scripts are configured
pm2 startup

# Verify configuration saved
pm2 save
```

**Reboot server to test auto-start:**

```bash
# This will restart the server and backend should come back online
sudo reboot

# Wait 2 minutes, then:
ssh username@your-hostinger-server.com
pm2 status
# Should still show finpilot-api "online"
```

---

## Step 20: Monitor & Maintain

### Daily Monitoring

```bash
# Check backend is running
pm2 status

# View recent logs
pm2 logs finpilot-api --lines 50

# Monitor in real-time
pm2 monit
```

### Update Code (When You Push Updates)

```bash
# SSH to Hostinger
ssh username@your-hostinger-server.com
cd finpilot/backend

# Pull latest code
git pull origin main

# Reinstall dependencies if package.json changed
npm install

# Rebuild if code changed
npm run build

# Run migrations if schema changed
npx prisma migrate deploy

# Restart backend
pm2 restart finpilot-api
```

---

## Troubleshooting

### Backend Won't Start

```bash
# Check logs
pm2 logs finpilot-api

# Verify .env file exists
cat .env

# Check if port 3000 is in use
lsof -i :3000

# Try manual start to see errors
node dist/main.js
```

### Database Connection Error

```bash
# Test connection string
psql $DATABASE_URL -c "SELECT 1"

# Verify DATABASE_URL in .env
echo $DATABASE_URL

# Check Supabase database is running (check dashboard)
```

### API Returns 404

```bash
# Verify .htaccess exists in public_html
cat public_html/.htaccess

# Verify backend is running
pm2 status

# Test direct connection
curl http://127.0.0.1:3000/api/health
```

### Frontend Shows Errors in Console

```bash
# Check browser console (F12) for specific errors
# Common issues:
# 1. API URL pointing to wrong domain
# 2. CORS_ORIGIN not set to your domain
# 3. Backend not running

# Check .env.production has correct API URL
cat finpilot/frontend/.env.production
```

### CORS Errors

```bash
# Update backend .env
ssh username@your-hostinger-server.com
cd finpilot/backend
nano .env

# Update CORS_ORIGIN to your domain:
# CORS_ORIGIN=https://yourdomain.com

# Save and restart backend
pm2 restart finpilot-api
```

---

## Quick Command Reference

```bash
# Connect to Hostinger
ssh username@your-hostinger-server.com

# Navigate to backend
cd finpilot/backend

# Check backend status
pm2 status
pm2 logs finpilot-api

# Restart backend
pm2 restart finpilot-api

# Stop backend
pm2 stop finpilot-api

# Start backend
pm2 start dist/main.js --name "finpilot-api"

# Update code
git pull origin main
npm run build
npx prisma migrate deploy
pm2 restart finpilot-api

# Test database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"

# Monitor
pm2 monit

# View .env
cat .env

# Edit .env
nano .env
```

---

## Deployment Checklist

- [ ] SSH into Hostinger
- [ ] Navigate to backend folder
- [ ] Run `npm install`
- [ ] Create `.env` file with your credentials
- [ ] Run `npx prisma generate`
- [ ] Run `npm run build`
- [ ] Run `npx prisma db push`
- [ ] Install PM2: `npm install -g pm2`
- [ ] Start backend: `pm2 start dist/main.js --name "finpilot-api"`
- [ ] Configure auto-start: `pm2 startup` + `pm2 save`
- [ ] Upload frontend via FTP to `public_html`
- [ ] Create `.htaccess` in `public_html`
- [ ] Enable SSL/HTTPS in cPanel
- [ ] Test frontend: `https://yourdomain.com`
- [ ] Test API: `curl https://yourdomain.com/api/health`
- [ ] Verify data flows through app

---

## Success Indicators

✅ Backend Status:
- `pm2 status` shows "online"
- `pm2 logs` shows no errors
- `curl http://127.0.0.1:3000/health` returns success

✅ Frontend Status:
- `https://yourdomain.com` loads without errors
- Browser console has no red errors

✅ Integration:
- Login works
- Can create transactions
- Data appears in app

---

**You're ready to deploy!** Start with Step 1. 🚀

Questions? Check logs: `pm2 logs finpilot-api`
