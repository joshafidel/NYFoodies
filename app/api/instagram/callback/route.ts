import { NextRequest, NextResponse } from "next/server";
import { IG_COOKIE, igConfigured, redirectUri } from "@/lib/instagram";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code || !igConfigured()) {
    return NextResponse.redirect(new URL("/settings?ig_error=auth_failed", req.url));
  }

  try {
    // 1. code -> short-lived token
    const form = new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID!,
      client_secret: process.env.INSTAGRAM_APP_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(req.nextUrl.origin),
      code,
    });
    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: form,
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error("IG token exchange failed", tokenJson);
      return NextResponse.redirect(new URL("/settings?ig_error=token_exchange", req.url));
    }

    // 2. short-lived -> long-lived token (~60 days)
    const llRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env
        .INSTAGRAM_APP_SECRET!}&access_token=${tokenJson.access_token}`
    );
    const llJson = await llRes.json();
    const token: string = llJson.access_token ?? tokenJson.access_token;
    const maxAge: number = llJson.expires_in ?? 3600;

    const res = NextResponse.redirect(new URL("/settings?ig_connected=1", req.url));
    res.cookies.set(IG_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("IG callback error", err);
    return NextResponse.redirect(new URL("/settings?ig_error=auth_failed", req.url));
  }
}
