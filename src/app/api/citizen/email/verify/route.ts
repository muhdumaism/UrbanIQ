import { NextResponse } from "next/server";
import { verifyCitizenEmail } from "@/lib/email-verification";
import { CITIZEN_COOKIE, citizenCookieOptions } from "@/lib/citizen-auth";
import { safeCitizenNext } from "@/lib/google-auth";
import { env } from "@/lib/env";
import { sameOrigin } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export async function POST(req: Request) {
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403 });
  if (!rateLimit(`emailverify:${clientIp(req)}`, 30, 60_000).ok) return new NextResponse(null, { status: 429 });
  let res: NextResponse;
  try {
    const data = await req.formData();
    const session = await verifyCitizenEmail(String(data.get("token") ?? ""));
    res = NextResponse.redirect(new URL(safeCitizenNext(session.next), env().APP_BASE_URL), 303);
    res.cookies.set(CITIZEN_COOKIE, session.token, citizenCookieOptions(session.expiresAt));
  } catch {
    res = NextResponse.redirect(new URL("/verify-email?error=invalid", env().APP_BASE_URL), 303);
  }
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
