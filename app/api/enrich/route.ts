import { NextRequest, NextResponse } from "next/server";

/**
 * Discover a restaurant's Instagram handle and a photo by reading its OWN
 * website (the link they publish themselves) — free and ToS-clean.
 * Returns { instagramHandle?, imageUrl? }.
 */

const BLOCKED_HOSTS =
  /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|\[?::1)/i;

const IGNORED_IG_PATHS = new Set([
  "p", "reel", "reels", "explore", "stories", "accounts", "share", "tv", "direct",
]);

function extractInstagram(html: string): string | undefined {
  const counts = new Map<string, number>();
  for (const m of html.matchAll(/instagram\.com\/([A-Za-z0-9._]{2,30})/g)) {
    const handle = m[1].replace(/\.$/, "");
    if (IGNORED_IG_PATHS.has(handle.toLowerCase())) continue;
    counts.set(handle, (counts.get(handle) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [h, c] of counts) {
    if (c > bestCount) {
      best = h;
      bestCount = c;
    }
  }
  return best;
}

function extractImage(html: string, baseUrl: string): string | undefined {
  const og =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const raw = og?.[1];
  if (!raw) return undefined;
  try {
    const abs = new URL(raw, baseUrl).toString();
    return abs.startsWith("http") ? abs : undefined;
  } catch {
    return undefined;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")?.trim();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (!/^https?:$/.test(parsed.protocol) || BLOCKED_HOSTS.test(parsed.hostname)) {
    return NextResponse.json({ error: "blocked url" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NYFoodies/1.0; personal outreach app)",
        Accept: "text/html",
      },
    });
    clearTimeout(timer);
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) {
      return NextResponse.json({ instagramHandle: null, imageUrl: null });
    }
    // read at most ~500KB of HTML
    const html = (await res.text()).slice(0, 500_000);
    return NextResponse.json({
      instagramHandle: extractInstagram(html) ?? null,
      imageUrl: extractImage(html, res.url || parsed.toString()) ?? null,
    });
  } catch {
    return NextResponse.json({ instagramHandle: null, imageUrl: null });
  }
}
