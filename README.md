# KALYO v2 — Personal Scheduling Engine

Next.js full-stack scheduling system with Google Calendar integration.

## Stack

- **Framework**: Next.js 16.3.4 (App Router, Turbopack)
- **Database**: Supabase Postgres (free tier)
- **ORM**: Prisma 6.4.1
- **Authentication**: None (admin endpoint protected by email whitelist)
- **Calendar**: Google Calendar API (Service Account)
- **Styling**: Tailwind CSS v4
- **i18n**: Custom React Context (ID/EN)
- **Calendar UI**: FullCalendar 6.1.21

## Environment Variables

Create `.env.local` with:

```bash
DATABASE_URL=postgresql://postgres:password@db.hbbteaqfhuqjyfbuklcv.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:password@db.hbbteaqfhuqjyfbuklcv.supabase.co:5432/postgres

# Google Service Account (for calendar sync)
GOOGLE_SERVICE_ACCOUNT_EMAIL=kalyo-85@kalyo-506619.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# Admin access (comma-separated emails)
ADMIN_EMAILS=febrianyoel12@gmail.com

# Auth secrets
AUTH_SECRET=a8f7c6e5d4c3b2a1a8f7c6e5d4c3b2a1
NEXTAUTH_SECRET=a8f7c6e5d4c3b2a1a8f7c6e5d4c3b2a1
```

## Run

```bash
pnpm dev
```

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | / | Public calendar view & appointment form |
| GET | /admin | Admin dashboard (email-protected) |
| GET | /api/events | Merged calendar events |
| GET | /api/availability | Available time slots |
| POST | /api/appointment-requests | Submit request |
| GET | /api/appointment-requests/status?token=... | Check status |
| GET | /api/admin/appointment-requests | List all requests (admin) |
| PATCH | /api/admin/appointment-requests/status | Approve/reject (admin) |

## Project Status

- ✅ Phase 0: Project Init & Dependencies
- ✅ Phase 1: Database Schema (Prisma)
- ✅ Phase 2: Google Calendar Integration
- ✅ Phase 3: Availability Engine
- ✅ Phase 4: Public Calendar View & Appointment Form
- ✅ Phase 5: Admin Dashboard & Approval Flow

## Next Steps (Optional)

- Google OAuth 2.0 for admin login
- Email notifications on appointment status change
- Weekly polling to sync local DB with Google Calendar
- Rate limiting & security hardening
