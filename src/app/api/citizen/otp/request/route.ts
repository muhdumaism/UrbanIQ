import { NextResponse } from "next/server";
import { z } from "zod";
import { OtpError, maskPhone, requestOtp } from "@/lib/citizen-auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { jsonError, sameOrigin, serverError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "Cross-site requests are not allowed.");
  const rl = rateLimit(`otp:${clientIp(req)}`, 10, 60 * 60_000);
  if (!rl.ok) return jsonError(429, "Too many sign-in attempts from this connection. Try again later.");
  const body = z.object({ phone: z.string().max(20) }).safeParse(await req.json().catch(() => ({})));
  if (!body.success) return jsonError(400, "Enter your mobile number.");
  try {
    const { phone, devCode } = await requestOtp(body.data.phone);
    return NextResponse.json({ ok: true, phone: maskPhone(phone), ...(devCode ? { devCode } : {}) });
  } catch (e) {
    if (e instanceof OtpError) return jsonError(e.status, e.message);
    return serverError(e);
  }
}
