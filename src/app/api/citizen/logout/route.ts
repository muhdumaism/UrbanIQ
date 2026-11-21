import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CITIZEN_COOKIE, signOutCitizen } from "@/lib/citizen-auth";

export const runtime = "nodejs";

export async function POST() {
  const jar = await cookies();
  await signOutCitizen(jar.get(CITIZEN_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CITIZEN_COOKIE, "", { path: "/", expires: new Date(0) });
  return res;
}
