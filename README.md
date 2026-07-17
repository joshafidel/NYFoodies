# 🍕 NYFoodies

A free personal outreach app for your food Instagram. Find restaurants & bars
anywhere, pitch them over Instagram DM in one tap, and track every collab
through a HubSpot-style pipeline — from first message to booked visit.

## What it does

- **Search** — type any neighborhood/address/zip (or use your current location)
  and find restaurants, bars, cafes and dessert spots nearby. Powered by free
  OpenStreetMap data, no API key needed.
- **Filter & sort** — filter by cuisine (Greek, Italian, drinks, healthy,
  dessert, … places can carry multiple tags), sort by distance or by price
  (high → low or low → high).
- **DM in one tap** — every place has a DM button that copies your pitch
  template (editable in Settings) and opens their Instagram DM thread. You
  paste + send. *(Instagram bans apps that auto-send cold DMs, so this
  copy-and-open flow is the safe, ToS-friendly way.)*
- **Pipeline** — a drag-and-drop board: **To Contact → Contacted → Responded →
  Accepted** (plus Declined). Cards track notes, price level, Instagram
  handle, and the **visit times each place offered** once they respond.
- **Instagram connect (optional)** — link your Instagram professional account
  to show your live follower count and recent posts on the dashboard.

## Is it free?

Yes, entirely:

| Piece | Cost |
|---|---|
| Place search & geocoding (OpenStreetMap Nominatim + Overpass) | Free, no key |
| Instagram profile/media (official Instagram API, your own account) | Free |
| Storage (your browser's localStorage) | Free |
| Hosting | Free tiers of Vercel/Netlify, or run locally |

The one thing that **cannot** be automated for free (or at all, safely) is
sending DMs programmatically — Instagram's API only allows replying to people
who message you first. The one-tap copy-and-open flow here is the practical
workaround.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. Search, pipeline, and DM buttons all work
immediately — no configuration needed.

### Optional: connect Instagram (free, ~5 minutes)

1. Make sure your Instagram account is a **Professional** account (Creator or
   Business) — free switch in Instagram → Settings → Account type.
2. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps/),
   create an app, and add the **Instagram** product → *API setup with
   Instagram business login*.
3. Add `http://localhost:3000/api/instagram/callback` as an OAuth redirect URI
   (add your production URL too once deployed).
4. `cp .env.example .env.local`, fill in `INSTAGRAM_APP_ID` and
   `INSTAGRAM_APP_SECRET`, restart the dev server.
5. Hit **Connect Instagram** on the dashboard.

While the Meta app is in Development mode it only works for accounts you add
as testers — fine for a personal tool. Tokens are long-lived (~60 days); just
reconnect when it expires.

## Notes on data

- Place data comes from OpenStreetMap. Coverage of NYC venues is very good,
  but **price levels are often missing** — you can set `$`–`$$$$` on any card
  in the pipeline, and sorting puts unknown-price places last.
- Some venues have their Instagram handle tagged in OSM (shown automatically);
  for the rest, add the handle on the card once and it's saved.
- Everything you track lives in your browser's localStorage: private, free,
  no account. Use the Settings page to erase it.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · localStorage — no database,
no paid services.
