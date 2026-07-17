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

const MI = 1609.34;

function radiusLabel(m: number): string {
  const miles = m / MI;
  return miles < 1 ? `${(miles).toFixed(2).replace(/0$/, "")} mi` : `${miles.toFixed(1)} mi`;
}

const VENUE_OPTIONS = ["food", "drinks", "food_and_drinks", "dessert", "cafe"];
const MEAL_OPTIONS = ["breakfast", "lunch", "dinner"];
const PRICE_OPTIONS = ["fast_food", "cheap", "moderate", "fine_dining"];
const DIETARY_OPTIONS = ["healthy", "gluten_free", "vegan", "vegetarian"];

export default function SearchPage() {
  const { deals, addDeal } = useDeals();
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
  const [cuisineOpen, setCuisineOpen] = useState(false);
  const [cuisineQuery, setCuisineQuery] = useState("");
  const [addedFlash, setAddedFlash] = useState<string | null>(null);
  const searchedOnce = useRef(false);
  const cuisineBoxRef = useRef<HTMLDivElement>(null);
  const radiusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // close the cuisine dropdown when tapping anywhere outside it
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (cuisineBoxRef.current && !cuisineBoxRef.current.contains(e.target as Node)) {
        setCuisineOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

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
    if (!locationText.trim()) return;
    setError("");
    setGeoResults([]);
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(locationText)}`);
    const json = await res.json();
    if (!json.results?.length) {
      setError("Couldn't find that location — try adding a borough or zip.");
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
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const g = { label: "My location", lat: pos.coords.latitude, lon: pos.coords.longitude };
        setLocationText("My location");
        setOrigin(g);
        void runSearch(g, radius);
      },
      () => {
        setLoading(false);
        setError("Couldn't get your location — allow location access or type one.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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
    addDeal({
      name: p.name,
      instagramHandle: p.instagramHandle,
      address: p.address,
      lat: p.lat,
      lon: p.lon,
      cuisines: p.cuisines,
      priceLevel: p.priceLevel,
      website: p.website,
      phone: p.phone,
      sourceId: p.id,
    });
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

  const chipRow = (
    title: string,
    options: string[],
    labels: Record<string, string>,
    selected: Set<string>,
    setter: (s: Set<string>) => void
  ) => (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {title}
      </div>
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
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="card space-y-2 p-3">
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1"
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && geocode()}
            placeholder="Neighborhood, address, or zip…"
          />
          <button className="btn btn-primary shrink-0" onClick={geocode} disabled={loading}>
            {loading ? "…" : "Search"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn text-xs" onClick={useMyLocation} disabled={loading} title="Optional — you can just type a location instead">
            📍 My location
          </button>
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

        {geoResults.length > 0 && (
          <div className="space-y-1 text-sm">
            <div className="text-xs text-muted">Which one?</div>
            {geoResults.map((g) => (
              <button
                key={`${g.lat},${g.lon}`}
                className="btn block w-full text-left text-xs"
                onClick={() => chooseOrigin(g)}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card space-y-3 p-3">
          {chipRow("Type", VENUE_OPTIONS, VENUE_LABELS, venues, setVenues)}
          {chipRow("Meal", MEAL_OPTIONS, MEAL_LABELS, meals, setMeals)}
          {chipRow("Price", PRICE_OPTIONS, PRICE_CATEGORY_LABELS, prices, setPrices)}
          {chipRow("Dietary", DIETARY_OPTIONS, DIETARY_LABELS, dietary, setDietary)}

          {/* Cuisine combobox — type to filter, tap outside to close */}
          <div ref={cuisineBoxRef}>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Cuisine
            </div>
            {cuisines.size > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                {[...cuisines].map((c) => (
                  <button
                    key={c}
                    className="chip chip-on"
                    onClick={() => toggle(cuisines, setCuisines, c)}
                    title="Remove"
                  >
                    {CUISINE_EMOJI[c] ?? "🍽️"} {labelForTag(c)} ✕
                  </button>
                ))}
              </div>
            )}
            <div className="relative">
              <input
                className="w-full text-sm"
                value={cuisineQuery}
                placeholder="Search cuisines… (Greek, Italian, Sushi…)"
                onFocus={() => setCuisineOpen(true)}
                onChange={(e) => {
                  setCuisineQuery(e.target.value);
                  setCuisineOpen(true);
                }}
              />
              {cuisineOpen && (
                <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg">
                  {ALL_CUISINE_TAGS.filter((c) =>
                    labelForTag(c).toLowerCase().includes(cuisineQuery.trim().toLowerCase())
                  ).map((c) => (
                    <button
                      key={c}
                      className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${
                        cuisines.has(c) ? "bg-accent-soft font-semibold text-accent" : ""
                      }`}
                      onClick={() => toggle(cuisines, setCuisines, c)}
                    >
                      <span>{CUISINE_EMOJI[c] ?? "🍽️"}</span>
                      <span className="flex-1">{labelForTag(c)}</span>
                      {cuisines.has(c) && <span>✓</span>}
                    </button>
                  ))}
                  {ALL_CUISINE_TAGS.filter((c) =>
                    labelForTag(c).toLowerCase().includes(cuisineQuery.trim().toLowerCase())
                  ).length === 0 && (
                    <div className="px-2 py-2 text-xs text-muted">No cuisines match.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted">
            <span>Filters in different groups compound (AND); within a group, either matches (OR).</span>
            {activeFilterCount > 0 && (
              <button className="btn btn-ghost text-xs text-accent" onClick={clearFilters}>
                Clear all
              </button>
            )}
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
          Search a location first to see the map.
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
                      <span key={b} className="tag" style={{ background: "#dcfce7", color: "#15803d" }}>
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
          Type a neighborhood, address, or zip — or use your current location — to find
          restaurants, bars, cafes &amp; dessert spots. Filter by meal, price, cuisine, and
          dietary needs, then add the good ones to your pipeline.
          <div className="mt-2 text-[11px]">
            Price &amp; dietary info comes from open map data and can be missing — you can
            always fix it on a card in the pipeline.
          </div>
        </div>
      )}
    </div>
  );
}
