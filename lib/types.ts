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
  { id: "declined", label: "Declined", hint: "Passed for now" },
];

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

export interface Settings {
  template: string;
  defaultLocation?: { label: string; lat: number; lon: number };
}

export const DEFAULT_TEMPLATE = `Hey {name}! 👋 I run a NYC food page and I'd love to feature you. I come in, shoot photos/video of a few dishes, and post a reel + story tagging you. Would you be open to hosting a visit? Happy to share the page and past collabs — just let me know what works!`;
