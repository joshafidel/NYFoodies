"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ALL_CUISINE_TAGS,
  DIETARY_LABELS,
  MEAL_LABELS,
  PRICE_CATEGORY_LABELS,
  VENUE_LABELS,
  emojiForPlace,
  labelForTag,
} from "@/lib/cuisines";
import { formatDistance, priceLabel } from "@/lib/geo";
import { DAY_NAMES, parseOpeningHours, todayHours } from "@/lib/hours";
import { searchCache } from "@/lib/searchCache";
import { useDeals, useSettings } from "@/lib/store";
import { Place } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted">
      Loading map…
    </div>
  ),
});

type SortMode = "distance" | "price_desc" | "price_asc" | "name";

interface GeoResult {
  label: string;
  lat: number;
  lon: number;
}

/** Fallback when no starting location is given — heart of NYC. */
const DEFAULT_NYC: GeoResult = { label: "New York City", lat: 40.7431, lon: -73.9712 };

/** Slider steps are 400m ≈ ¼ mile, so label in clean quarter-mile increments. */
function radiusLabel(m: number): string {
  return `${Number((m / 1600).toFixed(2))} mi`;
}

const VENUE_OPTIONS = ["food", "drinks", "food_and_drinks", "dessert", "cafe"];
const MEAL_OPTIONS = ["breakfast", "lunch", "dinner"];
const PRICE_OPTIONS = ["fast_food", "cheap", "moderate", "fine_dining", "luxury"];
const DIETARY_OPTIONS = ["healthy", "gluten_free", "vegan", "vegetarian"];

// ── Tiny inline icons (no emoji) ─────────────────────────────────────────
const ic = "inline-block h-3.5 w-3.5 shrink-0";
const PinIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={ic}>
    <path d="M12 21s-7-6.1-7-11a7 7 0 1114 0c0 4.9-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);
const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={ic}>
    <path d="M3 11l9-8 9 8" />
    <path d="M5 10v10h14V10" />
  </svg>
);
const WorkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={ic}>
    <rect x="3" y="8" width="18" height="12" rx="2" />
    <path d="M9 8V6a2 2 0 012-2h2a2 2 0 012 2v2" />
  </svg>
);
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={ic}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" strokeLinecap="round" />
  </svg>
);

export default function DiscoverPage() {
  const { deals, addDeal, updateDeal } = useDeals();
  const { settings, update, loaded: settingsLoaded } = useSettings();

  const c = searchCache.state;
  const [locationText, setLocationText] = useState(c?.locationText ?? "");
  const [origin, setOrigin] = useState<GeoResult | null>(c?.origin ?? null);
  const [radius, setRadius] = useState(c?.radius ?? 1600);
  const [places, setPlaces] = useState<Place[]>(c?.places ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"list" | "map">(c?.view ?? "list");
  const [sort, setSort] = useState<SortMode>((c?.sort as SortMode) ?? "distance");
  const [showFilters, setShowFilters] = useState(c?.showFilters ?? true);
  const [cuisineQuery, setCuisineQuery] = useState("");
  const [addedFlash, setAddedFlash] = useState<string | null>(null);
  const [settingSlot, setSettingSlot] = useState<"home" | "work" | null>(null);
  const [slotText, setSlotText] = useState("");
  const [closedSections, setClosedSections] = useState<Set<string>>(
    new Set(c?.closedSections ?? [])
  );
  const [igChecked, setIgChecked] = useState<Record<string, string | null>>(
    c?.igChecked ?? {}
  );
  const [igLoading, setIgLoading] = useState<string | null>(null);
  const [hoursOpen, setHoursOpen] = useState<string | null>(null);
  const searchedOnce = useRef(c?.searchedOnce ?? false);
  const radiusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // filter state — OR within a category, AND across categories
  const [meals, setMeals] = useState<Set<string>>(new Set(c?.meals ?? []));
  const [prices, setPrices] = useState<Set<string>>(new Set(c?.prices ?? []));
  const [cuisines, setCuisines] = useState<Set<string>>(new Set(c?.cuisines ?? []));
  const [dietary, setDietary] = useState<Set<string>>(new Set(c?.dietary ?? []));
  const [venues, setVenues] = useState<Set<string>>(new Set(c?.venues ?? []));

  // persist everything so switching tabs never loses the screen
  useEffect(() => {
    searchCache.state = {
      locationText,
      origin,
      radius,
      places,
      view,
      sort,
      showFilters,
      closedSections: [...closedSections],
      meals: [...meals],
      prices: [...prices],
      cuisines: [...cuisines],
      dietary: [...dietary],
      venues: [...venues],
      igChecked,
      searchedOnce: searchedOnce.current,
    };
  }, [locationText, origin, radius, places, view, sort, showFilters, closedSections, meals, prices, cuisines, dietary, venues, igChecked]);

  useEffect(() => {
    if (settingsLoaded && settings.defaultLocation && !origin && !searchedOnce.current) {
      setOrigin(settings.defaultLocation);
      setLocationText(settings.defaultLocation.label);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded]);

  const dealsBySource = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of deals) if (d.sourceId) map.set(d.sourceId, d.id);
    return map;
  }, [deals]);

  function toggleSection(id: string) {
    setClosedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function geocode() {
    // no location typed? no problem — search all of NYC
    if (!locationText.trim()) {
      setLocationText(DEFAULT_NYC.label);
      chooseOrigin(DEFAULT_NYC);
      return;
    }
    setError("");
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(locationText)}`);
    const json = await res.json();
    if (!json.results?.length) {
      setError("Couldn't find that spot — try adding a borough or zip, or leave it empty to search all of NYC.");
      return;
    }
    // no "did you mean" — take the best (NYC-biased) match and show its address
    const best = json.results[0] as GeoResult;
    setLocationText(best.label);
    chooseOrigin(best);
  }

  function chooseOrigin(g: GeoResult) {
    setOrigin(g);
    update({ defaultLocation: g });
    void runSearch(g, radius);
  }

  function useMyLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError("Your browser doesn't support geolocation — type a location instead.");
      return;
    }
    setLoading(true);

    // Watch GPS for up to 6s and keep the most accurate fix instead of
    // trusting the first coarse (cell-tower/wifi) guess.
    let best: GeolocationPosition | null = null;
    let settled = false;

    const finish = async () => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      if (!best) {
        setLoading(false);
        setError("Couldn't get your location — you can just type a neighborhood instead.");
        return;
      }
      const { latitude, longitude, accuracy } = best.coords;
      if (
        (Math.abs(latitude) < 0.5 && Math.abs(longitude) < 0.5) ||
        (accuracy != null && accuracy > 25000)
      ) {
        setLoading(false);
        setError("Your device gave a bad location fix — try again outdoors, or type a neighborhood.");
        return;
      }
      // show the user the REAL address the fix resolves to
      let label = "My location";
      try {
        const res = await fetch(`/api/geocode?lat=${latitude}&lon=${longitude}`);
        const json = await res.json();
        if (json.address) label = json.address;
      } catch {
        // keep generic label
      }
      const g = { label, lat: latitude, lon: longitude };
      setLocationText(label);
      setOrigin(g);
      void runSearch(g, radius);
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
        if (pos.coords.accuracy <= 50) void finish();
      },
      () => void finish(),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
    setTimeout(() => void finish(), 6000);
  }

  async function geocodeSlot(slot: "home" | "work") {
    if (!slotText.trim()) return;
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(slotText)}`);
    const json = await res.json();
    if (!json.results?.length) {
      setError("Couldn't find that address — try adding a zip.");
      return;
    }
    const g = json.results[0] as GeoResult;
    update({ [slot]: g });
    setSettingSlot(null);
    setSlotText("");
    setLocationText(g.label);
    chooseOrigin(g);
  }

  async function runSearch(g: GeoResult, r: number) {
    searchedOnce.current = true;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/places?lat=${g.lat}&lon=${g.lon}&radius=${r}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Search failed");
      setPlaces(json.places ?? []);
      if (!json.places?.length) setError("No places found here — try a bigger radius.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed — try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  /** OR within a category, AND across categories. */
  const matches = useCallback(
    (p: Place): boolean => {
      if (meals.size > 0 && !p.meals.some((m) => meals.has(m))) return false;
      if (prices.size > 0 && !(p.priceCategory && prices.has(p.priceCategory))) return false;
      if (cuisines.size > 0 && !p.cuisines.some((cz) => cuisines.has(cz))) return false;
      if (dietary.size > 0) {
        const ok = [...dietary].some(
          (d) => p.dietary.includes(d) || p.dietary.includes(`${d}_options`)
        );
        if (!ok) return false;
      }
      if (venues.size > 0) {
        const ok = [...venues].some((v) =>
          v === "food_and_drinks"
            ? p.venueTypes.includes("food") && p.venueTypes.includes("drinks")
            : p.venueTypes.includes(v)
        );
        if (!ok) return false;
      }
      return true;
    },
    [meals, prices, cuisines, dietary, venues]
  );

  const filtered = useMemo(() => {
    const out = places.filter(matches);
    const byDistance = (a: Place, b: Place) =>
      (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity);
    switch (sort) {
      case "distance":
        return [...out].sort(byDistance);
      case "price_desc":
        return [...out].sort(
          (a, b) => (b.priceLevel ?? 0) - (a.priceLevel ?? 0) || byDistance(a, b)
        );
      case "price_asc":
        return [...out].sort(
          (a, b) => (a.priceLevel ?? 5) - (b.priceLevel ?? 5) || byDistance(a, b)
        );
      case "name":
        return [...out].sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [places, matches, sort]);

  const activeFilterCount =
    meals.size + prices.size + cuisines.size + dietary.size + venues.size;

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, value: string) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  function clearFilters() {
    setMeals(new Set());
    setPrices(new Set());
    setCuisines(new Set());
    setDietary(new Set());
    setVenues(new Set());
  }

  function dealFieldsFrom(p: Place, handle?: string) {
    return {
      name: p.name,
      instagramHandle: handle ?? p.instagramHandle,
      address: p.address,
      lat: p.lat,
      lon: p.lon,
      cuisines: p.cuisines,
      priceLevel: p.priceLevel,
      website: p.website,
      phone: p.phone,
      openingHours: p.openingHours,
      sourceId: p.id,
    };
  }

  function enrichDeal(dealId: string, p: Place) {
    if (!p.website) return;
    fetch(`/api/enrich?url=${encodeURIComponent(p.website)}`)
      .then((r) => r.json())
      .then((j: { instagramHandle?: string | null; imageUrl?: string | null }) => {
        const patch: { instagramHandle?: string; imageUrl?: string } = {};
        if (!p.instagramHandle && j.instagramHandle) patch.instagramHandle = j.instagramHandle;
        if (j.imageUrl) patch.imageUrl = j.imageUrl;
        if (Object.keys(patch).length > 0) updateDeal(dealId, patch);
      })
      .catch(() => {});
  }

  function addToPipeline(p: Place) {
    const created = addDeal(dealFieldsFrom(p));
    enrichDeal(created.id, p);
    setAddedFlash(p.id);
    setTimeout(() => setAddedFlash(null), 1500);
  }

  /**
   * Instagram button on Discover: resolve the handle (from map data or the
   * restaurant's own website), open their page immediately, add them to the
   * pipeline, and set the "did you send the DM?" prompt.
   */
  async function openInstagram(p: Place) {
    let handle = p.instagramHandle ?? igChecked[p.id] ?? undefined;
    if (handle === null) return;
    if (!handle && p.website) {
      setIgLoading(p.id);
      try {
        const res = await fetch(`/api/enrich?url=${encodeURIComponent(p.website)}`);
        const j = await res.json();
        handle = j.instagramHandle ?? undefined;
      } catch {
        handle = undefined;
      }
      setIgLoading(null);
    }
    setIgChecked((prev) => ({ ...prev, [p.id]: handle ?? null }));
    if (!handle) return;

    window.open(`https://instagram.com/${handle}`, "_blank");
    const waiting = {
      contactStatus: "waiting_instagram" as const,
      pendingOutreach: { message: "", openedAt: Date.now() },
      instagramHandle: handle,
    };
    const existingId = dealsBySource.get(p.id);
    if (existingId) {
      updateDeal(existingId, waiting);
    } else {
      const created = addDeal(dealFieldsFrom(p, handle));
      updateDeal(created.id, waiting);
      enrichDeal(created.id, p);
    }
  }

  const emojiFor = useCallback(
    (p: Place) => emojiForPlace(p, cuisines, dietary),
    [cuisines, dietary]
  );

  function dietaryBadges(p: Place): string[] {
    const out: string[] = [];
    for (const key of DIETARY_OPTIONS) {
      if (p.dietary.includes(key)) out.push(DIETARY_LABELS[key]);
      else if (p.dietary.includes(`${key}_options`)) out.push(`${DIETARY_LABELS[key]} options`);
    }
    return out;
  }

  /** breakfast/lunch/dinner + dessert/cafe/bar labels for a card. */
  function serviceTags(p: Place): string[] {
    const out: string[] = p.meals.map((m) => MEAL_LABELS[m]).filter(Boolean);
    if (p.venueTypes.includes("dessert")) out.push("Dessert");
    if (p.venueTypes.includes("cafe")) out.push("Cafe");
    if (p.venueTypes.includes("drinks")) out.push("Bar");
    return out;
  }

  const chips = (
    options: string[],
    labels: Record<string, string>,
    selected: Set<string>,
    setter: (s: Set<string>) => void
  ) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          className={`chip ${selected.has(o) ? "chip-on" : ""}`}
          onClick={() => toggle(selected, setter, o)}
        >
          {labels[o] ?? labelForTag(o)}
        </button>
      ))}
    </div>
  );

  /** Collapsible filter category — open by default, closable per category. */
  const section = (title: string, id: string, body: React.ReactNode, count: number) => {
    const closed = closedSections.has(id);
    return (
      <div className="rounded-2xl border border-border p-2.5">
        <button
          className="flex w-full items-center justify-between text-left"
          onClick={() => toggleSection(id)}
        >
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
            {title}
            {count > 0 && (
              <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[10px] text-white">
                {count}
              </span>
            )}
          </span>
          <span className="text-xs text-muted">{closed ? "▸" : "▾"}</span>
        </button>
        {!closed && <div className="mt-2">{body}</div>}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="px-2 pt-1">
        <h1 className="text-xl font-extrabold tracking-tight">What are we eating today?</h1>
        <p className="text-sm text-muted">
          Find spots, slide into their DMs, book the collab.
        </p>
      </div>

      {/* Search box */}
      <div className="card space-y-2.5 p-3.5">
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1"
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && geocode()}
            placeholder="Neighborhood or zip — or leave empty for all of NYC"
          />
          <button className="btn btn-primary shrink-0" onClick={geocode} disabled={loading}>
            {loading ? "…" : "Search"}
          </button>
        </div>

        {/* My location · Home · Work — one line */}
        <div className="grid grid-cols-3 gap-1.5">
          <button className="btn justify-center text-xs" onClick={useMyLocation} disabled={loading}>
            <PinIcon /> My location
          </button>
          {(["home", "work"] as const).map((slot) => {
            const saved = settings[slot];
            return (
              <button
                key={slot}
                className={`btn justify-center text-xs ${settingSlot === slot ? "btn-primary" : ""}`}
                onClick={() => {
                  if (saved) {
                    setLocationText(saved.label);
                    chooseOrigin(saved);
                  } else {
                    setSettingSlot(settingSlot === slot ? null : slot);
                  }
                }}
                title={
                  saved
                    ? `Search near ${saved.label} (change it in Profile)`
                    : `Save your ${slot} address`
                }
              >
                {slot === "home" ? <HomeIcon /> : <WorkIcon />}
                {saved ? (slot === "home" ? "Home" : "Work") : slot === "home" ? "Set Home" : "Set Work"}
              </button>
            );
          })}
        </div>

        {settingSlot && (
          <div className="flex gap-1.5">
            <input
              className="min-w-0 flex-1 text-sm"
              value={slotText}
              onChange={(e) => setSlotText(e.target.value)}
              placeholder={`Your ${settingSlot} address (e.g. 123 Main St, Astoria)`}
              onKeyDown={(e) => e.key === "Enter" && geocodeSlot(settingSlot)}
              autoFocus
            />
            <button className="btn btn-primary shrink-0 text-xs" onClick={() => geocodeSlot(settingSlot)}>
              Save {settingSlot}
            </button>
          </div>
        )}

        {/* Proximity slider */}
        <div className="flex items-center gap-3 px-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
            Within
          </span>
          <input
            type="range"
            min={400}
            max={8000}
            step={400}
            value={radius}
            className="min-w-0 flex-1 accent-[var(--accent)]"
            style={{ padding: 0 }}
            onChange={(e) => {
              const r = parseInt(e.target.value, 10);
              setRadius(r);
              if (radiusTimer.current) clearTimeout(radiusTimer.current);
              radiusTimer.current = setTimeout(() => {
                if (origin) void runSearch(origin, r);
              }, 500);
            }}
          />
          <span className="w-14 text-right text-xs font-bold">{radiusLabel(radius)}</span>
        </div>

        <div className="flex items-center justify-end">
          <div className="flex overflow-hidden rounded-full border border-border text-xs font-bold">
            <button
              className={`px-4 py-1.5 ${view === "list" ? "bg-accent text-white" : "text-muted"}`}
              onClick={() => setView("list")}
            >
              List
            </button>
            <button
              className={`px-4 py-1.5 ${view === "map" ? "bg-accent text-white" : "text-muted"}`}
              onClick={() => setView("map")}
            >
              Map
            </button>
          </div>
        </div>
      </div>

      {/* Filters — its own box, drops down from its header */}
      <div className="card p-3">
        <button
          className="flex w-full items-center justify-between"
          onClick={() => setShowFilters((v) => !v)}
        >
          <span className="text-sm font-extrabold">
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 rounded-full bg-accent px-2 text-xs text-white">
                {activeFilterCount}
              </span>
            )}
          </span>
          <span className="text-sm text-muted">{showFilters ? "▾" : "▸"}</span>
        </button>

        {showFilters && (
          <div className="mt-2.5 space-y-2">
            {activeFilterCount > 0 && (
              <button className="btn btn-ghost text-xs text-accent" onClick={clearFilters}>
                Clear all filters
              </button>
            )}
            {section("Type", "type", chips(VENUE_OPTIONS, VENUE_LABELS, venues, setVenues), venues.size)}
            {section("Meal", "meal", chips(MEAL_OPTIONS, MEAL_LABELS, meals, setMeals), meals.size)}
            {section(
              "Price (per person)",
              "price",
              chips(PRICE_OPTIONS, PRICE_CATEGORY_LABELS, prices, setPrices),
              prices.size
            )}
            {section("Dietary", "dietary", chips(DIETARY_OPTIONS, DIETARY_LABELS, dietary, setDietary), dietary.size)}
            {section(
              "Cuisine",
              "cuisine",
              <div className="space-y-1.5">
                <input
                  className="w-full text-sm"
                  value={cuisineQuery}
                  onChange={(e) => setCuisineQuery(e.target.value)}
                  placeholder="Search cuisines… (Greek, Italian, Sushi…)"
                />
                <div className="flex flex-wrap gap-1.5">
                  {ALL_CUISINE_TAGS.filter((cz) =>
                    labelForTag(cz).toLowerCase().includes(cuisineQuery.trim().toLowerCase())
                  ).map((cz) => (
                    <button
                      key={cz}
                      className={`chip ${cuisines.has(cz) ? "chip-on" : ""}`}
                      onClick={() => toggle(cuisines, setCuisines, cz)}
                    >
                      {labelForTag(cz)}
                    </button>
                  ))}
                  {ALL_CUISINE_TAGS.filter((cz) =>
                    labelForTag(cz).toLowerCase().includes(cuisineQuery.trim().toLowerCase())
                  ).length === 0 && (
                    <div className="px-1 py-1 text-xs text-muted">No cuisines match.</div>
                  )}
                </div>
              </div>,
              cuisines.size
            )}
            <div className="pt-0.5 text-[11px] text-muted">
              Filters in different groups compound (AND); within a group, either matches (OR).
            </div>
          </div>
        )}
      </div>

      {error && <div className="card border-accent p-3 text-sm text-accent">{error}</div>}

      {/* Results header */}
      {places.length > 0 && (
        <div className="flex items-center gap-2 px-1 text-xs text-muted">
          <span>
            {filtered.length} of {places.length} places
          </span>
          {view === "list" && (
            <select
              className="ml-auto text-xs"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
            >
              <option value="distance">Closest first</option>
              <option value="price_desc">Price: high → low</option>
              <option value="price_asc">Price: low → high</option>
              <option value="name">Name A–Z</option>
            </select>
          )}
        </div>
      )}

      {/* Map view */}
      {view === "map" && origin && (
        <div className="h-[60vh] overflow-hidden rounded-3xl border border-border">
          <MapView
            places={filtered}
            origin={origin}
            emojiFor={emojiFor}
            inPipeline={new Set(dealsBySource.keys())}
            onAdd={addToPipeline}
          />
        </div>
      )}
      {view === "map" && !origin && (
        <div className="card p-8 text-center text-sm text-muted">
          Hit <b>Search</b> to load the map — no location needed, we&apos;ll start with
          all of NYC.
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const saved = dealsBySource.has(p.id);
            // no handle and no website to discover one from = nothing to open
            const noIg =
              !p.instagramHandle && (igChecked[p.id] === null || !p.website);
            const today = p.openingHours ? todayHours(p.openingHours) : null;
            const allDays = p.openingHours ? parseOpeningHours(p.openingHours) : null;
            return (
              <div key={p.id} className="card flex flex-col gap-1.5 p-3">
                <div className="min-w-0">
                  <div className="truncate font-bold leading-tight">{p.name}</div>
                  <div className="text-xs text-muted">
                    {formatDistance(p.distanceMeters)}
                    {p.priceLevel
                      ? ` · ${p.priceEstimated ? "~" : ""}${priceLabel(p.priceLevel)}`
                      : ""}
                    {p.priceCategory === "fast_food" ? " · Fast food" : ""}
                    {p.address ? ` · ${p.address}` : ""}
                  </div>
                </div>

                {/* service + cuisine + dietary tags */}
                <div className="flex flex-wrap gap-1">
                  {serviceTags(p).map((t) => (
                    <span key={t} className="tag tag-green">
                      {t}
                    </span>
                  ))}
                  {p.cuisines.slice(0, 3).map((cz) => (
                    <span key={cz} className="tag">
                      {labelForTag(cz)}
                    </span>
                  ))}
                  {dietaryBadges(p).map((b) => (
                    <span key={b} className="tag">
                      {b}
                    </span>
                  ))}
                </div>

                {/* opening hours: today + dropdown for the week */}
                {today && (
                  <div className="text-[11px] text-muted">
                    <button
                      className="flex items-center gap-1 font-semibold"
                      onClick={() => setHoursOpen(hoursOpen === p.id ? null : p.id)}
                    >
                      <ClockIcon /> {today}
                      {allDays && <span>{hoursOpen === p.id ? "▾" : "▸"}</span>}
                    </button>
                    {hoursOpen === p.id && allDays && (
                      <div className="mt-1 space-y-0.5 rounded-xl bg-accent-soft/40 p-2">
                        {allDays.map((text, i) => (
                          <div key={i} className="flex justify-between gap-3">
                            <span className="font-semibold">{DAY_NAMES[i]}</span>
                            <span>{text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                  {noIg ? (
                    <span className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted">
                      No Instagram found
                    </span>
                  ) : (
                    <button
                      className="btn btn-primary text-xs"
                      onClick={() => openInstagram(p)}
                      disabled={igLoading === p.id}
                    >
                      {igLoading === p.id ? "Finding…" : "Instagram ↗"}
                    </button>
                  )}
                  {saved ? (
                    <span className="text-xs font-semibold text-muted">In pipeline ✓</span>
                  ) : (
                    <button className="btn text-xs" onClick={() => addToPipeline(p)}>
                      {addedFlash === p.id ? "Added!" : "+ Pipeline"}
                    </button>
                  )}
                  {p.website && (
                    <a className="btn text-xs" href={p.website} target="_blank" rel="noreferrer">
                      Website
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !searchedOnce.current && (
        <div className="card p-6 text-center text-sm text-muted">
          Tap <b>Search</b> to explore spots near you — type a neighborhood if you want,
          or leave it empty and we&apos;ll cover all of NYC. Filter by meal, price,
          cuisine &amp; dietary needs, then save the good ones to your pipeline.
          <div className="mt-2 text-[11px]">
            Prices marked ~ are our best guess from the venue&apos;s vibe — you can fix
            them anytime on a pipeline card.
          </div>
        </div>
      )}
    </div>
  );
}
