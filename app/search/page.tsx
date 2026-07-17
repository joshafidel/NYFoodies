"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { labelForTag } from "@/lib/cuisines";
import { formatDistance, priceLabel } from "@/lib/geo";
import { useDeals, useSettings } from "@/lib/store";
import { Place } from "@/lib/types";

type SortMode = "distance" | "price_desc" | "price_asc" | "name";

interface GeoResult {
  label: string;
  lat: number;
  lon: number;
}

const RADII = [
  { m: 400, label: "0.25 mi" },
  { m: 800, label: "0.5 mi" },
  { m: 1600, label: "1 mi" },
  { m: 3200, label: "2 mi" },
  { m: 5000, label: "3 mi" },
];

export default function SearchPage() {
  const { deals, addDeal } = useDeals();
  const { settings, update } = useSettings();

  const [locationText, setLocationText] = useState("");
  const [origin, setOrigin] = useState<GeoResult | null>(null);
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [radius, setRadius] = useState(1600);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cuisineFilter, setCuisineFilter] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortMode>("distance");
  const [addedFlash, setAddedFlash] = useState<string | null>(null);
  const searchedOnce = useRef(false);

  // restore default location
  useEffect(() => {
    if (settings.defaultLocation && !origin && !searchedOnce.current) {
      setOrigin(settings.defaultLocation);
      setLocationText(settings.defaultLocation.label.split(",")[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.defaultLocation]);

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
    if (json.results.length === 1) {
      chooseOrigin(json.results[0]);
    } else {
      setGeoResults(json.results);
    }
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
        const g = {
          label: "My location",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        };
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

  // cuisine tags present in results, most common first
  const availableTags = useMemo(() => {
    const freq = new Map<string, number>();
    for (const p of places) for (const c of p.cuisines) freq.set(c, (freq.get(c) ?? 0) + 1);
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [places]);

  const filtered = useMemo(() => {
    let out = places;
    if (cuisineFilter.size > 0) {
      out = out.filter((p) => p.cuisines.some((c) => cuisineFilter.has(c)));
    }
    const byDistance = (a: Place, b: Place) =>
      (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity);
    switch (sort) {
      case "distance":
        return [...out].sort(byDistance);
      case "price_desc":
        // unknown prices sink to the bottom
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
  }, [places, cuisineFilter, sort]);

  function toggleCuisine(tag: string) {
    setCuisineFilter((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
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

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs font-medium text-muted">
            Location
            <input
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && geocode()}
              placeholder="e.g. Astoria, Williamsburg, 10012…"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Radius
            <select
              value={radius}
              onChange={(e) => {
                const r = parseInt(e.target.value, 10);
                setRadius(r);
                if (origin) void runSearch(origin, r);
              }}
            >
              {RADII.map((r) => (
                <option key={r.m} value={r.m}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" onClick={geocode} disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
          <button className="btn" onClick={useMyLocation} disabled={loading}>
            📍 Use my location
          </button>
        </div>

        {geoResults.length > 0 && (
          <div className="space-y-1 text-sm">
            <div className="text-xs text-muted">Which one?</div>
            {geoResults.map((g) => (
              <button
                key={`${g.lat},${g.lon}`}
                className="btn block w-full text-left"
                onClick={() => chooseOrigin(g)}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}

        {availableTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-muted">Cuisine:</span>
            {availableTags.slice(0, 18).map((t) => (
              <button
                key={t}
                className={`chip ${cuisineFilter.has(t) ? "chip-on" : ""}`}
                onClick={() => toggleCuisine(t)}
              >
                {labelForTag(t)}
              </button>
            ))}
            {cuisineFilter.size > 0 && (
              <button
                className="chip"
                onClick={() => setCuisineFilter(new Set())}
                title="Clear cuisine filters"
              >
                ✕ Clear
              </button>
            )}
          </div>
        )}

        {places.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-muted">Sort:</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
              <option value="distance">Closest first</option>
              <option value="price_desc">Price: high → low</option>
              <option value="price_asc">Price: low → high</option>
              <option value="name">Name A–Z</option>
            </select>
            <span className="text-muted">
              {filtered.length} of {places.length} places
            </span>
          </div>
        )}
      </div>

      {error && <div className="card border-accent p-3 text-sm text-accent">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => {
          const saved = inPipeline.has(p.id);
          return (
            <div key={p.id} className="card flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold leading-tight">{p.name}</div>
                  <div className="text-xs text-muted">
                    {formatDistance(p.distanceMeters)}
                    {p.priceLevel ? ` · ${priceLabel(p.priceLevel)}` : ""}
                    {p.address ? ` · ${p.address}` : ""}
                  </div>
                </div>
                <span className="text-lg" title={p.category}>
                  {p.category === "bar" || p.category === "pub"
                    ? "🍸"
                    : p.category === "cafe"
                      ? "☕"
                      : p.category === "ice_cream"
                        ? "🍦"
                        : "🍽️"}
                </span>
              </div>
              {p.cuisines.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {p.cuisines.map((c) => (
                    <span key={c} className="tag">
                      {labelForTag(c)}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                {saved ? (
                  <Link href="/pipeline" className="btn text-xs">
                    ✓ In pipeline
                  </Link>
                ) : (
                  <button
                    className="btn btn-primary text-xs"
                    onClick={() => addToPipeline(p)}
                  >
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
                  <a className="btn btn-ghost text-xs" href={p.website} target="_blank" rel="noreferrer">
                    Site ↗
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!loading && !searchedOnce.current && (
        <div className="card p-8 text-center text-sm text-muted">
          Type a neighborhood, address, or zip — or use your current location — to find
          restaurants &amp; bars nearby. Filter by cuisine, sort by price or distance, and
          add the good ones to your pipeline.
          <div className="mt-2 text-xs">
            Heads up: price levels come from open map data and are often missing — you can
            set them yourself on any card in the pipeline.
          </div>
        </div>
      )}
    </div>
  );
}
