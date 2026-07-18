import { NextRequest, NextResponse } from "next/server";

/**
 * Free geocoding via OpenStreetMap Nominatim (no API key).
 * Biased toward the US/NYC but works for any location string.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const lat = req.nextUrl.searchParams.get("lat");
  const lon = req.nextUrl.searchParams.get("lon");

  // Reverse geocoding: turn a GPS fix into the real street address
  if (lat && lon && !q) {
    try {
      const params = new URLSearchParams({
        lat,
        lon,
        format: "jsonv2",
        zoom: "18",
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
        headers: { "User-Agent": "NYFoodies/1.0 (personal food-collab outreach app)" },
      });
      if (!res.ok) {
        return NextResponse.json({ address: null }, { status: 502 });
      }
      const data = (await res.json()) as {
        display_name?: string;
        address?: Record<string, string>;
      };
      const a = data.address ?? {};
      const short = [
        [a.house_number, a.road].filter(Boolean).join(" "),
        a.neighbourhood ?? a.suburb ?? a.city_district ?? a.borough,
        a.city ?? a.town ?? a.village,
      ]
        .filter(Boolean)
        .join(", ");
      return NextResponse.json({ address: short || data.display_name || null });
    } catch {
      return NextResponse.json({ address: null }, { status: 502 });
    }
  }

  if (!q) return NextResponse.json({ results: [] });

  try {
    const params = new URLSearchParams({
      q,
      format: "jsonv2",
      limit: "5",
      addressdetails: "0",
      // Bias results toward the NYC metro area (bounded=0 keeps it a
      // preference, not a hard filter) — stops ambiguous names like
      // "Astoria" resolving to same-named towns on other continents.
      viewbox: "-74.30,40.45,-73.65,41.00",
      bounded: "0",
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        // Nominatim usage policy requires an identifying User-Agent
        "User-Agent": "NYFoodies/1.0 (personal food-collab outreach app)",
      },
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      return NextResponse.json({ results: [], error: `Geocoder returned ${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as Array<{
      display_name: string;
      lat: string;
      lon: string;
    }>;
    return NextResponse.json({
      results: data.map((r) => ({
        label: r.display_name,
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
      })),
    });
  } catch {
    return NextResponse.json({ results: [], error: "Geocoding failed" }, { status: 502 });
  }
}
