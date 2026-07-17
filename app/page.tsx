"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ALL_CUISINE_TAGS,
  CUISINE_EMOJI,
  DIETARY_LABELS,
  MEAL_LABELS,
  PRICE_CATEGORY_LABELS,
  VENUE_LABELS,
  emojiForPlace,
  labelForTag,
} from "@/lib/cuisines";
import { formatDistance, priceLabel } from "@/lib/geo";
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

export default function SearchPage() {
  const { deals, addDeal, updateDeal } = useDeals();
  const { settings, update, loaded: settingsLoaded } = useSettings();

  const [locationText, setLocationText] = useState("");
  const [origin, setOrigin] = useState<GeoResult | null>(null);
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [radius, setRadius] = useState(1600);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [sort, setSort] = useState<SortMode>("distance");
  const [showFilters, setShowFilters] = useState(true);
  const [cuisineQuery, setCuisineQuery] = useState("");
  const [addedFlash, setAddedFlash] = useState<string | null>(null);
  const [settingSlot, setSettingSlot] = useState<"home" | "work" | null>(null);
  const [slotText, setSlotText] = useState("");
  const [closedSections, setClosedSections] = useState<Set<string>>(new Set());
  const searchedOnce = useRef(false);
  const radiusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggleSection(id: string) {
    setClosedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // filter state — OR within a category, AND across categories
  const [meals, setMeals] = useState<Set<string>>(new Set());
  const [prices, setPrices] = useState<Set<string>>(new Set());
  const [cuisines, setCuisines] = useState<Set<string>>(new Set());
  const [dietary, setDietary] = useState<Set<string>>(new Set());
  const [venues, setVenues] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (settingsLoaded && settings.defaultLocation && !origin && !searchedOnce.current) {
      setOrigin(settings.defaultLocation);
      setLocationText(settings.defaultLocation.label.split(",")[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded]);

  const inPipeline = useMemo(
    () => new Set(deals.map((d) => d.sourceId).filter(Boolean)),
    [deals]
  );

  async function geocode() {
    // no location typed? no problem — search all of NYC
    if (!locationText.trim()) {
      setLocationText(DEFAULT_NYC.label);
      chooseOrigin(DEFAULT_NYC);
      return;
    }
    setError("");
    setGeoResults([]);
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(locationText)}`);
    const json = await res.json();
    if (!json.results?.length) {
      setError("Couldn't find that spot — try adding a borough or zip, or leave it empty to search all of NYC.");
      return;
    }
    if (json.results.length === 1) chooseOrigin(json.results[0]);
    else setGeoResults(json.results);
  }

  function chooseOrigin(g: GeoResult) {
    setGeoResults([]);
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

    // Google-Maps-style accuracy: watch the GPS for up to 6s and keep the
    // best fix instead of trusting the first (often cell-tower) guess.
    let best: GeolocationPosition | null = null;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      if (!best) {
        setLoading(false);
        setError("Couldn't get your location — you can just type a neighborhood instead.");
        return;
      }
      const { latitude, longitude, accuracy } = best.coords;
      // (0,0) "null island" or hopeless accuracy = bogus fix
      if (
        (Math.abs(latitude) < 0.5 && Math.abs(longitude) < 0.5) ||
        (accuracy != null && accuracy > 25000)
      ) {
        setLoading(false);
        setError("Your device gave a bad location fix — try again outdoors, or type a neighborhood.");
        return;
      }
      const g = { label: "My location", lat: latitude, lon: longitude };
      setLocationText("My location");
      setOrigin(g);
      void runSearch(g, radius);
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
        // good enough — stop early
        if (pos.coords.accuracy <= 50) finish();
      },
      () => finish(),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
    setTimeout(finish, 6000);
  }

  function saveSlot(slot: "home" | "work", g: GeoResult) {
    update({ [slot]: g });
    setSettingSlot(null);
    setSlotText("");
    chooseOrigin(g);
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
    saveSlot(slot, { ...g, label: `${slot === "home" ? "Home" : "Work"} · ${g.label.split(",")[0]}` });
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
      if (cuisines.size > 0 && !p.cuisines.some((c) => cuisines.has(c))) return false;
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

  function addToPipeline(p: Place) {
    const created = addDeal({
      name: p.name,
      instagramHandle: p.instagramHandle,
      address: p.address,
      lat: p.lat,
      lon: p.lon,
      cuisines: p.cuisines,
      priceLevel: p.priceLevel,
      website: p.website,
      phone: p.phone,
      openingHours: p.openingHours,
      sourceId: p.id,
    });
    // Auto-discover their Instagram + a photo from their own website
    if (p.website) {
      fetch(`/api/enrich?url=${encodeURIComponent(p.website)}`)
        .then((r) => r.json())
        .then((j: { instagramHandle?: string | null; imageUrl?: string | null }) => {
          const patch: { instagramHandle?: string; imageUrl?: string } = {};
          if (!p.instagramHandle && j.instagramHandle) patch.instagramHandle = j.instagramHandle;
          if (j.imageUrl) patch.imageUrl = j.imageUrl;
          if (Object.keys(patch).length > 0) updateDeal(created.id, patch);
        })
        .catch(() => {});
    }
    setAddedFlash(p.id);
    setTimeout(() => setAddedFlash(null), 1500);
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
        <h1 className="text-xl font-extrabold tracking-tight">
          What are we eating today? 🍜
        </h1>
        <p className="text-sm text-muted">
          Find spots, slide into their DMs, book the collab.
        </p>
      </div>

      {/* Search bar */}
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
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn text-xs" onClick={useMyLocation} disabled={loading} title="Optional — you can just type a location instead">
            📍 My location
          </button>
          {(["home", "work"] as const).map((slot) => {
            const saved = settings[slot];
            return (
              <span key={slot} className="inline-flex items-center gap-0.5">
                <button
                  className={`btn text-xs ${settingSlot === slot ? "btn-primary" : ""}`}
                  onClick={() => {
                    if (saved) {
                      setLocationText(saved.label.split("·").pop()?.trim() ?? saved.label);
                      chooseOrigin(saved);
                    } else {
                      setSettingSlot(settingSlot === slot ? null : slot);
                    }
                  }}
                  title={saved ? `Search near ${saved.label}` : `Save your ${slot} address`}
                >
                  {slot === "home" ? "⌂" : "⚒"} {saved ? (slot === "home" ? "Home" : "Work") : `+ ${slot === "home" ? "Home" : "Work"}`}
                </button>
                {saved && (
                  <button
                    className="btn btn-ghost px-1 text-[10px] text-muted"
                    title={`Change ${slot} address`}
                    onClick={() => setSettingSlot(settingSlot === slot ? null : slot)}
                  >
                    ✎
                  </button>
                )}
              </span>
            );
          })}
          <button
            className={`btn text-xs ${activeFilterCount > 0 ? "btn-primary" : ""}`}
            onClick={() => setShowFilters((v) => !v)}
          >
            {showFilters ? "▾" : "▸"} Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
          <div className="ml-auto flex overflow-hidden rounded-lg border border-border text-xs font-medium">
            <button
              className={`px-3 py-1.5 ${view === "list" ? "bg-accent text-white" : "text-muted"}`}
              onClick={() => setView("list")}
            >
              ☰ List
            </button>
            <button
              className={`px-3 py-1.5 ${view === "map" ? "bg-accent text-white" : "text-muted"}`}
              onClick={() => setView("map")}
            >
              🗺️ Map
            </button>
          </div>
        </div>

        {/* Proximity slider */}
        <div className="flex items-center gap-3 px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
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
          <span className="w-14 text-right text-xs font-semibold">{radiusLabel(radius)}</span>
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

        {geoResults.length > 0 && (
          <div className="space-y-1 text-sm">
            <div className="text-xs font-semibold text-muted">
              Which one did you mean? 🤔
            </div>
            {geoResults.map((g) => (
              <button
                key={`${g.lat},${g.lon}`}
                className="btn block w-full text-left text-xs"
                onClick={() => chooseOrigin(g)}
              >
                📍 {g.label}
              </button>
            ))}
          </div>
        )}

        {origin && searchedOnce.current && (
          <div className="text-[11px] font-semibold text-muted">
            📍 Searching near {origin.label.split(",").slice(0, 2).join(",")}
          </div>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card space-y-2 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-extrabold">Filters</span>
            <div className="flex items-center gap-1">
              {activeFilterCount > 0 && (
                <button className="btn btn-ghost text-xs text-accent" onClick={clearFilters}>
                  Clear all
                </button>
              )}
              <button className="btn text-xs" onClick={() => setShowFilters(false)}>
                ✕ Hide
              </button>
            </div>
          </div>

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
                {ALL_CUISINE_TAGS.filter((c) =>
                  labelForTag(c).toLowerCase().includes(cuisineQuery.trim().toLowerCase())
                ).map((c) => (
                  <button
                    key={c}
                    className={`chip ${cuisines.has(c) ? "chip-on" : ""}`}
                    onClick={() => toggle(cuisines, setCuisines, c)}
                  >
                    {CUISINE_EMOJI[c] ?? "🍽️"} {labelForTag(c)}
                  </button>
                ))}
                {ALL_CUISINE_TAGS.filter((c) =>
                  labelForTag(c).toLowerCase().includes(cuisineQuery.trim().toLowerCase())
                ).length === 0 && (
                  <div className="px-1 py-1 text-xs text-muted">No cuisines match.</div>
                )}
              </div>
            </div>,
            cuisines.size
          )}

          <div className="pt-1 text-[11px] text-muted">
            Filters in different groups compound (AND); within a group, either matches (OR).
          </div>
        </div>
      )}

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
        <div className="h-[60vh] overflow-hidden rounded-xl border border-border">
          <MapView
            places={filtered}
            origin={origin}
            emojiFor={emojiFor}
            inPipeline={inPipeline}
            onAdd={addToPipeline}
          />
        </div>
      )}
      {view === "map" && !origin && (
        <div className="card p-8 text-center text-sm text-muted">
          Hit <b>Search</b> to load the map — no location needed, we&apos;ll start with
          all of NYC 🗽
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const saved = inPipeline.has(p.id);
            return (
              <div key={p.id} className="card flex flex-col gap-1.5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold leading-tight">{p.name}</div>
                    <div className="text-xs text-muted">
                      {formatDistance(p.distanceMeters)}
                      {p.priceLevel
                        ? ` · ${p.priceEstimated ? "~" : ""}${priceLabel(p.priceLevel)}`
                        : ""}
                      {p.priceCategory === "fast_food" ? " · Fast food" : ""}
                      {p.address ? ` · ${p.address}` : ""}
                    </div>
                  </div>
                  <span className="text-xl leading-none">{emojiFor(p)}</span>
                </div>
                {(p.cuisines.length > 0 || dietaryBadges(p).length > 0) && (
                  <div className="flex flex-wrap gap-1">
                    {p.cuisines.slice(0, 4).map((c) => (
                      <span key={c} className="tag">
                        {labelForTag(c)}
                      </span>
                    ))}
                    {dietaryBadges(p).map((b) => (
                      <span key={b} className="tag tag-green">
                        {b}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                  {saved ? (
                    <Link href="/pipeline" className="btn text-xs">
                      ✓ In pipeline
                    </Link>
                  ) : (
                    <button className="btn btn-primary text-xs" onClick={() => addToPipeline(p)}>
                      {addedFlash === p.id ? "Added!" : "+ Add to pipeline"}
                    </button>
                  )}
                  {p.instagramHandle && (
                    <a
                      className="btn text-xs"
                      href={`https://instagram.com/${p.instagramHandle}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      @{p.instagramHandle}
                    </a>
                  )}
                  {p.website && (
                    <a
                      className="btn text-xs"
                      href={p.website}
                      target="_blank"
                      rel="noreferrer"
                    >
                      🌐 Website
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
          <div className="mb-1 text-3xl">🍕🍣🌮🍸</div>
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
