/** Citizen sign-in with an Indian mobile number + one-time code. Accounts are optional for reporting. */
import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { env } from "./env";
import { newSessionToken, sha256 } from "./tokens";
import { sendOtp } from "./sms";

export const CITIZEN_COOKIE = "uq_citizen";
const OTP_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_10_MIN = 3;
const RESEND_COOLDOWN_MS = 30_000;
const SESSION_DAYS = 30;

export class OtpError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Accepts 98123 45678, 09812345678, +91 98123-45678, 919812345678 → +919812345678 */
export function normalizeIndianMobile(input: string): string | null {
  let d = input.replace(/[\s\-().]/g, "");
  if (d.startsWith("+91")) d = d.slice(3);
  else if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}

export const maskPhone = (p: string) => `${p.slice(0, 3)} ${p.slice(3, 5)}•••••${p.slice(-3)}`;

const hashCode = (phone: string, code: string) => crypto.createHmac("sha256", env().APP_SECRET).update(`otp:v1:${phone}:${code}`).digest("hex");

export async function requestOtp(rawPhone: string) {
  const phone = normalizeIndianMobile(rawPhone);
  if (!phone) throw new OtpError("Enter a valid 10-digit Indian mobile number.");
  const since = new Date(Date.now() - 10 * 60_000);
  const recent = await prisma.otpChallenge.findMany({ where: { phone, createdAt: { gte: since } }, orderBy: { createdAt: "desc" } });
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new OtpError("Please wait 30 seconds before asking for another code.", 429);
  }
  if (recent.length >= MAX_SENDS_PER_10_MIN) throw new OtpError("Too many codes requested. Try again in 10 minutes.", 429);
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const challenge = await prisma.otpChallenge.create({ data: { phone, codeHash: hashCode(phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) } });
  try {
    const { devCode } = await sendOtp(phone, code);
    return { phone, devCode };
  } catch (e) {
    await prisma.otpChallenge.delete({ where: { id: challenge.id } }).catch(() => {});
    throw new OtpError((e as Error).message, 503);
  }
}

export async function verifyOtp(rawPhone: string, rawCode: string) {
  const phone = normalizeIndianMobile(rawPhone);
  const code = rawCode.replace(/\s/g, "");
  if (!phone || !/^\d{6}$/.test(code)) throw new OtpError("Enter the 6-digit code we sent you.");
  const ch = await prisma.otpChallenge.findFirst({ where: { phone, consumedAt: null }, orderBy: { createdAt: "desc" } });
  if (!ch || ch.expiresAt < new Date()) throw new OtpError("This code has expired. Request a new one.");
  if (ch.attempts >= MAX_ATTEMPTS) throw new OtpError("Too many wrong attempts. Request a new code.", 429);
  await prisma.otpChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } });
  const ok = crypto.timingSafeEqual(Buffer.from(ch.codeHash, "hex"), Buffer.from(hashCode(phone, code), "hex"));
  if (!ok) throw new OtpError("That code isn't right. Check the SMS and try again.");
  await prisma.otpChallenge.update({ where: { id: ch.id }, data: { consumedAt: new Date() } });
  const citizen = await prisma.citizen.upsert({ where: { phone }, update: { lastLoginAt: new Date() }, create: { phone, lastLoginAt: new Date() } });
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await prisma.citizenSession.create({ data: { tokenHash: sha256(token), citizenId: citizen.id, expiresAt } });
  return { citizen, token, expiresAt };
}

export async function citizenFromToken(token: string | undefined | null) {
  if (!token || token.length > 128) return null;
  const s = await prisma.citizenSession.findUnique({ where: { tokenHash: sha256(token) }, include: { citizen: true } });
  if (!s || s.expiresAt < new Date()) return null;
  return { id: s.citizen.id, phone: s.citizen.phone };
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
