# Deployment TODO

This file collects the minimal env vars and steps to deploy `arPosts` to Vercel.

## Required environment variables
- DATABASE_URL — Postgres connection string, e.g. `postgres://USER:PASS@HOST:PORT/DBNAME`
- DB_SSL — `true` if your provider requires TLS (set as string)
- JWT_SECRET — long random secret for signing JWTs (generate with `openssl rand -hex 32`)
- NODE_ENV — `production` for Vercel production
- LOG_LEVEL (optional) — `info` or `debug`

## Local `.env` (for dev only)
```
DATABASE_URL=postgres://alice:secret@localhost:5432/arposts
DB_SSL=false
JWT_SECRET=6f1a7e... (your generated secret)
NODE_ENV=development
```

## Quick deploy checklist
1. Commit & push changes:

```bash
git add .
git commit -m "Prepare for Vercel serverless"
git push
```

2. Add environment variables in Vercel (Dashboard → Project → Settings → Environment Variables) or via CLI:

```bash
npx vercel env add DATABASE_URL production
# repeat for other vars
```

3. Deploy to Vercel (preview or production):

```bash
npx vercel --prod
```

4. Run DB migrations against hosted Postgres (CI or manual):

```bash
psql "$DATABASE_URL" -f path/to/migrations.sql
```

5. Verify endpoints:
- `GET /api/health` or `GET /api` (depending on deployment wrapper)
- Check Vercel Cron job for `/api/cron` (vercel.json sets daily at 00:00 UTC)

## Notes
- The code uses a global cached `pg` Pool and prefers `DATABASE_URL`.
- The in-process `setInterval` cleanup was moved to `/api/cron` for Vercel Cron.
- If your DB requires a connection pool proxy (PgBouncer / RDS Proxy), configure it with `DATABASE_URL`.
