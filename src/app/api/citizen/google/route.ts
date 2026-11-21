import { NextResponse } from "next/server";
import { startGoogleFlow, GOOGLE_FLOW_COOKIE } from "@/lib/google-auth";
import { citizenCookieOptions } from "@/lib/citizen-auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export async function GET(req: Request) {
  if (!rateLimit(`google:${clientIp(req)}`, 10, 10 * 60_000).ok) return NextResponse.json({ error: "Too many sign-in attempts. Try again later." }, { status: 429 });
  try {
    const { flow, url } = startGoogleFlow(new URL(req.url).searchParams.get("next"));
    const res = NextResponse.redirect(url);
    res.headers.set("Cache-Control", "no-store");
    res.cookies.set(GOOGLE_FLOW_COOKIE, JSON.stringify(flow), citizenCookieOptions(new Date(flow.expires)));
    return res;
  } catch {
    return NextResponse.redirect(new URL("/login?error=google", env().APP_BASE_URL));
  }
}
