export type Stage =
  | "to_contact"
  | "contacted"
  | "responded"
  | "accepted"
  | "declined";

export const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: "to_contact", label: "To Contact", hint: "Saved from search — not messaged yet" },
  { id: "contacted", label: "Contacted", hint: "DM sent, waiting to hear back" },
  { id: "responded", label: "Responded", hint: "They replied — negotiating" },
  { id: "accepted", label: "Accepted", hint: "Deal on! Times below" },
  { id: "declined", label: "Declined / Archive", hint: "Passed or went quiet" },
];

/** Stages shown on the main board; declined lives in the archive view. */
export const ACTIVE_STAGES = STAGES.filter((s) => s.id !== "declined");

/**
 * Honest outreach status — opening Instagram is NOT the same as sending.
 * The webhook-based statuses (dm_detected/seen) activate once the official
 * Meta messaging integration is configured; until then flows end at
 * confirmed_manual.
 */
export type ContactStatus =
  | "not_contacted"
  | "waiting_instagram" // pitch copied & Instagram opened, awaiting user confirmation
  | "confirmed_manual" // user explicitly confirmed they sent it
  | "dm_detected" // Meta webhook saw the outgoing DM
  | "seen" // recipient read it (messaging_seen webhook)
  | "responded"
  | "needs_review";

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  not_contacted: "Not contacted",
  waiting_instagram: "Waiting for Instagram",
  confirmed_manual: "Sent (confirmed by you)",
  dm_detected: "DM detected",
  seen: "Seen",
  responded: "Responded",
  needs_review: "Detection needs review",
};

export interface OfferedTime {
  id: string;
  /** e.g. "Tue Jul 22, 7:30pm" — free text so any format they give works */
  when: string;
  note?: string;
}

export interface Deal {
  id: string;
  name: string;
  instagramHandle?: string;
  address?: string;
  lat?: number;
  lon?: number;
  cuisines: string[];
  /** 1 = $, 4 = $$$$ */
  priceLevel?: number;
  website?: string;
  phone?: string;
  stage: Stage;
  notes?: string;
  offeredTimes: OfferedTime[];
  createdAt: number;
  updatedAt: number;
  contactedAt?: number;
  respondedAt?: number;
  acceptedAt?: number;
  /** OSM id so search can show "already in pipeline" */
  sourceId?: string;
  /** contact email when DMs aren't an option */
  email?: string;
  contactStatus?: ContactStatus;
  /** when to nudge them again (ms epoch) */
  followUpAt?: number;
  /** outreach that was copied+opened but not yet confirmed sent */
  pendingOutreach?: { pitchId?: string; message: string; openedAt: number };
}

export interface Place {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: string; // restaurant | bar | cafe | ...
  cuisines: string[];
  venueTypes: string[]; // food | drinks | cafe | dessert
  meals: string[]; // breakfast | lunch | dinner
  dietary: string[]; // vegan | vegan_options | vegetarian | gluten_free | healthy | ...
  priceCategory?: string; // fast_food | cheap | moderate | fine_dining
  priceLevel?: number;
  /** true when the price was estimated from venue/cuisine/name signals */
  priceEstimated?: boolean;
  address?: string;
  website?: string;
  phone?: string;
  instagramHandle?: string;
  distanceMeters?: number;
}

export interface Pitch {
  id: string;
  title: string;
  body: string;
  isDefault?: boolean;
  updatedAt: number;
}

/** Creator profile — feeds the pitch variables. */
export interface CreatorProfile {
  creatorName?: string;
  creatorHandle?: string;
  audienceSize?: string;
  mediaKitUrl?: string;
  deliverables?: string;
  /** default days until follow-up after an outreach is sent */
  followUpDays?: number;
}

export interface Settings {
  template: string;
  defaultLocation?: { label: string; lat: number; lon: number };
  profile?: CreatorProfile;
}

export const DEFAULT_FOLLOW_UP_DAYS = 5;

export const DEFAULT_TEMPLATE = `Hey {name}! 👋 I run a NYC food page and I'd love to feature you. I come in, shoot photos/video of a few dishes, and post a reel + story tagging you. Would you be open to hosting a visit? Happy to share the page and past collabs — just let me know what works!`;
