import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/env", () => ({ env: () => ({ APP_BASE_URL: "https://city.example", GOOGLE_CLIENT_ID: "client-id", GOOGLE_CLIENT_SECRET: "client-secret", RESEND_API_KEY: "resend-key", RESEND_FROM_EMAIL: "signin@city.example" }) }));
const db = vi.hoisted(() => ({ citizenEmailVerification: { create: vi.fn(), delete: vi.fn() }, citizen: { findUnique: vi.fn(), update: vi.fn() }, citizenSession: { create: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: db }));
import { startGoogleFlow, readGoogleFlow, exchangeGoogleCode, safeCitizenNext } from "@/lib/google-auth";
import { requestEmailVerification } from "@/lib/email-verification";
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("Google authorization", () => {
  it("binds the redirect to random state and PKCE", () => {
    const { flow, url } = startGoogleFlow("/report");
    expect(url.searchParams.get("redirect_uri")).toBe("https://city.example/api/citizen/google/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).not.toBe(flow.verifier);
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(readGoogleFlow(JSON.stringify(flow), flow.state).next).toBe("/report");
    expect(() => readGoogleFlow(JSON.stringify(flow), "attacker")).toThrow();
    expect(() => readGoogleFlow(JSON.stringify({ ...flow, expires: 0 }), flow.state)).toThrow();
  });
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "/officer", "/api/auth/logout"])("rejects redirect %s", next => {
    expect(safeCitizenNext(next)).toBe("/me");
  });
  it("accepts only a verified identity fetched from Google", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ access_token: "access" })).mockResolvedValueOnce(Response.json({ sub: "google-123", email: "citizen@example.com", email_verified: true }));
    vi.stubGlobal("fetch", fetcher);
    expect(await exchangeGoogleCode("code", "verifier")).toMatchObject({ sub: "google-123" });
    expect(fetcher.mock.calls[0][1].body.get("code_verifier")).toBe("verifier");
    expect(fetcher.mock.calls[1][0]).toBe("https://openidconnect.googleapis.com/v1/userinfo");
  });
  it("rejects an unverified Google email", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ access_token: "access" })).mockResolvedValueOnce(Response.json({ sub: "g", email: "citizen@example.com", email_verified: false })));
    await expect(exchangeGoogleCode("code", "verifier")).rejects.toThrow();
  });
  it("rejects a failed token exchange", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 400 })));
    await expect(exchangeGoogleCode("code", "verifier")).rejects.toThrow();
  });
});
describe("Resend account verification", () => {
  it("stores only a token hash and sends a verification link through Resend", async () => {
    db.citizenEmailVerification.create.mockResolvedValue({ id: "pending" });
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "email-id" }));
    vi.stubGlobal("fetch", fetcher);
    await requestEmailVerification({ sub: "google-123", email: "citizen@example.com" }, "/me");
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(options.body);
    expect(body.to).toEqual(["citizen@example.com"]);
    const link = new URL(body.text.match(/https:\/\/\S+/)[0]);
    expect(link.pathname).toBe("/verify-email");
    expect(link.searchParams.get("token")).toHaveLength(43);
    expect(db.citizenEmailVerification.create.mock.calls[0][0].data.tokenHash).not.toBe(link.searchParams.get("token"));
  });
  it("removes the pending challenge if sending fails", async () => {
    db.citizenEmailVerification.create.mockResolvedValue({ id: "pending" });
    db.citizenEmailVerification.delete.mockResolvedValue({});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    await expect(requestEmailVerification({ sub: "g", email: "citizen@example.com" }, "/me")).rejects.toThrow("Email delivery failed");
    expect(db.citizenEmailVerification.delete).toHaveBeenCalledWith({ where: { id: "pending" } });
  });
});

import { NextRequest } from "next/server";
import { GET as googleCallback } from "@/app/api/citizen/google/callback/route";
import { GOOGLE_FLOW_COOKIE } from "@/lib/google-auth";
function callbackRequest(state: string, flow: unknown) {
  return new NextRequest(`https://city.example/api/citizen/google/callback?code=code&state=${state}`, { headers: { cookie: `${GOOGLE_FLOW_COOKIE}=${encodeURIComponent(JSON.stringify(flow))}` } });
}
function googleResponses() {
  return vi.fn().mockResolvedValueOnce(Response.json({ access_token: "access" })).mockResolvedValueOnce(Response.json({ sub: "google-123", email: "citizen@example.com", email_verified: true })).mockResolvedValueOnce(Response.json({ id: "sent" }));
}
describe("Google callback session gating", () => {
  it("clears invalid state without exchanging a code", async () => {
    const { flow } = startGoogleFlow();
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const res = await googleCallback(callbackRequest("wrong", flow));
    expect(res.headers.get("location")).toContain("/login?error=google");
    expect(fetcher).not.toHaveBeenCalled();
    expect(res.cookies.get("uq_citizen")).toBeUndefined();
    expect(res.cookies.get(GOOGLE_FLOW_COOKIE)?.value).toBe("");
  });
  it("sends new users verification mail without creating a session", async () => {
    const { flow } = startGoogleFlow();
    db.citizen.findUnique.mockResolvedValue(null);
    db.citizenEmailVerification.create.mockResolvedValue({ id: "pending" });
    vi.stubGlobal("fetch", googleResponses());
    const res = await googleCallback(callbackRequest(flow.state, flow));
    expect(res.headers.get("location")).toBe("https://city.example/verify-email");
    expect(db.citizenSession.create).not.toHaveBeenCalled();
    expect(res.cookies.get("uq_citizen")).toBeUndefined();
  });
  it("creates a session for a returning verified user", async () => {
    const { flow } = startGoogleFlow("/report");
    db.citizen.findUnique.mockResolvedValue({ id: "citizen", email: "citizen@example.com" });
    db.citizen.update.mockResolvedValue({});
    db.citizenSession.create.mockResolvedValue({});
    vi.stubGlobal("fetch", googleResponses());
    const res = await googleCallback(callbackRequest(flow.state, flow));
    expect(res.headers.get("location")).toBe("https://city.example/report");
    expect(res.cookies.get("uq_citizen")?.httpOnly).toBe(true);
    expect(db.citizenSession.create).toHaveBeenCalledOnce();
    expect(db.citizenEmailVerification.create).not.toHaveBeenCalled();
  });
});
