# Automatic pipeline movement from your Instagram DMs — full instructions

**The question:** can Instagram integrate with NYFoodies so it automatically
moves places through the pipeline by scanning your DMs and judging their
responses?

**The answer: yes — in two layers.** Layer 1 (detecting sends, replies, and
read receipts and moving stages mechanically) is fully supported by Meta's
official API. Layer 2 (reading what a reply *says* and deciding
Accepted/Declined/Negotiating) needs an AI classification step on top, which
is cheap and straightforward once Layer 1 exists. Neither layer involves
scraping or anything that risks your account — everything rides on Meta's
official webhooks.

What it will feel like when running: you send a DM from the Instagram app
like normal. Seconds later the NYFoodies card moves itself to **Contacted**.
When the restaurant replies "sure! how about Tuesday 7pm?", the card moves to
**Responded** (Layer 2: straight to **Accepted** with "Tuesday 7pm" recorded
as an offered time). You never re-open NYFoodies to do bookkeeping.

---

## What's already built in this repo

- `POST/GET /api/webhooks/meta` — Meta webhook receiver with verify-token
  handshake, signature verification, and an idempotent database event queue.
- `prisma/schema.prisma` — every table needed: connections, conversations,
  messages, pending outreach, webhook events.
- Token encryption (AES-256-GCM), configurable Graph API version, unit tests.
- The client already stamps deals with `contactStatus` values
  (`waiting_instagram`, `dm_detected`, `seen`, `responded`) — the UI is ready
  to display webhook-driven statuses the moment they flow.

What's missing is the plumbing between them (the webhook *processor*) and
the three external things below that only you can provision.

---

## Step 1 — Database (~5 minutes, free)

The sync can't run on localStorage; webhook events arrive while your phone
is in your pocket, so a server-side store is required.

1. Vercel dashboard → your NYFoodies project → **Storage** → **Create
   Database** → *Neon Postgres* (free tier is plenty).
2. Accept the defaults; Vercel injects `DATABASE_URL` into your project
   automatically.
3. Locally: `vercel env pull` (or copy `DATABASE_URL` into `.env.local`),
   then run `npx prisma migrate dev --name init` once, and
   `npx prisma migrate deploy` becomes part of deploys.

## Step 2 — Meta app with messaging permissions (~30 minutes, free)

Follow `docs/instagram-meta-setup.md` in this repo for the click-by-click
version. Summary:

1. Your Instagram must be a **Professional** account (free switch in the IG
   app).
2. Create an app at developers.facebook.com → add the **Instagram** product
   → "API setup with Instagram business login".
3. Register the OAuth redirect (`https://ny-foodies.vercel.app/api/instagram/callback`).
4. Configure the webhook: callback
   `https://ny-foodies.vercel.app/api/webhooks/meta`, a verify token you
   invent, and subscribe to **messages**, **messaging_seen**, and
   **message_reactions**.
5. Set the env vars in Vercel (`META_APP_ID`, `META_APP_SECRET`,
   `META_WEBHOOK_VERIFY_TOKEN`, `META_GRAPH_API_VERSION`,
   `TOKEN_ENCRYPTION_KEY` — generate with `openssl rand -hex 32`).
6. Add your own Instagram account as a **tester** (App roles → Instagram
   testers, then accept the invite inside the Instagram app). Add a second
   throwaway professional account to play the "restaurant" during testing.

## Step 3 — Meta App Review (the only real gate)

- While your Meta app is in **Development mode**, everything works — but
  only for accounts registered as testers. Since the DMs being scanned are
  *your own*, tester mode is actually sufficient for personal use
  indefinitely.
- To use it with any non-tester account (or to be safe long-term), request
  **Advanced Access** for `instagram_business_basic` and
  `instagram_business_manage_messages`. Meta requires a screencast showing
  the flow and typically business verification. Allow 1–3 weeks.

## Step 4 — The code I'll build once Steps 1–2 are done

(These are the pieces that turn stored webhook events into pipeline moves.)

1. **Webhook processor** — drains the `WebhookEvent` queue: saves messages,
   threads them into conversations, dedupes retries.
2. **Outgoing-DM matcher** — when your account sends a message (Meta "echo"
   events), match it to the deal you last opened Instagram for
   (recipient + time window + message similarity) and move **To Contact →
   Contacted** with `dm_detected` status. Ambiguous matches go to a review
   list, never guessed.
3. **Reply handler** — inbound message from a matched conversation moves the
   deal to **Responded**, stores the message preview on the card, cancels
   the follow-up reminder.
4. **Seen receipts** — `messaging_seen` events mark your DM as "Seen" with a
   timestamp (displayed, but never treated as a response).
5. **AI response judge (Layer 2)** — each inbound reply is classified by a
   small Claude API call (Haiku-class model, ~a tenth of a cent per reply):
   `accepted | declined | negotiating | question | other`, plus extraction
   of any offered visit times ("Tuesday 7pm") straight into the card's
   offered-times list. Config: `ANTHROPIC_API_KEY` env var. Default
   behavior: the app *suggests* the stage move with a one-tap confirm;
   a setting can make Accepted/Declined moves fully automatic once you
   trust it.
6. **Conversation view + unmatched inbox** — recent messages on each card,
   plus a review screen for conversations the matcher couldn't attribute.

## Hard limits to know up front (Meta's rules, not mine)

- **The app can never send DMs for you.** Instagram's API only allows
  replying to users who message your business first — cold outreach must
  stay manual (the current copy-and-open flow). Automating sends via
  unofficial means gets accounts banned.
- Webhooks only cover activity **after** connection; older history is
  limited by Meta's Conversations API retention.
- Only DMs to/from *your connected professional account* are visible —
  exactly what's needed here, nothing more.

## Cost summary

| Piece | Cost |
|---|---|
| Neon Postgres (Vercel free tier) | $0 |
| Meta app, webhooks, permissions | $0 |
| Claude API for reply judging | ~$0.001/reply — pocket change |
| App Review | $0 (time only) |

**To kick this off:** do Steps 1 and 2, then say the word — the processor,
matcher, and AI judge get built on the foundation that's already merged.
