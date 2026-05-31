# FinPilot — Supabase + Hostinger Deployment Checklist

**Free Tier Setup** — Supabase (500MB free database) + Hostinger (backend & frontend)

---

## Pre-Deployment (Local Machine)

- [ ] **Clone repository**
  ```bash
  git clone https://github.com/your-username/finpilot.git
  cd finpilot
  ```

- [ ] **Build backend**
  ```bash
  cd backend
  npm install
  npm run build
  ```

- [ ] **Build frontend**
  ```bash
  cd ../frontend
  npm install
  npm run build
  # Creates dist/ folder
  ```

---

## Supabase Setup (Cloud)

- [ ] **Create Supabase account**
  - Go to https://supabase.com
  - Sign up (GitHub, Google, or email)

- [ ] **Create new project**
  - [ ] Project Name: `finpilot`
  - [ ] Database Password: Strong password (save it!)
  - [ ] Region: Choose closest to users
  - [ ] Plan: **Free**
  - [ ] Wait for project to initialize (2-3 minutes)

- [ ] **Get PostgreSQL connection string**
  - [ ] Go to: Settings → Database → Connection string
  - [ ] Toggle "Show password"
  - [ ] Select "Prisma" from dropdown
  - [ ] Copy the string
  - [ ] Format: `postgresql://postgres:PASSWORD@HOST:PORT/postgres`
  - [ ] **Save this connection string!**

- [ ] **Save Supabase credentials**
  - [ ] Project URL: https://nhtjjmeloyjrokltsyne.supabase.co
  - [ ] Publishable Key: sb_publishable_...
  - [ ] PostgreSQL connection string (from above)

---

## Backend Deployment (Hostinger)

- [ ] **SSH into Hostinger**
  ```bash
  ssh username@your-hostinger-server.com
  ```

- [ ] **Clone backend repository**
  ```bash
  cd /home/username
  git clone https://github.com/your-username/finpilot.git
  cd finpilot/backend
  ```

- [ ] **Create .env file with Supabase connection**
  ```bash
  nano .env
  ```
  
  - [ ] Copy from [backend/.env.supabase.example](backend/.env.supabase.example)
  - [ ] Replace with YOUR values:
    - [ ] `DATABASE_URL` — PostgreSQL string from Supabase
    - [ ] `JWT_SECRET` — Generate random string (openssl rand -base64 32)
    - [ ] `CORS_ORIGIN` — Your domain (https://yourdomain.com)
    - [ ] Optional: OpenAI, Google, SMTP keys
  - [ ] Save: Ctrl+X → Y → Enter

- [ ] **Install dependencies**
  ```bash
  npm install
  ```

- [ ] **Generate Prisma client**
  ```bash
  npx prisma generate
  ```

- [ ] **Build backend**
  ```bash
  npm run build
  ```

- [ ] **Create database schema in Supabase**
  ```bash
  npx prisma db push
  # This creates all tables from schema.prisma
  ```

- [ ] **Verify tables created in Supabase**
  - Go to Supabase Dashboard → SQL Editor
  - Run: `SELECT tablename FROM pg_tables WHERE schemaname = 'public';`
  - Should list: users, transactions, budgets, etc.

- [ ] **Install PM2 process manager**
  ```bash
  npm install -g pm2
  ```

- [ ] **Start backend with PM2**
  ```bash
  pm2 start dist/main.js --name "finpilot-api" --env .env
  pm2 startup
  pm2 save
  ```

- [ ] **Verify backend is running**
  ```bash
  pm2 status
  pm2 logs finpilot-api
  ```

- [ ] **Test backend health endpoint**
  ```bash
  curl http://127.0.0.1:3000/health
  ```

---

## Frontend Deployment (Hostinger)

### Option A: FTP Upload (Easiest)

- [ ] **Download FTP client**
  - FileZilla (https://filezilla-project.org/)

- [ ] **Connect to Hostinger FTP**
  - [ ] Host: your-hostinger-server.com
  - [ ] Username: FTP username (from cPanel)
  - [ ] Password: FTP password
  - [ ] Port: 21

- [ ] **Upload frontend files**
  - [ ] Navigate to `public_html` folder
  - [ ] Drag & drop all files from `finpilot/frontend/dist/`
  - [ ] Wait for upload to complete

### Option B: SCP Command Line

- [ ] **Upload via SCP**
  ```bash
  # From local machine in finpilot/ directory
  scp -r frontend/dist/* username@your-hostinger-server.com:/home/username/public_html/
  ```

---

## Web Server Configuration

- [ ] **Create .htaccess for React Router** (in public_html)
  ```bash
  ssh username@your-hostinger-server.com
  cd /home/username/public_html
  nano .htaccess
  ```

  Paste this content:
  ```apache
  <IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^(.*)$ index.html [L]
  </IfModule>

  # API proxy
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

  - [ ] Save: Ctrl+X → Y → Enter

---

## SSL/HTTPS Setup

- [ ] **Enable AutoSSL in cPanel**
  - [ ] Log in to Hostinger cPanel
  - [ ] Go to: AutoSSL
  - [ ] Click: "Run AutoSSL Now"
  - [ ] Wait for Let's Encrypt certificate

- [ ] **Verify HTTPS works**
  ```bash
  curl https://yourdomain.com
  ```

---

## Frontend Environment Configuration

- [ ] **Update frontend .env.production**
  ```bash
  cd /home/username/finpilot/frontend
  nano .env.production
  ```

  Paste:
  ```env
  VITE_API_URL=https://yourdomain.com/api
  ```

  - [ ] Save: Ctrl+X → Y → Enter

---

## Post-Deployment Testing

### Frontend Tests

- [ ] **Visit website in browser**
  ```bash
  https://yourdomain.com
  ```

- [ ] **Check page loads**
  - [ ] No blank page
  - [ ] All UI components visible
  - [ ] Logo & styling render correctly

- [ ] **Check browser console** (F12)
  - [ ] No JavaScript errors (red messages)
  - [ ] Check Network tab → API calls showing

- [ ] **Test React Router**
  - [ ] Click navigation links
  - [ ] URL changes correctly
  - [ ] Pages load without refresh

### Backend Tests

- [ ] **Backend running**
  ```bash
  pm2 status
  # Should show "online" for finpilot-api
  ```

- [ ] **Backend logs clean**
  ```bash
  pm2 logs finpilot-api
  # Should not show errors
  ```

- [ ] **Health endpoint responds**
  ```bash
  curl https://yourdomain.com/api/health
  # Should return success JSON
  ```

- [ ] **Database connected**
  ```bash
  curl https://yourdomain.com/api/users
  # Should return data or proper error
  ```

### Integration Tests

- [ ] **User registration works**
  - [ ] Create a test account
  - [ ] Check user in Supabase SQL Editor

- [ ] **Login functionality**
  - [ ] Log in with credentials
  - [ ] Session persists across pages

- [ ] **Create test transaction**
  - [ ] Add a transaction
  - [ ] Check it appears in Supabase

- [ ] **AI features** (if configured)
  - [ ] AI recommendations load
  - [ ] Savings suggestions generate

- [ ] **Export/Reports** (if applicable)
  - [ ] Download report
  - [ ] File downloads correctly

---

## Supabase Dashboard Verification

- [ ] **Log in to Supabase**
  ```bash
  https://supabase.com/dashboard
  ```

- [ ] **Verify tables exist**
  - [ ] Go to: SQL Editor
  - [ ] Run: `SELECT tablename FROM pg_tables WHERE schemaname = 'public';`
  - [ ] Should list: users, transactions, budgets, categories, etc.

- [ ] **Check data in tables**
  - [ ] Go to: Table Editor
  - [ ] Click each table
  - [ ] Should see rows created from app usage

- [ ] **Check storage usage**
  - [ ] Settings → Usage
  - [ ] Database: Should be < 500 MB (free tier limit)

---

## Monitoring & Maintenance

- [ ] **Set up monitoring alerts**
  - Backend: `pm2 monit` command
  - Supabase: Dashboard → Monitoring

- [ ] **Regular backups**
  ```bash
  # Manual backup command
  pg_dump "postgresql://postgres:PASSWORD@HOST/postgres" > backup_$(date +%Y%m%d).sql
  ```

- [ ] **Monitor logs daily**
  ```bash
  pm2 logs finpilot-api
  ```

- [ ] **Check database size**
  ```bash
  # SSH to Hostinger
  # Go to Supabase Dashboard → Settings → Usage
  # Free tier: max 500 MB
  ```

- [ ] **Update code regularly**
  ```bash
  cd /home/username/finpilot/backend
  git pull origin main
  npm install
  npm run build
  npx prisma migrate deploy  # if schema changed
  pm2 restart finpilot-api
  ```

---

## Troubleshooting

| Issue | Solution | Status |
|-------|----------|--------|
| Backend won't start | Check `pm2 logs finpilot-api` | [ ] |
| Cannot connect to Supabase | Verify `DATABASE_URL` in .env | [ ] |
| API returns 404 | Check reverse proxy in .htaccess | [ ] |
| Frontend not loading | Verify .htaccess rewrite rules | [ ] |
| CORS errors | Update `CORS_ORIGIN` in .env | [ ] |
| Database queries slow | Check Supabase free tier limits | [ ] |
| SSL certificate issues | Run AutoSSL again in cPanel | [ ] |

---

## Quick Reference Commands

```bash
# SSH to Hostinger
ssh username@your-hostinger-server.com

# Navigate to backend
cd /home/username/finpilot/backend

# View PM2 status
pm2 status

# View logs
pm2 logs finpilot-api

# Restart backend
pm2 restart finpilot-api

# Stop backend
pm2 stop finpilot-api

# Start backend
pm2 start dist/main.js --name "finpilot-api"

# Test database connection
psql "postgresql://postgres:PASSWORD@HOST/postgres" -c "SELECT COUNT(*) FROM users;"

# Pull latest code
git pull origin main

# Full rebuild & restart
npm run build && npx prisma migrate deploy && pm2 restart finpilot-api

# Monitor real-time
pm2 monit

# View PM2 process startup logs
pm2 startup
pm2 save
```

---

## Deployment Complete! 🚀

**Your stack is now live:**
- ✅ React Frontend on Hostinger
- ✅ Node.js Backend on Hostinger (PM2)
- ✅ PostgreSQL on Supabase (free plan)
- ✅ HTTPS/SSL enabled
- ✅ Auto-backups via Supabase

**Cost Breakdown:**
- Hostinger: ~$5-10/month
- Supabase: FREE (500MB included)
- Total: ~$5-10/month

**Next Steps:**
- Monitor application performance
- Set up automated backups
- Plan for scaling if needed
- Consider upgrading Supabase if data grows > 500MB

---

## Useful Resources

- **Hostinger Support:** https://support.hostinger.com/
- **Supabase Docs:** https://supabase.io/docs
- **PM2 Documentation:** https://pm2.keymetrics.io/
- **Prisma ORM:** https://www.prisma.io/docs/
- **Express.js:** https://expressjs.com/

**Questions?** Check deployment guide: [HOSTINGER_SUPABASE_DEPLOYMENT.md](HOSTINGER_SUPABASE_DEPLOYMENT.md)
