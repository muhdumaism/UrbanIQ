import { NextRequest, NextResponse } from "next/server";
import { GOOGLE_FLOW_COOKIE, exchangeGoogleCode, readGoogleFlow } from "@/lib/google-auth";
import { CITIZEN_COOKIE, citizenCookieOptions, createCitizenSession } from "@/lib/citizen-auth";
import { requestEmailVerification } from "@/lib/email-verification";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  let res: NextResponse;
  try {
    const flow = readGoogleFlow(req.cookies.get(GOOGLE_FLOW_COOKIE)?.value, req.nextUrl.searchParams.get("state"));
    const code = req.nextUrl.searchParams.get("code");
    if (!code || code.length > 4096 || req.nextUrl.searchParams.has("error")) throw new Error("Google authorization cancelled");
    const identity = await exchangeGoogleCode(code, flow.verifier);
    const citizen = await prisma.citizen.findUnique({ where: { googleSub: identity.sub } });
    if (citizen && citizen.email === identity.email) {
      await prisma.citizen.update({ where: { id: citizen.id }, data: { lastLoginAt: new Date() } });
      const session = await createCitizenSession(citizen.id);
      res = NextResponse.redirect(new URL(flow.next, env().APP_BASE_URL));
      res.cookies.set(CITIZEN_COOKIE, session.token, citizenCookieOptions(session.expiresAt));
    } else {
      await requestEmailVerification(identity, flow.next);
      res = NextResponse.redirect(new URL("/verify-email", env().APP_BASE_URL));
    }
  } catch {
    res = NextResponse.redirect(new URL("/login?error=google", env().APP_BASE_URL));
  }
  res.cookies.set(GOOGLE_FLOW_COOKIE, "", { path: "/", expires: new Date(0) });
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
