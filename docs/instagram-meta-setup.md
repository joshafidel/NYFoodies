# Instagram / Meta setup for NYFoodies DM sync

This document covers everything you must configure in the Meta developer
dashboard to enable (a) basic profile display and (b) the DM-detection /
conversation-sync system. **No secrets belong in this file or in git.**

## What each tier needs

| Feature | Needs |
|---|---|
| Profile & posts on the Profile tab | Free Meta app, `instagram_business_basic`, works in Development mode for your own account |
| DM detection, replies, seen receipts, conversation sync | All of the above **plus** `instagram_business_manage_messages`, webhooks, a Postgres database, and **Meta App Review (Advanced Access)** for any account that isn't a registered tester |

> **Honest limitation:** Instagram's Send API cannot initiate cold DMs — a
> business can only be messaged via the API after *they* message you first.
> That's why NYFoodies keeps the copy-and-open flow for the first message and
> uses webhooks only to *detect* what you sent manually.

## 1. Create and configure the Meta app

1. Go to <https://developers.facebook.com/apps/> → **Create App**.
2. Use case: **Other** → type **Business**.
3. In the app dashboard, **Add product → Instagram**, then choose
   **"API setup with Instagram business login"** (this is the *Instagram API
   with Instagram Login* — no Facebook Page required).
4. Note the **Instagram App ID** and **Instagram App Secret** (Instagram →
   API setup → they are distinct from the Meta app id/secret shown at the top
   of the dashboard; use the Instagram ones for `INSTAGRAM_APP_ID/SECRET`).

## 2. OAuth redirect URIs

Under **Instagram → API setup with Instagram login → Business login settings**,
add every environment you use:

- `http://localhost:3000/api/instagram/callback` (local dev)
- `https://<preview-deployment>.vercel.app/api/instagram/callback` (optional)
- `https://ny-foodies.vercel.app/api/instagram/callback` (production)

Set `META_REDIRECT_URI` / `NEXT_PUBLIC_BASE_URL` to match the environment.

## 3. Webhooks

1. In the app dashboard: **Instagram → API setup → Configure webhooks** (or
   Products → Webhooks → Instagram).
2. Callback URL: `https://ny-foodies.vercel.app/api/webhooks/meta`
3. Verify token: any random string — put the same value in
   `META_WEBHOOK_VERIFY_TOKEN`. Meta will call `GET /api/webhooks/meta` with a
   challenge; the app echoes it back when the token matches.
4. Subscribe to these fields (names as of the current docs — confirm in the
   dashboard UI, Meta occasionally renames them):
   - `messages` (includes message echoes of *your own outgoing* DMs)
   - `messaging_seen` (read receipts)
   - `message_reactions`
   - optionally `messaging_postbacks`, `message_edits`, `messaging_referral`
5. Webhook deliveries are signed with `X-Hub-Signature-256` using the **app
   secret** — the endpoint verifies this and rejects everything else.

**Vercel note:** webhooks require the production deployment to be reachable —
they cannot hit `localhost`. For local webhook testing, use the Meta
dashboard's "Test" button against a tunnel (e.g. `vercel dev` + a tunnel
service) or rely on the development-only simulator (see below).

## 4. Permissions

Request during login (`scope` parameter):

- `instagram_business_basic` — profile + media. Justification for review:
  "Display the creator's own account info so they can verify the correct
  account is connected."
- `instagram_business_manage_messages` — read/manage DMs + webhooks.
  Justification: "Detect when the creator has manually sent a collaboration
  DM and when a restaurant replies, to update the creator's own outreach
  pipeline. The app never sends messages automatically."

## 5. Test users / Development mode

While the app is in **Development mode**:

- Only accounts listed under **App roles → Roles → Instagram testers** (and
  accepted from the Instagram app: Settings → Website permissions → Apps and
  websites → Tester invites) can authenticate.
- All permissions behave as granted for testers — this is how you test the
  full DM flow before App Review.
- Add your own professional account + a second test account to play the
  "restaurant" side of conversations.

## 6. App Review (Advanced Access)

Required before any non-tester account can use messaging features.

- Request **Advanced Access** for both permissions above.
- Provide a **screencast** demonstrating, in one take:
  1. Logging into NYFoodies and connecting Instagram via OAuth.
  2. Preparing a DM in NYFoodies (pitch preview → copy → open Instagram).
  3. Sending the DM manually inside Instagram.
  4. Returning to NYFoodies and showing the deal auto-move to "Contacted"
     when the webhook detects the outgoing message.
  5. The restaurant test account replying, and the deal moving to
     "Responded" with the message visible.
  6. The disconnect + delete-data flow in Profile.
- Business verification of your Meta Business account is typically required
  for Advanced Access.
- Also fill in the **Data deletion callback** or instructions URL (the app's
  delete-data flow satisfies this).

## 7. Environment variables

See `.env.example`. Summary:

| Variable | Purpose |
|---|---|
| `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | OAuth login (profile display) |
| `META_APP_ID` / `META_APP_SECRET` | Messaging integration + webhook signature verification |
| `META_REDIRECT_URI` | OAuth callback for the environment |
| `META_WEBHOOK_VERIFY_TOKEN` | Webhook GET handshake |
| `META_GRAPH_API_VERSION` | e.g. `v23.0` — bump here, not in code |
| `TOKEN_ENCRYPTION_KEY` | 32-byte hex (`openssl rand -hex 32`) for AES-256-GCM token encryption |
| `DATABASE_URL` | Postgres (Vercel Postgres / Neon / Supabase all work) |
| `NEXT_PUBLIC_APP_URL` | Canonical app URL |

After setting `DATABASE_URL`, run migrations: `npx prisma migrate deploy`
(or `npx prisma migrate dev --name init` the first time locally).

## 8. Switching development → production safely

1. Complete App Review for both permissions.
2. Flip the app to **Live** mode.
3. Confirm the production webhook subscription is verified and enabled.
4. Rotate any secrets that were ever pasted into test tools.
5. Re-connect Instagram from the production site (tokens issued in dev mode
   don't carry over cleanly to Live mode in all cases).

## 9. Common errors

| Symptom | Likely cause |
|---|---|
| OAuth error "redirect_uri does not match" | URI not registered exactly (scheme/trailing slash) |
| Webhook GET returns 403 | `META_WEBHOOK_VERIFY_TOKEN` mismatch |
| Webhook POST 401 in logs | Signature check failed — wrong `META_APP_SECRET` (use the *app* secret, not the Instagram app secret, for the app that owns the webhook subscription) |
| Events received but nothing happens | `DATABASE_URL` unset (events are acknowledged but dropped — check logs) |
| "(#10) Application does not have permission" | Missing `instagram_business_manage_messages` or App Review not granted |
| Token suddenly invalid | ~60-day long-lived token expired, or the user changed their password / revoked the app — reconnect from Profile |
| No `message_echoes` for your own sends | Echo events arrive under the `messages` field for Instagram messaging — ensure `messages` is subscribed |
| Conversation history incomplete | The Conversations API only returns recent history (per Meta retention limits) — older context stays in the Instagram app |

## 10. What the code ships today vs. what needs configuration

Already in the repo:

- `POST/GET /api/webhooks/meta` with verify-token handshake, HMAC signature
  verification, redacted DB-backed event queue, and idempotent dedupe keys.
- Prisma schema for users, connections, restaurants, deals, conversations,
  messages, pending outreach, and webhook events.
- AES-256-GCM token encryption utilities + tests.
- The client-side outreach flow that creates the honest
  pending → confirmed states the webhook processor will later upgrade to
  `dm_detected` / `seen` / `responded`.

Still requires your action before the sync goes live:

1. Provision Postgres and set `DATABASE_URL`; run migrations.
2. Create the Meta app, set all env vars, configure the webhook.
3. Add tester accounts and verify end-to-end in Development mode.
4. Submit App Review for Advanced Access.
