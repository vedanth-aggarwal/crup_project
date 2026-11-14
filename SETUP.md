# Clubo: going live

The code for Phases 0–5 is in place (see PLAN.md). These steps connect it to real accounts.

## 1. Firebase Admin key (needed for all data)
1. Firebase console → clubo-berkeley → Project settings → Service accounts → **Generate new private key**.
2. Save the file as `clubo/service-account.json` (gitignored).
3. Copy `client_email` into `FIREBASE_CLIENT_EMAIL` and `private_key` into `FIREBASE_PRIVATE_KEY` in `.env` (keep the `\n` sequences, wrap in double quotes).

## 2. Google sign-in (optional)
Firebase console → Authentication → Sign-in method → enable **Google**. After deploying, add your Vercel domain under Authentication → Settings → Authorized domains.

## 3. Vercel
```bash
npx vercel login
```
```bash
npx vercel link --cwd apps/web
```
- In the Vercel project: **Storage → Create → Blob**, and connect it. This adds `BLOB_READ_WRITE_TOKEN`.
- Add every variable from `.env` to the project's Environment Variables (Production + Preview), and set `NEXT_PUBLIC_APP_URL` to the production URL.
- Set the project's Root Directory to `apps/web` (Vercel installs from the monorepo root automatically).
- Deploy: `npx vercel --prod --cwd apps/web`.

Crons (`apps/web/vercel.json`) run daily on the Hobby plan: scrape 6–7am PT, extraction backlog 30 min later, emails 8–9am PT.

## 4. Email (Resend)
- Create an API key → `RESEND_API_KEY`.
- Resend can't send *from* a gmail.com address. Verify a domain you own (or a subdomain) in Resend and set `EMAIL_FROM` to an address on it, e.g. `hello@mail.yourdomain.com`.

## 5. First run
1. Sign up on the site with an email listed in `ADMIN_EMAILS`. You get the admin role automatically.
2. Go to `/admin/clubs` → **Add club** or **Import CSV** (10 real clubs is a good first test).
3. Click **Scrape all now** on `/admin`. Apify calls back to `/api/webhooks/apify` when it finishes (only works on the deployed URL, not localhost).
4. Watch `/admin/runs`, then work through `/admin/review`.

## Firestore rules & indexes
```bash
npm run deploy:rules
```
