# Deployment Guide — KALYO v2

## Quick Deploy (Vercel)

### 1. Push Code to GitHub
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 2. Import to Vercel
- Go to [vercel.com](https://vercel.com) → Import Project
- Select GitHub repo: `Persekutuan-Mahasiswa-Kristen-ITERA/pmkitera-ark` (or your fork)
- Set Production branch: `main`

### 3. Environment Variables (Vercel Dashboard)

| Variable | Example | Required |
|----------|---------|----------|
| `DATABASE_URL` | `postgresql://...aws-0-ap-northeast-1.pooler.supabase.com:6543/pmkark` | ✅ |
| `DIRECT_URL` | `postgresql://...aws-0-ap-northeast-1.pooler.supabase.com:5432/pmkark` | ✅ |
| `JWT_SECRET` | `super-secret-jwt-key-min-32-chars` | ✅ |
| `ADMIN_WHITELIST_EMAILS` | `admin@pmkitera.web.id,yoel.anggara@gmail.com` | ✅ |
| `GOOGLE_CLIENT_EMAIL` | `calendar-sync@kalyo-xxxxx.iam.gserviceaccount.com` | ✅ |
| `GOOGLE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n` | ✅ |
| `GOOGLE_CALENDAR_ID` | `primary` or calendar ID | ✅ |
| `SMTP_HOST` | `smtp.gmail.com` | ✅ |
| `SMTP_PORT` | `587` | ✅ |
| `SMTP_USER` | `your-email@gmail.com` | ✅ |
| `SMTP_PASS` | `your-app-password` | ✅ |
| `LOG_LEVEL` | `info` (optional, default: `info`) | ❌ |

### 4. Configure Supabase
1. Go to Supabase Dashboard → Database Settings
2. Enable **Pooler** → Copy `pooler` host:port as `DATABASE_URL`
3. Copy `direct` host:port as `DIRECT_URL`
4. Run `pnpm prisma migrate deploy` (or use Supabase SQL Editor)

### 5. Configure Google Calendar API
1. Create Service Account in Google Cloud Console
2. Download JSON key → extract `client_email` & `private_key`
3. Share your Google Calendar with Service Account email
4. Use calendar ID (e.g., `primary` or calendar-specific ID)

### 6. Configure Nodemailer (Gmail)
1. Enable 2FA on Gmail account
2. Generate **App Password** → use as `SMTP_PASS`
3. No less-secure apps needed (OAuth2 via App Password)

### 7. Deploy!
- Click **Deploy** in Vercel
- Wait for build → visit `https://your-app.vercel.app`

---

## Production Checklist

| Task | Status |
|------|--------|
| ✅ Environment variables set in Vercel | |
| ✅ Supabase pooler enabled | |
| ✅ Google Calendar shared with Service Account | |
| ✅ Gmail App Password configured | |
| ✅ `pnpm prisma migrate deploy` executed | |
| ✅ Cron job configured (Upstash/Render) | |

---

## Post-Deploy Checks

1. **Homepage**: Visit `/` → verify calendar shows events
2. **Booking**: Try booking an appointment → verify email notification sent
3. **Admin Login**: Visit `/login` → verify JWT login works
4. **Admin Dashboard**: Visit `/admin` → verify CRUD operations work
5. **Analytics**: Visit `/admin/analytics` → verify data displays

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Database connection timeout` | Check Supabase Pooler enabled, firewall rules |
| `Google Calendar 403` | Verify Service Account email has access to calendar |
| `SMTP authentication failed` | Verify Gmail App Password (not regular password) |
| `JWT invalid` | Check `JWT_SECRET` matches across deployments |
