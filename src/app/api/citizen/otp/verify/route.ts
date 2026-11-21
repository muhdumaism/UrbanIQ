import { NextResponse } from "next/server";
import { z } from "zod";
import { CITIZEN_COOKIE, OtpError, citizenCookieOptions, verifyOtp } from "@/lib/citizen-auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { jsonError, sameOrigin, serverError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "Cross-site requests are not allowed.");
  const rl = rateLimit(`otpv:${clientIp(req)}`, 30, 60 * 60_000);
  if (!rl.ok) return jsonError(429, "Too many attempts. Try again later.");
  const body = z.object({ phone: z.string().max(20), code: z.string().max(10) }).safeParse(await req.json().catch(() => ({})));
  if (!body.success) return jsonError(400, "Enter the 6-digit code.");
  try {
    const { token, expiresAt } = await verifyOtp(body.data.phone, body.data.code);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(CITIZEN_COOKIE, token, citizenCookieOptions(expiresAt));
    return res;
  } catch (e) {
    if (e instanceof OtpError) return jsonError(e.status, e.message);
    return serverError(e);
  }
}
