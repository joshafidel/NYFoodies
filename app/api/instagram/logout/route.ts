import { NextRequest, NextResponse } from "next/server";
import { IG_COOKIE } from "@/lib/instagram";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.delete(IG_COOKIE);
  return res;
}
