# Deployment TODO

This project is currently running on Vercel and the route wiring is fixed. The remaining live issue is the database connection string in production.

## Current status
- `/` redirects correctly to the site
- `/health` returns `200 {"status":"ok"}`
- `/signup`, `/login`, and `/posts` now reach the app serverless function
- The remaining runtime failure is a Postgres connection issue: `getaddrinfo ENOTFOUND ...supabase.co`

## Required environment variables
- DATABASE_URL — full Postgres/Supabase connection string
- DB_SSL — must be set to `true` for Supabase TLS connections
- JWT_SECRET — long random secret for app JWTs
- NODE_ENV — `production` in Vercel

Optional Supabase values:
- SUPABASE_URL
- SUPABASE_ANON_KEY
# Deployment & Troubleshooting TODO

This project uses Supabase Postgres for data and Vercel for hosting. Keep env names consistent when adding values in Vercel.

## Required environment variables (production)
- `DATABASE_URL` — Supabase Postgres connection string, e.g. `postgres://USER:PASS@HOST:PORT/DBNAME`
- `DB_SSL` — set to `true` (string) if the provider requires TLS
- `JWT_SECRET` — long random secret for signing app JWTs (generate with `openssl rand -hex 32`)
- `NODE_ENV` — set to `production`
- `LOG_LEVEL` (optional) — `info` or `debug`

Optional Supabase client keys (only if the app uses the Supabase client directly):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)

## Quick deploy checklist
1. Create the Supabase project and required tables/policies.
2. Add the environment variables to Vercel Project → Settings → Environment Variables (or use `npx vercel env add`).
3. Commit and push to the branch used by Vercel (usually `main`).
4. Deploy to Vercel (`npx vercel --prod`) and watch the deployment logs.

## Post-deploy verification
- `GET /` → should redirect to the Site page
- `GET /health` → should return `{"status":"ok"}`
- `POST /signup` → should return `201` on success
- `POST /login` → should return `200` + token
- `GET /posts?...` → should return `200` + posts

## Common failures and how to fix them

- DNS / ENOTFOUND when connecting to the DB:
  - Symptom: `getaddrinfo ENOTFOUND <db-host>` (503 responses in the app logs).
  - Cause: the `DATABASE_URL` host is incorrect, stale, or not yet resolvable from Vercel.
  - Fix:
    1. Open your Supabase (or Postgres provider) dashboard → Database → Connection string and copy the exact production `DATABASE_URL`.
    2. Ensure the host part (example: `db.<project_ref>.supabase.co`) is the DB host — not the project REST/API URL.
    3. If the URL contains special characters, keep them percent-encoded.
    4. In the terminal you can check DNS locally:

```bash
nslookup db.yourproject.supabase.co
dig +short db.yourproject.supabase.co
```

    5. After updating the env var, redeploy the Vercel project and re-run the endpoint checks.

- TLS / SSL issues:
  - Ensure `DB_SSL` is set to `true` if your provider requires TLS (Supabase does).

- Generic 500s after routing fixes:
  - Check Vercel function logs for stack traces and ensure `DATABASE_URL` and `JWT_SECRET` are present.

## Debugging tips
- To inspect live responses quickly, run (after deploy):

```bash
curl -i -X POST https://<your-host>/signup -H 'Content-Type: application/json' -d '{"username":"test","password":"pass"}'
curl -i https://<your-host>/posts?lat=40.7128&lng=-74.0060&radius=100
```

- If you see `ENOTFOUND`, paste the host portion of your `DATABASE_URL` here (redact credentials) and I can verify DNS and common formatting errors.

## Suggested next improvements
- Add structured logging around DB connect attempts so runtime errors are clearer.
- Consider using the Supabase service role key for privileged server operations rather than raw SQL when appropriate.
- Add a small health-check that attempts a simple `SELECT 1` against the DB and surfaces clear errors in `/health` when misconfigured.

## Local `.env` (dev only)
```env
DATABASE_URL=postgres://alice:secret@localhost:5432/arposts
DB_SSL=false
JWT_SECRET=6f1a7e...your-generated-secret
NODE_ENV=development
```

---
If you want, I can also add a small DB connectivity check to `/health` that returns a clear DB status, and then re-run the live tests to confirm everything is green.
