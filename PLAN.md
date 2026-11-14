# Clubo: Berkeley Club Events Portal (Plan)

> One place to see every Berkeley club event, built automatically from club Instagram posts.
> Design quality is a core requirement, not a polish step. See **§13 Design & UX**.

---

## 1. What changed from the original idea

| Original idea | Refined version | Why |
|---|---|---|
| Scrape every X days | **Per-account schedule** (active clubs daily, quiet clubs every 3–7 days), fetching only posts newer than the last one seen | Cheaper, fresher for the clubs that matter |
| Show the IG image | **Copy every poster into Firebase Storage** | Instagram CDN image URLs expire within days, so hot-linked images break |
| One post = one event | A post can hold **0, 1, or many events** (weekly lineups, recaps, recruiting posts). Duplicates get **merged** (teaser + reminder + "tonight!" posts for the same event) | Real club feeds look like this |
| LLM extraction | LLM extraction **plus a confidence score and an admin review queue** for low-confidence or ambiguous results | Dates on posters are messy ("this Thurs", no year) |
| "SQL agent" chatbot | **Tool-calling agent** with two tools: `search_events` (structured filters) and `semantic_search` (vectors) | Firestore isn't SQL. Typed tools are safer and more accurate than generated queries |
| Bookmarks | Bookmarks **plus following clubs and categories** | Powers "new event from a club you follow" emails and a weekly digest |
| Email updates | Reminders, deadline alerts, weekly digest, **and Add-to-Calendar (.ics / Google Calendar)** | Calendar export is cheap to build and students use it a lot |
| — | **Deadlines are their own type** (applications, RSVPs, ticket sales) and are separate from events | "Applications close Fri" is not an event, but students want alerts for it |

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Frontend | **Next.js 15 (App Router) + TypeScript + Tailwind v4 + shadcn/ui (Radix)** |
| Design & motion | Design tokens as CSS variables, **Framer Motion**, **Lucide** icons, `sonner` toasts, `cmdk` command palette, `vaul` bottom sheets, Geist + Instrument Serif fonts (see §13) |
| Hosting | **Vercel** (Next.js app, API routes, and Vercel Cron) |
| Auth | **Firebase Auth**: email/password signup open to any email (plus optional Google sign-in), no domain restriction for now; admins set with a custom claim `admin: true` |
| Database | **Cloud Firestore**, using its native **vector search** (`findNearest`) for embeddings |
| File storage | **Vercel Blob** (posters, carousel images). Firebase Storage would need the Blaze plan |
| Background jobs | **Next.js API routes on Vercel**, triggered by **Vercel Cron** and the Apify webhook, protected by `CRON_SECRET`. No Cloud Functions: Firebase is Auth + Firestore only (Spark plan) |
| Instagram scraping | **Apify** `apify/instagram-post-scraper` (public profiles, pay per result) behind a `Scraper` interface so it can be swapped later |
| LLM (extraction + chat) | Vision-capable model behind a `LLMProvider` interface. Default: **Claude Sonnet**; OpenAI also works if that's the key you have |
| Embeddings | `text-embedding-3-small` (OpenAI) or Vertex `text-embedding-005`, behind an `Embedder` interface |
| Email | **Resend** + React Email templates |
| Link resolution | Small fetcher that expands Linktree / bit.ly / Partiful / Google Form links and pulls the page title and description |

### Repo layout
```
clubo/
  apps/web/             Next.js app on Vercel (student + admin UI, chat, cron + webhook API routes)
  apps/web/lib/server/  server-only code: Firebase Admin, Apify, LLM extraction, embeddings, email
  packages/shared/      Zod schemas, types, category list
  firestore.rules
  firestore.indexes.json
  firebase.json         Firestore rules/indexes + Auth only (deploy with `npm run deploy:rules`)
```

---

## 3. Data model (Firestore)

```
clubs/{clubId}
  name, igHandle, category[], description, avatarUrl, website
  active: bool, scrapeIntervalHours: number, lastScrapedAt, lastPostAt
  stats: { postsScraped, eventsFound }

posts/{postId}                      // raw scraped IG post (idempotent on IG shortcode)
  clubId, shortcode, url, caption, postedAt, type (image|carousel|video)
  imagePaths[] (Storage), rawLinks[], resolvedLinks[{url,title,desc}]
  status: pending | extracted | no_event | needs_review | failed
  extraction: { model, raw JSON, confidence, error }

events/{eventId}
  clubId, clubName (denormalized), sourcePostIds[]
  title, summary (1–2 sentences), description
  kind: event | deadline
  startAt, endAt (Timestamp, America/Los_Angeles), allDay
  deadlineAt (for kind=deadline: applications, RSVP, tickets)
  location: { name, address, isOnline, campusBuilding }
  categories[] (fixed list), tags[] (free-form: "free food", "boba", "networking")
  cost: { isFree, price }, freeFood: bool
  links: { rsvp, tickets, application, info[] }
  posterPath, imagePaths[]
  poster: { sizes: {sm, md, lg}, width, height, blurhash, dominantColor, altText }
  confidence, status: published | needs_review | hidden
  embedding: Vector(1536)         // built from title + summary + club + tags + location
  bookmarkCount, createdAt, updatedAt

users/{uid}
  email, name, followedClubs[], followedCategories[]
  notificationPrefs: { reminders: bool, reminderLeadHours: 24, deadlines: bool,
                       weeklyDigest: bool, newFromFollowed: bool }

users/{uid}/bookmarks/{eventId}
  createdAt, eventStartAt (denormalized so reminder queries are cheap)

notifications/{id}                // send log, so nothing is emailed twice
  uid, eventId, type, sentAt

scrapeRuns/{runId}                // admin observability
  startedAt, finishedAt, clubsProcessed, postsNew, eventsCreated, costEstimate, errors[]

chatSessions/{uid}/messages/{id}  // optional, for chat history
```

**Categories (fixed list, used for filters):** Social, Professional/Career, Tech, Academic, Cultural, Arts & Performance, Sports & Rec, Service/Volunteering, Religious, Political/Advocacy, Recruiting/Applications, Food, Greek Life, Wellness.

**Indexes:** `events` on (status, startAt), (status, categories array-contains, startAt), (clubId, startAt), (status, kind, deadlineAt). Plus a vector index on `events.embedding` (cosine), with `status` as a pre-filter field.

---

## 4. Ingestion pipeline

```
Vercel Cron → /api/cron/scrape
  └─ scheduleScrapes: find clubs where now - lastScrapedAt >= scrapeIntervalHours
       └─ one Apify run for that batch of handles (resultsLimit ~10, only posts newer than lastPostAt)
            └─ Apify webhook → /api/webhooks/apify
                 ├─ upsert posts/{shortcode}   (skip if it already exists → idempotent)
                 ├─ download images → Vercel Blob (+ resized WebP versions, blurhash, main color, dimensions)
                 └─ extract new posts in small batches (/api/cron/extract picks up any left `pending`)

extractPost(postId)
  1. Resolve links in the caption (and in the club's bio link if the caption says "link in bio")
  2. Call the vision LLM with: poster image(s) + caption + resolved link text + post date + club name
     → strict JSON (Zod schema): { events: [...], deadlines: [...], isEventPost, confidence }
     Also returns poster alt text for accessibility.
     Prompt rules: work out relative dates from postedAt, use PT timezone,
     never invent missing fields (null instead)
  3. For each extracted item → dedupe:
       look for events with the same clubId and a start within ±1 day; if titles are similar
       (or embedding cosine > 0.9) → merge (fill empty fields, add sourcePostId)
  4. Write events: confidence >= 0.7 → published, otherwise → needs_review
  5. Compute summary + embedding inline whenever the pipeline or admin writes event content
```

**Edge cases to handle:** carousels (send up to 4 images), Reels (use the caption and thumbnail only), recap posts ("thanks for coming!" → no event), recurring events ("every Tuesday" → a `recurrence` field, expanded in the UI), posts edited after scraping (re-scrape the last N posts on each run), private or renamed accounts (flag them in admin).

---

## 5. Student app

**Pages**
- `/` **Feed**: event cards (poster, club, title, date/time, location, tags), grouped by Today / This Week / Later. Sticky filter bar.
- **Filters**: date range (Today, This week, Weekend, custom), category, club, free food, free entry, online/in-person, "from clubs I follow", text search.
- `/events/[id]` **Detail**: full poster (carousel), all details, links (RSVP / apply / tickets), "View original post", bookmark, Add to Google Calendar / download .ics, similar events (vector neighbors).
- `/deadlines`: upcoming application and RSVP deadlines, sorted by urgency.
- `/clubs` and `/clubs/[id]`: directory, follow button, the club's upcoming and past events.
- `/saved`: bookmarked events plus a calendar view.
- `/chat`: the assistant (see §7).
- `/settings`: notification preferences, followed clubs and categories.
- `/login` and `/signup`: email + password (any email), password reset, optional Google sign-in.
- Public browsing works without logging in; bookmarks, follows, email, and chat need an account.

---

## 6. Admin app (`/admin`, needs the `admin` claim)

- **Clubs**: add by IG handle (auto-fills name and avatar from a test scrape), set categories and scrape interval, pause or remove, bulk CSV import.
- **Scrape controls**: "Scrape now" per club or for all, run history (`scrapeRuns`), errors, Apify/LLM cost estimate.
- **Review queue**: `needs_review` events next to the original post/poster; edit, approve, merge, or reject.
- **Events**: search, edit, hide, and merge any event by hand.
- **Raw posts**: see what the scraper returned and re-run extraction on one post.
- (Later) **Club submission form**: students or clubs suggest an IG handle, and admins approve it.

---

## 7. Chat assistant ("Ask Clubo")

Implemented as a Next.js route handler that streams responses. Runs a tool-calling loop with these tools:

| Tool | Purpose |
|---|---|
| `search_events({ dateFrom, dateTo, categories?, clubIds?, tags?, freeFood?, isFree?, text?, limit })` | Exact, structured Firestore query, for "anything Friday night?" or "tech events next week" |
| `semantic_search({ query, dateFrom?, dateTo?, limit })` | Embeds the query, then runs Firestore `findNearest` with a `status=published` pre-filter and drops past events, for "something chill to meet people" or "events about startups / Stripe" |
| `get_event({ id })` | Full details for a follow-up question |
| `list_clubs({ category?, query? })` | "What dance clubs are there?" |
| `bookmark_event({ id })` | "Save that one for me" (logged-in users only) |

- The system prompt includes **today's date in PT** so "this weekend" resolves correctly.
- Answers show **inline event cards** (rendered from the tool results), not just text, and always link to the event page.
- Hybrid search: when a query has both a time range and a topic, the agent calls `semantic_search` with date bounds. Stripe/company names also match on `tags` and full text.
- Guardrails: per-user rate limit (e.g. 30 messages/day), the API key stays on the server only, and the agent can only read published events.

---

## 8. Notifications

`/api/cron/notify` runs on Vercel Cron (daily on the Hobby plan; hourly needs Vercel Pro or an external pinger):
- **Event reminders**: bookmarked events starting within `reminderLeadHours` (default 24h, plus an optional 1h) → email.
- **Deadline alerts**: bookmarked or followed-club deadlines, sent 3 days and 1 day before.
- **New from followed**: when an event is published for a followed club or category → one batched email per day at most.
- **Weekly digest**: Sunday 6pm PT, "your week ahead" (followed clubs, top events, deadlines).
- Every send is logged in `notifications` so nothing goes out twice; emails carry a one-click unsubscribe link (signed token).
- Event changes (time or location moved) → "Update:" email to people who bookmarked it.

---

## 9. Security

- Firestore rules: anyone can read published `events` and `clubs`. Users read and write only their own `users/{uid}/**`. Only the Admin SDK (server code on Vercel) writes to `posts`, `events`, `scrapeRuns`, and `notifications`. Admin UI writes go through server actions that check the `admin` claim.
- All secrets (Firebase Admin, Apify, LLM, embeddings, Resend, Blob, CRON_SECRET) live in **Vercel environment variables**; none reach the client.
- Only public accounts are scraped. Every event credits the club and links to the original post, and a club can ask to be removed (opt-out flag). Instagram's ToS discourages scraping, which is why the scraper sits behind an interface: it can be replaced later with Instagram's Business Discovery API for business/creator accounts, or with club self-submission.

---

## 10. Rough monthly cost (~150 clubs, ~500 posts/week)

These are estimates; check current pricing before relying on them.
- Apify: ~2k posts/month → a few dollars
- Vision extraction: ~2k calls → ~$10–30 depending on the model (send smaller images to save)
- Embeddings + chat: low single-digit dollars at student scale (chat depends on usage)
- Firebase (Spark, free): Auth + Firestore within free quotas
- Vercel: Hobby is free (crons limited to once a day); Pro is $20/mo if hourly crons or longer functions are needed. Blob storage for posters is the main storage cost
- Resend: free tier is 3k emails/month

---

## 11. Build phases

**Phase 0: Setup (½ day)**
Monorepo, Firebase project `clubo-berkeley` (Auth + Firestore, used directly in the cloud, no emulators), Vercel deploy, shared Zod schemas, CI lint/typecheck.
**Design foundation:** design tokens (light + dark), fonts, themed shadcn primitives, AppShell (top nav + mobile tab bar), `/design` style guide page (§13).

**Phase 1: Ingestion (2–3 days)**
Clubs collection + a minimal admin page to add handles → Apify integration → posts + image copying → extraction with the LLM → events written. Test on 10 real clubs and tune the prompt.

**Phase 2: Student dashboard (2–3 days)**
Landing page, feed, filters, event detail (modal + bottom sheet), club pages, bookmarks, follows, Add to Calendar, ⌘K palette. All loading/empty/error states and motion from §13 are included here, not saved for the end.

**Phase 3: Admin tooling (1–2 days)**
Review queue, event editing and merging, scrape-run history, scheduled scraping turned on.

**Phase 4: Embeddings + chat (2 days)**
Embeddings on event write + vector index, chat route with tools, inline event cards in chat.

**Phase 5: Notifications (1–2 days)**
Resend, reminder/deadline/digest schedulers, preferences page, unsubscribe.

**Phase 6: Polish (ongoing)**
Design review against §13.11 (phone, dark mode, accessibility, Lighthouse ≥ 95), Playwright screenshot tests, PWA/offline, share images per event, dedupe tuning, analytics, club submission form.

---

## 12. Open decisions (need your input)

1. ~~**LLM provider**~~: decided. OpenAI for extraction, chat, and embeddings.
2. ~~**Apify account**~~: decided. Token is in `.env`.
3. **Starting club list**: which IG handles do we seed with (CSV of 20–50 is ideal)?
4. ~~**Login**~~: decided. Any email + password for now (can restrict to `@berkeley.edu` later).
5. **Name and domain**: keep "Clubo"?

---

## 13. Design & UX

The goal is for Clubo to feel like a polished consumer app, not a club spreadsheet. **Posters are the content**, so the interface stays calm and neutral and lets the colorful posters stand out.

### 13.1 Design direction: "Campus bulletin board, but beautiful"
- **Poster-first layout.** Posters use Instagram's 4:5 ratio in a responsive grid (1 column on phones, 2 on tablets, 3–4 on desktop). The UI around them is quiet: lots of whitespace, thin borders, soft shadows.
- **Editorial type.** A serif display font for big headings ("This Week at Berkeley") paired with a clean sans-serif for the UI, so it reads like a campus magazine.
- **Colors inspired by Berkeley:** deep navy and warm gold, used sparingly as accents. These are our own colors, not official Cal branding or logos.
- **Light and dark mode** from day one. Dark mode is where posters look best.
- **Mobile first.** Most students will open it from an Instagram link or a group chat, so design for a 375px screen first and scale up.

### 13.2 Design tokens (single source of truth)
Defined once as CSS variables in `apps/web/styles/tokens.css` and connected to Tailwind's `@theme`. No hard-coded hex values in components.

| Token group | Values |
|---|---|
| Color: neutrals | `--bg`, `--surface`, `--surface-raised`, `--border`, `--text`, `--text-muted` (separate light and dark sets) |
| Color: brand | `--brand` (navy ~`#0B2545`), `--accent` (gold ~`#F2B705`), `--accent-contrast` |
| Color: semantic | `--success`, `--warning` (deadline soon), `--danger` (deadline today), `--info` |
| Color: categories | One soft color per category (Tech = indigo, Cultural = coral, …) for chips and calendar blocks, checked for AA contrast in both modes |
| Type | Display: **Instrument Serif** (or Fraunces). UI: **Geist Sans**. Numbers/dates: **Geist Mono**. Scale: 12 / 14 / 16 / 18 / 24 / 32 / 48 / 64 |
| Space | 4px grid: 4, 8, 12, 16, 24, 32, 48, 64 |
| Radius | `sm 6`, `md 10`, `lg 16`, `xl 24`, `full` (cards use `lg`, chips use `full`) |
| Shadow | `sm` (cards), `md` (hover), `lg` (modals and popovers), tuned separately for dark mode |
| Motion | `fast 120ms`, `base 200ms`, `slow 320ms`, easing `cubic-bezier(.2,.8,.2,1)` |

### 13.3 Signature components
- **EventCard**: poster with a blurred placeholder while it loads, a date badge in the corner ("FRI 14"), club avatar and name, title (max 2 lines), time and place row, up to 3 tag chips ("🍕 Free food", "Free"). Animated bookmark heart. On hover, the card lifts slightly and the poster zooms a little. A "Today" or "Deadline in 2 days" ribbon when relevant.
- **Event detail**: opens as a modal on desktop and a bottom sheet on phones, with the poster smoothly expanding from its card (Framer Motion shared layout). Has its own URL so links can be shared. Carousel posters can be swiped.
- **Filter bar**: sticky, with scrollable chips for date presets and categories. On phones, "More filters" opens a bottom sheet. Filters are kept in the URL so a filtered view can be shared.
- **Command palette (⌘K)**: search events, clubs and pages from anywhere, with a "Ask Clubo…" shortcut into chat.
- **Week view**: calendar grid of saved events, colored by category, with a "now" line.
- **Chat**: full-screen on phones, a side panel on desktop. Answers stream in, show inline EventCards and suggested-question chips ("Free food this week?", "Tech events Friday"), plus a typing/thinking indicator.
- **Deadline list**: sorted by urgency with countdown labels ("Closes in 18h"), colored with the semantic tokens.
- **Club page**: banner made from the club's top poster colors, avatar, follow button, stats, upcoming and past events.

### 13.4 Every state is designed
- **Loading**: skeleton cards the same shape as real ones (no spinners in content areas). Posters show their blurred placeholder in the poster's main color.
- **Empty**: friendly illustration and a next step ("No events match. Clear filters" / "Bookmark events to see them here").
- **Error**: inline retry; the page never goes blank.
- **Success**: toasts (`sonner`) for "Saved", "Added to calendar", "Following Cal Hacks".
- **Offline**: installable app (PWA) that still shows the last-loaded feed and saved events offline.

### 13.5 Motion & micro-interactions
- Framer Motion (`motion`) for page and modal transitions, list reordering when filters change, and the bookmark heart pop.
- Animations stay short (≤ 320ms) and are turned off when the device has "reduce motion" on.
- Small delightful touches: an optional confetti burst on a first bookmark, a "happening now" pulse dot on live events, a subtle haptic tap on phones (`navigator.vibrate`).

### 13.6 Accessibility (non-negotiable)
- WCAG 2.2 AA contrast in both themes; visible focus rings; everything usable by keyboard; touch targets at least 44px.
- **The LLM writes alt text for every poster** during extraction, so screen-reader users get the poster's content.
- Proper landmarks and labels (from Radix/shadcn), `aria-live` for streaming chat and toasts.
- Dates are always shown as text ("Fri, Nov 14 · 7–9 PM"), never only as an icon.

### 13.7 Performance feels like UX
- At ingest, generate resized posters (320 / 640 / 1080 px, WebP/AVIF), a **blurhash**, the **main color**, and the image dimensions, so the layout never jumps while images load.
- `next/image`, lazy loading below the fold, server components for the feed, and an infinite-scroll "Load more".
- Targets: LCP < 2.5s on a mid-range phone over 4G, CLS < 0.05, Lighthouse ≥ 95 for performance and accessibility.
- An automatically generated **share image per event** (poster, title, date) so links look great when pasted in iMessage, Discord or Instagram.

### 13.8 Key screens
1. **Landing (logged out)**: big serif headline "What's happening at Berkeley", live count ("143 events this week from 87 clubs"), a strip of trending posters, search bar, sign-up call to action.
2. **Feed**: greeting with today's date, "Happening now / Today / This week / Later" sections, a "From clubs you follow" row, filter bar.
3. **Event detail** (§13.3).
4. **Saved**: switch between list and week view.
5. **Deadlines**.
6. **Clubs directory**: searchable grid of club cards, filterable by category.
7. **Chat**.
8. **Settings**: notification toggles with preview text ("You'll get an email 24h before saved events").
9. **Auth**: split screen (poster collage on one side, form on the other), inline validation, password strength meter.

### 13.9 Admin UX
Admins will spend time here, so it should be fast as well as functional:
- Data tables (TanStack Table + shadcn) with search, sorting, column filters, and bulk actions.
- **Review queue as a split view**: original post and poster on the left, editable extracted fields on the right, with fields the LLM was unsure about highlighted. Keyboard shortcuts: `J/K` next/previous, `A` approve, `R` reject, `E` edit, `M` merge.
- A dashboard home with small charts: posts scraped per day, extraction success rate, review backlog, estimated cost.

### 13.10 How the design is organized in code
```
apps/web/
  styles/tokens.css          design tokens (light + dark)
  components/ui/             shadcn primitives (Button, Dialog, Sheet, Chip…), themed with tokens only
  components/brand/          Logo, wordmark, illustrations, empty-state art
  components/events/         EventCard, EventGrid, EventDetail, DateBadge, TagChip, FilterBar
  components/clubs/          ClubCard, ClubHeader, FollowButton
  components/chat/           ChatPanel, MessageBubble, SuggestedPrompts, InlineEventCard
  components/layout/         AppShell, TopNav, MobileTabBar, CommandPalette, ThemeToggle
  app/(public)/ app/(app)/ app/admin/   route groups keep each area's layout separate
  app/design/                living style guide: every token and component in every state (dev/admin only)
```
**Rules**
- Components never use raw colors or pixel values, only tokens and Tailwind scale classes.
- Each component handles its loading, empty and error states.
- One icon set only (**Lucide**).
- `/design` is the reference; a new component isn't done until it appears there.
- Screenshot tests (Playwright) on the key components in light and dark mode catch visual regressions.

### 13.11 Design workflow
1. **Before any feature code:** build the tokens and `/design` style guide (Phase 0).
2. Build each screen against real scraped data, not lorem ipsum, since messy posters are the actual design challenge.
3. A UI review at the end of every phase: check on a phone at 375px and in dark mode, go through the accessibility checklist, run Lighthouse.
