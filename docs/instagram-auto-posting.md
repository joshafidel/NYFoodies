# Automatic Instagram posting — setup instructions

Instagram's official **Content Publishing API** allows an app to publish
feed photos, carousels, Reels, and Stories on behalf of a connected
**Professional** account. Unlike DMs (where cold sends are forbidden),
posting is fully supported — this can be genuinely automatic, with no
account risk, using only official Meta APIs.

This doc covers the steps **you** complete (Parts 1–4, roughly 45 minutes of
clicking, all free) and what gets built in the app afterward (Part 5).

---

## Choose your tier first

| Tier | What it does | Extra setup needed |
|---|---|---|
| **A. Post now** | Compose in NYFoodies, publish immediately | Parts 1–3 only |
| **B. Scheduled posting** | Queue posts; the app publishes them later even with your phone in your pocket | Parts 1–4 (adds database + cron) |

Tier B is a superset — if you plan to schedule, do all four parts at once.

---

## Part 1 — Instagram account (2 min)

1. Your account must be a **Professional** account (Creator or Business —
   either works, free).
2. Instagram app → **Settings → Account type and tools → Switch to
   professional account** (skip if already done for the profile-display
   feature).

## Part 2 — Meta developer app (~20 min)

If you already created the Meta app for profile display or DM sync, reuse
it — just add the extra permission in step 6 and skip to Part 3.

1. Go to <https://developers.facebook.com/apps/> and log in with the
   Facebook account you control (create one if needed — required for the
   developer dashboard, not for posting).
2. **Create App** → use case **Other** → type **Business** → name it
   (e.g. "NYFoodies").
3. On the app dashboard: **Add product → Instagram** → choose **"API setup
   with Instagram business login"**.
4. Copy the **Instagram App ID** and **Instagram App Secret** shown there
   (note: these are different from the Meta app id/secret at the top of the
   dashboard — use the Instagram ones).
5. Under **Business login settings**, add both redirect URIs exactly:
   - `https://ny-foodies.vercel.app/api/instagram/callback`
   - `http://localhost:3000/api/instagram/callback`
6. Permissions: the login flow will request
   - `instagram_business_basic` (account identity)
   - `instagram_business_content_publish` (posting)
   Nothing to click here yet — the app requests these at connect time —
   but they must not be removed if the dashboard asks you to configure
   scopes.
7. **Add yourself as a tester** (this is what makes it work without Meta's
   review): App dashboard → **App roles → Roles → Add people → Instagram
   Tester** → enter your IG username. Then in the Instagram app:
   **Settings → Website permissions → Apps and websites → Tester invites →
   Accept**.

> **Why tester mode is enough:** while the Meta app is in Development mode,
> all permissions work fully — but only for accounts registered as testers.
> Since the only account posting is yours, you can run this way
> indefinitely. Meta App Review (Advanced Access) is only needed if other
> people's accounts will ever connect.

## Part 3 — Vercel configuration (~10 min)

1. **Media storage** — the publishing API fetches media from a public URL,
   so uploads need somewhere to live:
   Vercel dashboard → your NYFoodies project → **Storage → Create Database
   → Blob** → accept defaults. Vercel injects `BLOB_READ_WRITE_TOKEN`
   automatically.
2. **Environment variables** — project → **Settings → Environment
   Variables**, add (to Production):

   | Name | Value |
   |---|---|
   | `INSTAGRAM_APP_ID` | from Part 2 step 4 |
   | `INSTAGRAM_APP_SECRET` | from Part 2 step 4 |
   | `NEXT_PUBLIC_BASE_URL` | `https://ny-foodies.vercel.app` |

3. **Redeploy** (Deployments → ⋯ → Redeploy) so the env vars take effect.

## Part 4 — Only for scheduled posting (Tier B, ~10 min)

Scheduling needs the access token and the post queue stored server-side:

1. **Database:** Vercel → Storage → **Create Database → Neon (Postgres)**,
   accept defaults → `DATABASE_URL` is injected. The repo's Prisma schema
   already exists; migrations run on the next deploy once I wire them in.
2. **Token encryption key:** run `openssl rand -hex 32` (any terminal, or
   an online hex generator) and add it as env var `TOKEN_ENCRYPTION_KEY`.
3. Cron: nothing for you to do — a `vercel.json` cron entry ships with the
   feature and Vercel picks it up automatically (Hobby plan allows daily
   crons; for minute-level scheduling precision Vercel Pro is needed, or
   posts publish at the next daily tick — I'll flag the exact trade-off
   when building).

## Part 5 — What gets built in the app (my side)

Once you say Parts 1–3 (and 4 if scheduling) are done:

1. **Connect flow update** — the existing "Connect Instagram" in Profile
   requests `instagram_business_content_publish` in addition to basic, and
   (Tier B) stores the encrypted token server-side instead of only a
   cookie.
2. **Posts tab** — compose screen:
   - upload photos/video (stored in Vercel Blob),
   - caption editor with your pitch-style variables and hashtag helper,
   - auto-tag the restaurant's @handle pulled from the pipeline card,
   - choose type: feed photo / carousel / Reel / Story,
   - **Post now**, or (Tier B) **Schedule** with date & time.
3. **Publishing engine** — the two-step Meta flow (create media container →
   poll until processed → publish), with per-type validation before upload:
   - Feed images: JPEG, ≤ 8 MB, aspect ratio between 4:5 and 1.91:1
   - Carousels: 2–10 items
   - Reels: MP4/MOV, 3s–15min, 9:16 recommended
   - Caption: ≤ 2,200 chars, ≤ 30 hashtags
   - API cap: 100 published posts per rolling 24h (far above your needs)
4. **Pipeline tie-in** — publishing a post about a place stamps its card
   (e.g. Accepted → "Posted" note with the post link), closing the loop on
   a collab.
5. **Status & errors** — post history with published/failed states and
   plain-language error messages (token expired → "Reconnect Instagram in
   Profile", bad aspect ratio → told before upload, etc.).

## What the API cannot do (so nothing surprises you)

- **Collab posts**, interactive story stickers (polls, questions, music),
  and Instagram's trending-audio picker are not available via API — those
  still happen in the Instagram app.
- Posts **cannot be edited or deleted** via the API after publishing — use
  the Instagram app for that.
- Media must be finished files; no filters/editing at publish time.
- The token lasts ~60 days — the app will warn you in Profile when a
  reconnect is due.

## Checklist to hand back

Reply with these and the build starts:

- [ ] Professional account confirmed
- [ ] Meta app created, Instagram App ID + Secret set in Vercel env vars
- [ ] Redirect URIs added
- [ ] Tester invite accepted in the Instagram app
- [ ] Vercel Blob store created
- [ ] (Tier B) Neon Postgres created + `TOKEN_ENCRYPTION_KEY` set
- [ ] Which tier: **A (post now)** or **B (scheduling too)**
