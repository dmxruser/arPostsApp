# Deployment TODO

This project is set up to use Supabase for auth/data storage, with Vercel hosting the app.

## Required environment variables
- DATABASE_URL — Supabase Postgres connection string, e.g. `postgres://USER:PASS@HOST:PORT/DBNAME`
- DB_SSL — `true` if your provider requires TLS (set as string)
- JWT_SECRET — long random secret for signing app JWTs (generate with `openssl rand -hex 32`)
- NODE_ENV — `production` for Vercel production
- LOG_LEVEL (optional) — `info` or `debug`

If you also use Supabase directly in the app, keep the same names for the project values you already rely on:
- SUPABASE_URL — your project URL, e.g. `https://xyzcompany.supabase.co`
- SUPABASE_ANON_KEY — anon/public key for client-side reads and safe access
- SUPABASE_SERVICE_ROLE_KEY — server-side key for privileged operations

## Local `.env` (for dev only)
```env
DATABASE_URL=postgres://alice:secret@localhost:5432/arposts
DB_SSL=false
JWT_SECRET=6f1a7e...your-generated-secret
NODE_ENV=development
SUPABASE_URL=https://xyzcompany.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Quick deploy checklist
1. Create the Supabase project and tables/policies.

2. Add environment variables in Vercel:
   - Dashboard → Project → Settings → Environment Variables
   - Or via CLI:

```bash
npx vercel env add DATABASE_URL production
npx vercel env add DB_SSL production
npx vercel env add JWT_SECRET production
npx vercel env add NODE_ENV production
npx vercel env add SUPABASE_URL production
npx vercel env add SUPABASE_ANON_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
```

3. Commit & push:

```bash
git add .
git commit -m "Prepare Supabase deployment"
git push
```

4. Deploy to Vercel:

```bash
npx vercel --prod
```

5. Verify routes:
- `GET /` should load the site
- `GET /health` should return service health
- API routes like `/signup`, `/login`, `/posts` should work with Supabase-backed auth/data
- Cron job stays at `/api/cron` via the Vercel config

## Supabase notes
- Keep the app’s env names consistent with the existing project setup.
- Use the service role key only on the server.
- Keep the anon key client-side only.
- Put row-level security (RLS) policies in Supabase for user-scoped data access.
- `DATABASE_URL` can still be the primary connection string while Supabase keys are added for any direct Supabase usage.

## Suggested next steps
- Add Supabase client setup in the app
- Replace direct DB calls with Supabase queries where appropriate
- Add auth/session handling using Supabase auth or your own JWT flow
- Test login/signup flows against the production project before launch
