import { NextRequest, NextResponse } from "next/server";
import { igConfigured, redirectUri } from "@/lib/instagram";

export async function GET(req: NextRequest) {
  if (!igConfigured()) {
    return NextResponse.redirect(new URL("/settings?ig_error=not_configured", req.url));
  }
  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    redirect_uri: redirectUri(req.nextUrl.origin),
    response_type: "code",
    scope: "instagram_business_basic",
  });
  return NextResponse.redirect(
    `https://www.instagram.com/oauth/authorize?${params.toString()}`
  );
}
