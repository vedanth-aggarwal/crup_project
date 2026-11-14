# Clubo

**Every Berkeley club event in one place, pulled straight from club Instagram posts.**

🔗 **Live site: [clubo-six.vercel.app](https://clubo-six.vercel.app)**

Berkeley clubs announce almost everything on Instagram: info sessions, hackathons, socials, recruiting deadlines. To keep up, students have to follow dozens of accounts and read posters one by one. Clubo scrapes those posts every day and uses an LLM to turn each poster and caption into a structured event (date, time, location, speakers, perks, sign-up links). It then puts them all on one searchable board.

## Features

- **Event feed:** upcoming events grouped into *Happening now*, *Later today*, *This week* and *Coming up*, plus a *Past month* section. Filters for category, club, date, free food, free entry and online/in-person live in the URL, so any filtered view can be shared.
- **Structured event pages:** summary, highlights, agenda, speakers, partner companies, who it's for, cost, RSVP info and links, so you don't have to squint at the poster.
- **Deadlines:** application and recruiting deadlines in their own view.
- **Clubs:** a page for each club with its upcoming and past events. Follow clubs or categories.
- **Saved events and calendar:** bookmark events and add them to Google, Apple or Outlook calendars (`.ics`).
- **Ask Clubo (AI chat):** ask things like *"free food events this week"* or *"something chill to meet people"*. The model calls a small set of safe tools: structured search, vector search over event embeddings, event details, a club list and bookmarking. It never writes raw queries.
- **Email reminders:** a daily email for saved events, a Sunday digest, and notices when a saved event changes. Every email has a signed one-click unsubscribe link.
- **Admin console:** add or import clubs, start scrapes, review low-confidence extractions, edit or merge events, and see scrape runs and costs.

## How it works

```
Instagram ──(Apify scraper, daily cron)──▶ /api/webhooks/apify
                                              │ store new posts
                                              ▼
                                     extract worker (chains itself)
                       posters → Vercel Blob (WebP, blur placeholder)
                       caption + poster → OpenAI (structured output)
                       dedupe/merge → events + embeddings in Firestore
                                              │
                                              ▼
                   Next.js App Router pages (cached, tag-revalidated)
```

1. **Scrape:** a Vercel cron runs every morning and starts an Apify `instagram-post-scraper` run for each club that's due. When the run finishes, Apify calls the app's webhook, which is checked with a shared secret.
2. **Extract:** each new post is sent to `gpt-5.4-mini` with its poster images, caption and resolved links. The model returns zero or more events matching a strict Zod schema. Events with high confidence are published automatically, and the rest go to the admin review queue.
3. **Dedupe:** events from the same club within a day of each other with similar titles are merged, so reposts and reminder posts don't create duplicates.
4. **Embed:** each event gets a `text-embedding-3-small` vector for semantic search and "you might also like".
5. **Notify:** a daily cron sends reminder and digest emails over SMTP.

## Tech stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui, lucide icons |
| Auth | Firebase Auth (email/password + Google), httpOnly session cookies |
| Database | Cloud Firestore with a vector index, accessed only server-side through the Admin SDK (client rules deny everything) |
| Scraping | Apify Instagram Post Scraper |
| AI | OpenAI Responses API (extraction + chat tools), OpenAI embeddings |
| Images | sharp → Vercel Blob |
| Email | Nodemailer (Gmail SMTP) + React Email templates |
| Hosting | Vercel (functions + cron jobs) |

## Repo layout

```
apps/web/            Next.js app (deployed to Vercel, root directory)
  app/(app)/         feed, events, clubs, deadlines, saved, chat, settings
  app/admin/         admin console
  app/api/           auth, chat, search, ics, cron jobs, Apify webhook, unsubscribe
  components/        UI (events, chat, admin, layout)
  lib/server/        Firestore, scraping, extraction pipeline, embeddings, email
  scripts/           seed clubs, backfill scrapes, check run status, test email
packages/shared/     Zod schemas + categories shared by app and pipeline
firestore.rules      deny-all client rules
firestore.indexes.json
```

## Running locally

Requires Node 24 and a Firebase project (Clubo uses cloud Firebase, not emulators).

```bash
npm install
cp .env.example .env   # fill in Firebase, Apify, OpenAI, SMTP, secrets
npm run dev            # http://localhost:3000
```

Other scripts:

```bash
npm run check          # typecheck + lint + tests
npm run deploy:rules   # deploy Firestore rules and indexes
cd apps/web && node --env-file=../../.env scripts/seed-clubs.mjs
cd apps/web && node --env-file=../../.env scripts/backfill.mjs 90 calhacks berkeleyvss
```

The Apify webhook needs a public URL, so scraping end to end only works on the deployed site. See [SETUP.md](SETUP.md) for the full go-live checklist (Vercel, Blob, env vars, email, first scrape) and [PLAN.md](PLAN.md) for the original product and architecture plan.

## Deploying

```bash
npx vercel deploy --prod
```

Crons are defined in [`apps/web/vercel.json`](apps/web/vercel.json) and require `CRON_SECRET`.

## Clubs

Clubo currently tracks 27 Berkeley clubs across tech, consulting, finance and business, including Cal Hacks, Codebase, ML@B, Launchpad, DSS, Blueprint, Blockchain at Berkeley, SkyDeck, Berkeley Consulting, Berkeley PBL, VSS, 180DC, Big Data, DataGood, Traders at Berkeley and BWIB. Admins can add more from `/admin/clubs`. A club can opt out at any time and its events are hidden.
