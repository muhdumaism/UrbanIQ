/** Citizen sessions for Google sign-in and email verification. Accounts are optional for reporting. */
import { cookies } from "next/headers";
import { prisma } from "./db";
import { newSessionToken, sha256 } from "./tokens";

export const CITIZEN_COOKIE = "uq_citizen";
export async function createCitizenSession(citizenId: string) {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + 30 * 86400_000);
  await prisma.citizenSession.create({ data: { tokenHash: sha256(token), citizenId, expiresAt } });
  return { token, expiresAt };
}

export async function citizenFromToken(token: string | undefined | null) {
  if (!token || token.length > 128) return null;
  const s = await prisma.citizenSession.findUnique({ where: { tokenHash: sha256(token) }, include: { citizen: true } });
  if (!s || s.expiresAt < new Date()) return null;
  return { id: s.citizen.id, email: s.citizen.email };
}

export async function currentCitizen() {
  const jar = await cookies();
  return citizenFromToken(jar.get(CITIZEN_COOKIE)?.value);
}

export async function signOutCitizen(token: string | undefined) {
  if (token) await prisma.citizenSession.deleteMany({ where: { tokenHash: sha256(token) } });
}

export const citizenCookieOptions = (expires: Date) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && !process.env.APP_BASE_URL?.startsWith("http://"),
  path: "/",
  expires,
});
