import { cookies } from "next/headers";

export const IG_COOKIE = "ig_token";

export function igConfigured(): boolean {
  return Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);
}

export function redirectUri(origin: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL || origin;
  return `${base.replace(/\/$/, "")}/api/instagram/callback`;
}

export async function getToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(IG_COOKIE)?.value ?? null;
}
