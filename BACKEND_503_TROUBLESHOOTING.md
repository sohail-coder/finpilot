# FinPilot Backend — 503 Service Unavailable Troubleshooting

**Status:** Backend at `https://backend-finpilot.accrescentgroup.com/` is returning 503 error
**Problem:** Node.js backend process is not running

---

## Quick Diagnosis Steps

### Step 1: SSH to Your Hostinger Server

```bash
ssh username@your-hostinger-server.com
# Or if using a different domain/IP:
ssh username@accrescentgroup.com
```

### Step 2: Check PM2 Status

```bash
pm2 status

# Should show something like:
# ┌─────┬───────────────────┬─────────────┬──────┬─────────┬──────────┐
# │ id  │ name              │ namespace   │ mode │ pid     │ status   │
# ├─────┼───────────────────┼─────────────┼──────┼─────────┼──────────┤
# │ 0   │ finpilot-api      │ default     │ fork │ 12345   │ online   │
# └─────┴───────────────────┴─────────────┴──────┴─────────┴──────────┘
```

**If you see "stopped" or "errored":** Backend process crashed

### Step 3: Check Logs

```bash
# View last 100 lines of logs
pm2 logs finpilot-api --lines 100

# View real-time logs
pm2 logs finpilot-api

# Or check specific error
pm2 info finpilot-api
```

### Step 4: Check if Node Process Exists

```bash
ps aux | grep node

# Should show your finpilot process running
```

---

## Common Issues & Solutions

### **Issue 1: PM2 Process is Stopped**

```bash
# Check status
pm2 status

# If showing "stopped", restart it
pm2 start finpilot-api

# Or start fresh
cd /home/username/finpilot/backend
pm2 start dist/main.js --name "finpilot-api" --env .env
pm2 save
```

### **Issue 2: PM2 Process is Errored**

```bash
# View detailed error logs
pm2 logs finpilot-api

# Common errors:
# - "Cannot find module" → Run: npm install
# - "DATABASE_URL not found" → Check .env file exists
# - "Port already in use" → Check lsof -i :3000
```

**Fix:**
```bash
cd /home/username/finpilot/backend

# Ensure dependencies installed
npm install

# Rebuild if needed
npm run build

# Check .env exists
cat .env

# Restart
pm2 restart finpilot-api
```

### **Issue 3: .env File Missing or Incorrect**

```bash
# Check if .env exists
ls -la /home/username/finpilot/backend/.env

# If missing, create it
nano /home/username/finpilot/backend/.env
```

**Paste this content:**
```env
NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://postgres:YOUR_SUPABASE_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"
JWT_SECRET=super-secret-dev-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info
OPENAI_API_KEY=sk-your-openai-api-key-here
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
APP_URL=https://yourdomain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
SMTP_FROM=your-email@gmail.com
```

**Save:** `Ctrl+X` → `Y` → `Enter`

**Restart:**
```bash
pm2 restart finpilot-api
pm2 save
```

### **Issue 4: Database Connection Failed**

```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1"

# If error, verify DATABASE_URL is correct
echo $DATABASE_URL

# Test Supabase connection
psql "postgresql://postgres:YOUR_SUPABASE_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres" -c "SELECT version();"
```

**Fix:** Verify Supabase credentials in `.env`

### **Issue 5: Port 3000 Already in Use**

```bash
# Check what's using port 3000
lsof -i :3000

# Kill the process (if needed)
kill -9 <PID>

# Or change PORT in .env to 3001 and restart
```

### **Issue 6: Node.js Not Installed**

```bash
# Check Node.js version
node --version
npm --version

# If not installed, contact Hostinger support to install Node.js
# Or check if it's available:
which node
```

### **Issue 7: Reverse Proxy Not Configured**

Check if `.htaccess` in `public_html` has API proxy configured:

```bash
cat /home/username/public_html/.htaccess | grep -A 5 "api"

# Should contain:
# RewriteRule ^api/(.*)$ http://127.0.0.1:3000/api/$1 [P,L]
```

---

## Complete Restart Procedure

If nothing works, do a complete restart:

```bash
ssh username@your-hostinger-server.com

# Navigate to backend
cd /home/username/finpilot/backend

# Stop any running processes
pm2 stop finpilot-api
pm2 delete finpilot-api

# Clear cache
rm -rf node_modules/.cache
rm -rf dist/

# Reinstall dependencies
npm ci  # or npm install

# Generate Prisma client
npx prisma generate

# Rebuild TypeScript
npm run build

# Recreate database schema (if needed)
npx prisma db push

# Start fresh
pm2 start dist/main.js --name "finpilot-api" --env .env

# Configure auto-start
pm2 startup
pm2 save

# Verify
pm2 status
pm2 logs finpilot-api
```

---

## Verification Tests

### Test 1: Backend Health Endpoint

```bash
# Local test (SSH on Hostinger server)
curl http://127.0.0.1:3000/health

# Should return: {"status":"ok","timestamp":"2026-05-29T06:32:11.123Z"}
```

### Test 2: Backend via Domain

```bash
# From your local machine
curl https://backend-finpilot.accrescentgroup.com/health

# Should return same response (not 503)
```

### Test 3: Database Connection

```bash
# On Hostinger
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"

# Should return a number (users count)
```

### Test 4: API Endpoint

```bash
# Test a real API endpoint
curl https://backend-finpilot.accrescentgroup.com/api/health

# Or with authentication
curl -X GET https://backend-finpilot.accrescentgroup.com/api/categories \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Useful Commands Reference

```bash
# SSH
ssh username@your-server.com

# Navigate
cd /home/username/finpilot/backend

# PM2 commands
pm2 status                          # Check status
pm2 logs finpilot-api              # View logs
pm2 logs finpilot-api --lines 50   # Last 50 lines
pm2 restart finpilot-api           # Restart process
pm2 stop finpilot-api              # Stop process
pm2 start finpilot-api             # Start process
pm2 delete finpilot-api            # Remove from PM2
pm2 monit                           # Monitor real-time
pm2 info finpilot-api              # Detailed info
pm2 info finpilot-api | grep error # Check errors

# Database
psql $DATABASE_URL -c "SELECT 1;"  # Test connection
psql $DATABASE_URL -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"  # List tables

# Build
npm install                         # Install dependencies
npm run build                       # Build TypeScript
npx prisma generate               # Generate Prisma client
npx prisma db push                # Push schema to DB

# Files
cat .env                           # View .env
nano .env                          # Edit .env
cat package.json                   # View package.json
ls -la                             # List files

# Test
curl http://127.0.0.1:3000/health # Test locally
curl https://your-domain.com/api/health # Test via domain
```

---

## Next Steps

1. **SSH to Hostinger:** `ssh username@your-server.com`
2. **Check PM2 status:** `pm2 status`
3. **View logs:** `pm2 logs finpilot-api`
4. **Identify the error** from logs
5. **Apply fix** from "Common Issues" section above
6. **Restart:** `pm2 restart finpilot-api`
7. **Test:** `curl https://backend-finpilot.accrescentgroup.com/health`

---

## If Still Not Working

Please provide:

1. **PM2 Status Output:**
   ```bash
   pm2 status
   ```

2. **Backend Logs:**
   ```bash
   pm2 logs finpilot-api --lines 100
   ```

3. **Check if .env exists:**
   ```bash
   cat /home/username/finpilot/backend/.env
   ```

4. **Check if dist/ folder exists:**
   ```bash
   ls -la /home/username/finpilot/backend/dist/
   ```

5. **Try running manually:**
   ```bash
   cd /home/username/finpilot/backend
   node dist/main.js
   ```

With this info, we can diagnose the exact issue.

---

**Goal:** Get your backend to return: `{"status":"ok","timestamp":"..."}` instead of 503 error
