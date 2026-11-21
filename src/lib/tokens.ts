import crypto from "crypto";
import { env } from "./env";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"; // no 0/O/1/I/L/U

export function randomCode(len: number) {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export const newReportReference = () => `CF-${randomCode(6)}`;

/**
 * Tracking tokens are HMAC(APP_SECRET, report id): unguessable, reproducible on idempotent retries,
 * and only their SHA-256 hash is stored in the database.
 */
export function trackingTokenFor(reportId: string) {
  return crypto.createHmac("sha256", env().APP_SECRET).update(`track:v1:${reportId}`).digest("base64url");
}

export const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

export function isPlausibleToken(token: string) {
  return /^[A-Za-z0-9_-]{40,64}$/.test(token);
}

export function trackingUrl(token: string) {
  return `${env().APP_BASE_URL.replace(/\/$/, "")}/track/${token}`;
}

export function newSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}
