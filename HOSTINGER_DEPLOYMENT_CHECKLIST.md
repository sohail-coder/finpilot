# FinPilot — Hostinger Deployment Checklist

Use this checklist to track your Hostinger deployment progress.

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

## Hostinger Setup

- [ ] **Get Hostinger credentials**
  - [ ] SSH username & password
  - [ ] Server IP or hostname
  - [ ] cPanel login

- [ ] **Create PostgreSQL database in cPanel**
  - [ ] Database name: `finpilot`
  - [ ] Username: `finpilot_user`
  - [ ] Strong password (save it!)
  - [ ] Note Host, Port (usually localhost:5432)

---

## Backend Deployment

- [ ] **SSH into Hostinger**
  ```bash
  ssh username@your-hostinger-server.com
  ```   `1

- [ ] **Clone backend repository**
  ```bash
  cd /home/username
  git clone https://github.com/your-username/finpilot.git
  cd finpilot/backend
  ```

- [ ] **Create .env file** (copy from [.env.hostinger.example](backend/.env.hostinger.example))
  ```bash
  nano .env
  # Paste content, fill in YOUR values
  # Save: Ctrl+X → Y → Enter
  ```

  - [ ] `DATABASE_URL` — with your Hostinger DB credentials
  - [ ] `JWT_SECRET` — generate random 32+ char string
  - [ ] `CORS_ORIGIN` — your domain (https://yourdomain.com)
  - [ ] `OPENAI_API_KEY` — if using AI (optional)
  - [ ] `GOOGLE_CLIENT_ID` — if using Google auth (optional)
  - [ ] `SMTP_*` — if using email (optional)

- [ ] **Install & build**
  ```bash
  npm install
  npx prisma generate
  npm run build
  ```

- [ ] **Run database migrations**
  ```bash
  npx prisma migrate deploy
  ```

- [ ] **Install PM2 globally**
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

- [ ] **Test health endpoint**
  ```bash
  curl http://127.0.0.1:3000/health
  # Should return success response
  ```

---

## Frontend Deployment

### Option A: Using FTP (Easiest)

- [ ] **Download FileZilla** (or similar FTP client)

- [ ] **Connect to Hostinger FTP**
  - [ ] Host: your-hostinger-server.com
  - [ ] Username: FTP username (from cPanel)
  - [ ] Password: FTP password
  - [ ] Port: 21

- [ ] **Upload frontend**
  - [ ] Navigate to `public_html` folder
  - [ ] Upload all files from `finpilot/frontend/dist/`

### Option B: Using SCP Command Line

- [ ] **Upload via SCP**
  ```bash
  scp -r finpilot/frontend/dist/* username@your-hostinger-server.com:/home/username/public_html/
  ```

---

## Web Server Configuration

- [ ] **Create .htaccess for React Router** (in public_html)
  ```bash
  # Via SSH
  nano public_html/.htaccess
  # Paste React Router config from deployment guide
  ```

- [ ] **Configure API reverse proxy** (in .htaccess)
  ```apache
  RewriteRule ^api/(.*)$ http://127.0.0.1:3000/api/$1 [P]
  ```

---

## SSL/HTTPS Setup

- [ ] **Enable AutoSSL in cPanel**
  - [ ] Go to cPanel → AutoSSL
  - [ ] Click "Run AutoSSL Now"
  - [ ] Wait for certificate (usually instant)

- [ ] **Force HTTPS** (in .htaccess)
  ```apache
  RewriteCond %{HTTPS} off
  RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
  ```

---

## Post-Deployment Testing

### Frontend

- [ ] Visit `https://yourdomain.com` in browser
- [ ] Check page loads without errors
- [ ] Verify all UI components render correctly
- [ ] Open browser DevTools (F12) → Console tab
  - [ ] Should have no JavaScript errors
  - [ ] Check Network tab — API calls should show
- [ ] Click a few pages to verify React Router works

### Backend

- [ ] **Check backend is running**
  ```bash
  pm2 status
  ```

- [ ] **Test API endpoint**
  ```bash
  curl https://yourdomain.com/api/health
  # Should return success
  ```

- [ ] **Test database connection**
  ```bash
  curl https://yourdomain.com/api/users
  # Should return data or proper error
  ```

### Integration

- [ ] **Login functionality works**
- [ ] **Create a test transaction**
- [ ] **Check AI features** (if enabled)
- [ ] **Check email notifications** (if configured)

---

## Monitoring & Maintenance

- [ ] **Check PM2 logs regularly**
  ```bash
  pm2 logs finpilot-api
  ```

- [ ] **Set up backup script** (optional)
  ```bash
  # Create backup-db.sh
  # Schedule in crontab: 0 2 * * * /home/username/backup-db.sh
  ```

- [ ] **Monitor disk usage** (cPanel → Disk Usage)

- [ ] **Update code periodically**
  ```bash
  cd /home/username/finpilot/backend
  git pull origin main
  npm install
  npm run build
  npx prisma migrate deploy
  pm2 restart finpilot-api
  ```

---

## Troubleshooting Log

| Issue | Solution | Status |
|-------|----------|--------|
| Backend won't start | Check `pm2 logs` and `.env` | [ ] |
| API returns 404 | Verify reverse proxy config | [ ] |
| Frontend not loading | Check `.htaccess` and files uploaded | [ ] |
| CORS errors | Update `CORS_ORIGIN` in .env | [ ] |
| Database errors | Verify `DATABASE_URL` in .env | [ ] |
| SSL certificate not working | Run AutoSSL again in cPanel | [ ] |

---

## Final Verification

- [ ] Frontend loads without errors ✅
- [ ] Backend API is responsive ✅
- [ ] Database is connected ✅
- [ ] SSL certificate is valid ✅
- [ ] Login works end-to-end ✅
- [ ] PM2 auto-restarts on server reboot ✅

---

## Deployment Complete! 🚀

Your FinPilot app is now live on Hostinger!

**Next Steps:**
- Monitor logs: `pm2 logs finpilot-api`
- Set up automated backups
- Configure monitoring alerts
- Share your domain with users

---

## Quick Reference Commands

```bash
# SSH into Hostinger
ssh username@your-server.com

# Backend folder
cd /home/username/finpilot/backend

# View running processes
pm2 status

# View logs
pm2 logs finpilot-api

# Restart backend
pm2 restart finpilot-api

# Stop backend
pm2 stop finpilot-api

# Start backend
pm2 start finpilot-api

# View database
psql -U finpilot_user -d finpilot -c "SELECT COUNT(*) FROM users;"

# Pull latest code
git pull origin main

# Rebuild & restart
npm run build && npx prisma migrate deploy && pm2 restart finpilot-api

# Monitor real-time
pm2 monit
```

---

## Support

If you encounter issues:
1. Check PM2 logs: `pm2 logs finpilot-api`
2. Verify .env variables
3. Check Hostinger cPanel status
4. Review deployment guide: [HOSTINGER_DEPLOYMENT.md](HOSTINGER_DEPLOYMENT.md)

Good luck! 🎉
