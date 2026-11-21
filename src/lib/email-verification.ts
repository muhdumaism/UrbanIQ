import crypto from "crypto";
import { prisma } from "./db";
import { env } from "./env";
import { sha256 } from "./tokens";
import { createCitizenSession } from "./citizen-auth";

export const resendConfigured = () => Boolean(env().RESEND_API_KEY && env().RESEND_FROM_EMAIL);

export async function requestEmailVerification(identity: { sub: string; email: string }, next: string) {
  if (!resendConfigured()) throw new Error("Email verification is not configured");
  const token = crypto.randomBytes(32).toString("base64url");
  const verification = await prisma.citizenEmailVerification.create({ data: { tokenHash: sha256(token), googleSub: identity.sub, email: identity.email, next, expiresAt: new Date(Date.now() + 15 * 60_000) } });
  const url = new URL("/verify-email", env().APP_BASE_URL);
  url.searchParams.set("token", token);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env().RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": verification.id },
      body: JSON.stringify({ from: env().RESEND_FROM_EMAIL, to: [identity.email], subject: "Verify your UrbanIQ account", text: `Confirm your email to finish creating your UrbanIQ account:\n\n${url}\n\nThis link expires in 15 minutes. If you didn't request this, ignore this email.` }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error("Email delivery failed");
  } catch {
    await prisma.citizenEmailVerification.delete({ where: { id: verification.id } });
    throw new Error("Email delivery failed");
  }
}

export async function verifyCitizenEmail(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("Invalid verification link");
  const citizen = await prisma.$transaction(async (tx) => {
    const record = await tx.citizenEmailVerification.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record) throw new Error("Invalid verification link");
    const claimed = await tx.citizenEmailVerification.updateMany({ where: { id: record.id, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
    if (claimed.count !== 1) throw new Error("Expired or used verification link");
    // Match Google's immutable subject. Never link accounts merely by matching email.
    const account = await tx.citizen.upsert({ where: { googleSub: record.googleSub }, update: { email: record.email, lastLoginAt: new Date() }, create: { googleSub: record.googleSub, email: record.email, lastLoginAt: new Date() } });
    return { id: account.id, next: record.next };
  });
  return { ...await createCitizenSession(citizen.id), next: citizen.next };
}
