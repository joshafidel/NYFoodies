import { labelForTag } from "./cuisines";
import { CreatorProfile, Deal, Pitch } from "./types";

/**
 * Pitch variables. {name} and {restaurant} are synonyms (back-compat).
 * Unknown creator fields render as sensible neutral fallbacks rather than
 * leaving raw braces in an outgoing message.
 */
export const PITCH_VARIABLES: { token: string; label: string }[] = [
  { token: "{restaurant}", label: "Restaurant name" },
  { token: "{cuisine}", label: "Cuisine" },
  { token: "{neighborhood}", label: "Neighborhood" },
  { token: "{creator_name}", label: "Your name" },
  { token: "{creator_handle}", label: "Your @handle" },
  { token: "{audience_size}", label: "Audience size" },
  { token: "{media_kit}", label: "Media-kit link" },
  { token: "{deliverables}", label: "Proposed deliverables" },
];

function neighborhoodFrom(deal: Partial<Deal>): string {
  const addr = deal.address ?? "";
  const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : "the neighborhood";
}

export function renderPitch(
  body: string,
  deal: Partial<Deal>,
  profile: CreatorProfile | undefined
): string {
  const cuisine =
    (deal.cuisines ?? [])
      .slice(0, 2)
      .map((c) => labelForTag(c).toLowerCase())
      .join(" & ") || "food";
  const p = profile ?? {};
  return body
    .replaceAll("{restaurant}", deal.name ?? "")
    .replaceAll("{name}", deal.name ?? "")
    .replaceAll("{cuisine}", cuisine)
    .replaceAll("{neighborhood}", neighborhoodFrom(deal))
    .replaceAll("{creator_name}", p.creatorName || "me")
    .replaceAll("{creator_handle}", p.creatorHandle ? `@${p.creatorHandle.replace(/^@/, "")}` : "my page")
    .replaceAll("{audience_size}", p.audienceSize || "a growing NYC audience")
    .replaceAll("{media_kit}", p.mediaKitUrl || "(media kit available on request)")
    .replaceAll("{deliverables}", p.deliverables || "a reel + story tagging you");
}

/** Normalized form used to compare a copied pitch to a detected DM later. */
export function normalizeMessage(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pull a handle out of "@handle", "handle", or a pasted instagram URL. */
export function parseHandle(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//.test(t) && !/instagram\.com\//.test(t)) return null;
  const m = t.match(/instagram\.com\/([A-Za-z0-9._]+)/);
  const handle = (m ? m[1] : t.replace(/^@/, "")).replace(/[/?].*$/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? handle : null;
}

export const STARTER_TEMPLATES: Omit<Pitch, "id" | "updatedAt">[] = [
  {
    title: "Gifted meal request",
    isDefault: true,
    body: `Hey {restaurant}! 👋 I'm {creator_name} ({creator_handle}) — I make NYC food content for {audience_size}. I'd love to feature your {cuisine} spot: I come in, shoot a few dishes, and post {deliverables}. Would you be open to hosting a visit? Media kit: {media_kit}`,
  },
  {
    title: "Paid partnership",
    body: `Hi {restaurant} team! I'm {creator_name} ({creator_handle}), a NYC food creator with {audience_size}. I'm booking paid partnerships this month — for {restaurant} I'd suggest {deliverables}, with usage rights included. Rates and past results are in my media kit: {media_kit}. Open to a quick chat?`,
  },
  {
    title: "New restaurant opening",
    body: `Congrats on the opening, {restaurant}! 🎉 I'm {creator_name} ({creator_handle}) and I cover new spots in {neighborhood} for {audience_size}. Opening-week content performs great — I'd love to come by and shoot {deliverables} to help spread the word. Interested?`,
  },
  {
    title: "Event invitation",
    body: `Hey {restaurant}! I'm {creator_name} ({creator_handle}). I'm hosting a foodie event and I think your {cuisine} spot would be a perfect fit — either as the venue or a featured partner. Can I share the details? My page: {media_kit}`,
  },
  {
    title: "Follow-up",
    body: `Hey {restaurant}! Just floating this back up 😊 I reached out about featuring you on {creator_handle} — I'd still love to make it happen. Any interest? Happy to work around whatever's easiest for you.`,
  },
  {
    title: "Email outreach",
    body: `Hi {restaurant} team,\n\nMy name is {creator_name} and I create NYC food content as {creator_handle} for {audience_size}. I'd love to feature {restaurant} — my standard collab is {deliverables}, and I'm flexible on timing.\n\nMedia kit: {media_kit}\n\nWould you be open to it? Happy to answer any questions.\n\nBest,\n{creator_name}`,
  },
  {
    title: "Declining an offer",
    body: `Thanks so much for the offer, {restaurant} — I really appreciate you thinking of me! It's not the right fit for my page right now, but I'd love to stay in touch for future collabs. Wishing you a packed house! 🙌`,
  },
];
