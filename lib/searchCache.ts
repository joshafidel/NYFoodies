import { Place } from "./types";

/**
 * Module-level cache so Discover keeps its results, filters, and scroll state
 * when the user switches tabs (client-side navigation keeps this alive).
 */
export interface SearchState {
  locationText: string;
  origin: { label: string; lat: number; lon: number } | null;
  radius: number;
  places: Place[];
  view: "list" | "map";
  sort: string;
  showFilters: boolean;
  closedSections: string[];
  meals: string[];
  prices: string[];
  cuisines: string[];
  dietary: string[];
  venues: string[];
  igChecked: Record<string, string | null>;
  searchedOnce: boolean;
}

export const searchCache: { state?: SearchState } = {};
