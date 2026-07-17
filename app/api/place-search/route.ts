import { NextRequest, NextResponse } from "next/server";
import {
  cuisinesFromOsm,
  dietaryFromOsm,
  mealsFromOsm,
  priceCategoryFrom,
  venueTypesFromOsm,
} from "@/lib/cuisines";
import { haversineMeters } from "@/lib/geo";

/**
 * Typeahead search for a specific venue by name (Nominatim, free).
 * Used by "add to pipeline manually" — only real, verified places come back.
 */

const FOOD_TYPES = new Set([
  "restaurant",
  "bar",
  "cafe",
  "pub",
  "fast_food",
  "ice_cream",
  "biergarten",
  "food_court",
  "nightclub",
]);

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const lon = parseFloat(req.nextUrl.searchParams.get("lon") ?? "");
  const hasBias = !Number.isNaN(lat) && !Number.isNaN(lon);
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  try {
    const params = new URLSearchParams({
      q,
      format: "jsonv2",
      limit: "10",
      addressdetails: "1",
      extratags: "1",
    });
    if (hasBias) {
      // bias results toward the user's saved search area (~30km box)
      const d = 0.15;
      params.set("viewbox", `${lon - d},${lat + d},${lon + d},${lat - d}`);
    }
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        "User-Agent": "NYFoodies/1.0 (personal food-collab outreach app)",
      },
    });
    if (!res.ok) {
      return NextResponse.json({ results: [], error: `Search returned ${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as Array<{
      osm_type: string;
      osm_id: number;
      class: string;
      type: string;
      name?: string;
      display_name: string;
      lat: string;
      lon: string;
      extratags?: Record<string, string>;
      address?: Record<string, string>;
    }>;

    const results = data
      .filter((r) => r.class === "amenity" && FOOD_TYPES.has(r.type) && r.name)
      .map((r) => {
        const tags: Record<string, string> = { amenity: r.type, ...(r.extratags ?? {}) };
        const plat = parseFloat(r.lat);
        const plon = parseFloat(r.lon);
        const a = r.address ?? {};
        const address = [
          [a.house_number, a.road].filter(Boolean).join(" "),
          a.neighbourhood ?? a.suburb ?? a.city_district,
          a.city ?? a.town ?? a.village,
        ]
          .filter(Boolean)
          .join(", ");
        return {
          id: `${r.osm_type === "way" ? "way" : r.osm_type === "relation" ? "relation" : "node"}/${r.osm_id}`,
          name: r.name!,
          lat: plat,
          lon: plon,
          category: r.type,
          cuisines: cuisinesFromOsm(tags),
          venueTypes: venueTypesFromOsm(tags),
          meals: mealsFromOsm(tags),
          dietary: dietaryFromOsm(tags),
          priceCategory: priceCategoryFrom(tags, undefined),
          address: address || r.display_name.split(",").slice(0, 3).join(","),
          website: tags["website"] ?? tags["contact:website"],
          phone: tags["phone"] ?? tags["contact:phone"],
          distanceMeters: hasBias ? Math.round(haversineMeters(lat, lon, plat, plon)) : undefined,
        };
      });

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [], error: "Search failed" }, { status: 502 });
  }
}
