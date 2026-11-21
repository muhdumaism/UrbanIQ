import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, SESSION_COOKIE, verifyCredentials } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { jsonError, sameOrigin, serverError } from "@/lib/http";

export const runtime = "nodejs";
const Body = z.object({ email: z.string().trim().email("Enter a valid email.").max(200), password: z.string().min(1, "Enter your password.").max(200) });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "Cross-site requests are not allowed.");
  const rl = rateLimit(`login:${clientIp(req)}`, 10, 5 * 60_000);
  if (!rl.ok) return jsonError(429, `Too many sign-in attempts. Try again in ${rl.retryAfter} seconds.`);
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return jsonError(400, "Please fix the highlighted fields.", { fieldErrors: parsed.error.flatten().fieldErrors });
    const res = await verifyCredentials(parsed.data.email, parsed.data.password);
    if (!res.ok) return jsonError(401, res.error);
    const { token, expiresAt } = await createSession(res.officer.id);
    const out = NextResponse.json({ ok: true, name: res.officer.name });
    out.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && !process.env.APP_BASE_URL?.startsWith("http://"),
      path: "/",
      expires: expiresAt,
    });
    return out;
  } catch (e) {
    return serverError(e);
  }
}
