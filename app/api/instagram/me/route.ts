import { NextResponse } from "next/server";
import { getToken, igConfigured } from "@/lib/instagram";

const PROFILE_FIELDS =
  "user_id,username,name,profile_picture_url,followers_count,follows_count,media_count,account_type";
const MEDIA_FIELDS =
  "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";

export async function GET() {
  const configured = igConfigured();
  const token = await getToken();
  if (!configured || !token) {
    return NextResponse.json({ configured, connected: false });
  }

  try {
    const [profileRes, mediaRes] = await Promise.all([
      fetch(`https://graph.instagram.com/v23.0/me?fields=${PROFILE_FIELDS}&access_token=${token}`),
      fetch(
        `https://graph.instagram.com/v23.0/me/media?fields=${MEDIA_FIELDS}&limit=12&access_token=${token}`
      ),
    ]);
    const profile = await profileRes.json();
    if (!profileRes.ok) {
      // token expired / revoked
      return NextResponse.json({ configured, connected: false, error: profile?.error?.message });
    }
    const media = mediaRes.ok ? (await mediaRes.json()).data ?? [] : [];
    return NextResponse.json({ configured, connected: true, profile, media });
  } catch {
    return NextResponse.json(
      { configured, connected: false, error: "Failed to reach Instagram" },
      { status: 502 }
    );
  }
}
