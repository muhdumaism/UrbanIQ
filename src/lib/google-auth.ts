import crypto from "crypto";
import { z } from "zod";
import { env } from "./env";

export const GOOGLE_FLOW_COOKIE = "uq_google_flow";
export const googleConfigured = () => Boolean(env().GOOGLE_CLIENT_ID && env().GOOGLE_CLIENT_SECRET);
export const googleCallbackUrl = () => new URL("/api/citizen/google/callback", env().APP_BASE_URL).toString();

export function safeCitizenNext(value?: string | null) {
  if (!value || !value.startsWith("/") || /[\\\\\r\n]/.test(value) || value.startsWith("//")) return "/me";
  const url = new URL(value, "https://urbaniq.invalid");
  if (url.origin !== "https://urbaniq.invalid") return "/me";
  return url.pathname.startsWith("/officer") || url.pathname.startsWith("/api") ? "/me" : url.pathname + url.search;
}

export function startGoogleFlow(next?: string | null) {
  if (!googleConfigured()) throw new Error("Google sign-in is not configured");
  const state = crypto.randomBytes(32).toString("base64url");
  const verifier = crypto.randomBytes(32).toString("base64url");
  const flow = { state, verifier, next: safeCitizenNext(next), expires: Date.now() + 10 * 60_000 };
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: env().GOOGLE_CLIENT_ID!, redirect_uri: googleCallbackUrl(), response_type: "code", scope: "openid email", state, code_challenge: crypto.createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", prompt: "select_account" }).toString();
  return { flow, url };
}

export function readGoogleFlow(raw: string | undefined, state: string | null) {
  const flow = z.object({ state: z.string().length(43), verifier: z.string().length(43), next: z.string(), expires: z.number() }).parse(JSON.parse(raw ?? "null"));
  if (!state || state !== flow.state || flow.expires < Date.now()) throw new Error("Invalid OAuth state");
  return { ...flow, next: safeCitizenNext(flow.next) };
}

/** The access token is exchanged server-side and sent only to Google's userinfo endpoint. */
export async function exchangeGoogleCode(code: string, verifier: string) {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env().GOOGLE_CLIENT_ID!, client_secret: env().GOOGLE_CLIENT_SECRET!, redirect_uri: googleCallbackUrl(), grant_type: "authorization_code", code_verifier: verifier }),
    signal: AbortSignal.timeout(10_000), cache: "no-store",
  });
  if (!tokenRes.ok) throw new Error("Google token exchange failed");
  const token = z.object({ access_token: z.string().min(1) }).parse(await tokenRes.json());
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!res.ok) throw new Error("Google identity lookup failed");
  return z.object({ sub: z.string().min(1).max(255), email: z.string().email().max(320), email_verified: z.literal(true) }).parse(await res.json());
}
