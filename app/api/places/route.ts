import { NextRequest, NextResponse } from "next/server";
import {
  categoryFromOsm,
  cuisinesFromOsm,
  dietaryFromOsm,
  mealsFromOsm,
  priceCategoryFrom,
  venueTypesFromOsm,
} from "@/lib/cuisines";
import { haversineMeters } from "@/lib/geo";
import { Place } from "@/lib/types";

const AMENITIES = "restaurant|bar|cafe|pub|fast_food|ice_cream|biergarten";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function buildAddress(tags: Record<string, string>): string | undefined {
  const num = tags["addr:housenumber"];
  const street = tags["addr:street"];
  const city = tags["addr:city"];
  const parts = [num && street ? `${num} ${street}` : street, city].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

function instagramFromTags(tags: Record<string, string>): string | undefined {
  const raw = tags["contact:instagram"] ?? tags["instagram"];
  if (!raw) return undefined;
  // values look like "@handle", "handle", or a full URL
  const m = raw.match(/instagram\.com\/([A-Za-z0-9._]+)/);
  const handle = m ? m[1] : raw.replace(/^@/, "");
  return handle.replace(/\/$/, "");
}

/** OSM sometimes has price hints; normalize to 1–4 or leave undefined. */
function priceFromTags(tags: Record<string, string>): number | undefined {
  const raw = tags["price"] ?? tags["price:range"] ?? tags["price_range"];
  if (!raw) return undefined;
  const dollars = (raw.match(/\$/g) ?? []).length;
  if (dollars >= 1) return Math.min(4, dollars);
  const map: Record<string, number> = { cheap: 1, moderate: 2, expensive: 3, very_expensive: 4 };
  return map[raw.toLowerCase().trim()];
}

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const lon = parseFloat(req.nextUrl.searchParams.get("lon") ?? "");
  const radius = Math.min(
    5000,
    Math.max(100, parseInt(req.nextUrl.searchParams.get("radius") ?? "1500", 10))
  );
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  }

  const query = `
[out:json][timeout:30];
(
  node["amenity"~"^(${AMENITIES.replace(/\|/g, "|")})$"]["name"](around:${radius},${lat},${lon});
  way["amenity"~"^(${AMENITIES})$"]["name"](around:${radius},${lat},${lon});
);
out center tags 400;
`;

  let lastError = "";
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: new URLSearchParams({ data: query }),
        headers: { "User-Agent": "NYFoodies/1.0 (personal food-collab outreach app)" },
      });
      if (!res.ok) {
        lastError = `Overpass returned ${res.status}`;
        continue;
      }
      const json = (await res.json()) as { elements: OverpassElement[] };
      const seen = new Set<string>();
      const places: Place[] = [];

      for (const el of json.elements ?? []) {
        const tags = el.tags ?? {};
        const name = tags["name"];
        const plat = el.lat ?? el.center?.lat;
        const plon = el.lon ?? el.center?.lon;
        if (!name || plat == null || plon == null) continue;
        const key = name.toLowerCase();
        const id = `${el.type}/${el.id}`;
        if (seen.has(key)) continue; // node+way duplicates of the same venue
        seen.add(key);

        const priceLevel = priceFromTags(tags);
        places.push({
          id,
          name,
          lat: plat,
          lon: plon,
          category: categoryFromOsm(tags),
          cuisines: cuisinesFromOsm(tags),
          venueTypes: venueTypesFromOsm(tags),
          meals: mealsFromOsm(tags),
          dietary: dietaryFromOsm(tags),
          priceCategory: priceCategoryFrom(tags, priceLevel),
          priceLevel,
          address: buildAddress(tags),
          website: tags["website"] ?? tags["contact:website"],
          phone: tags["phone"] ?? tags["contact:phone"],
          instagramHandle: instagramFromTags(tags),
          distanceMeters: Math.round(haversineMeters(lat, lon, plat, plon)),
        } satisfies Place);
      }

      places.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
      return NextResponse.json({ places });
    } catch {
      lastError = "Overpass request failed";
    }
  }
  return NextResponse.json({ error: lastError || "Place search failed" }, { status: 502 });
}
