import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { citizenFromToken, signOutCitizen } from "@/lib/citizen-auth";
import { verifyCitizenEmail } from "@/lib/email-verification";
import { sha256 } from "@/lib/tokens";
import { resetDb } from "./helpers";
const token = "a".repeat(43);
async function pending(expiresAt = new Date(Date.now() + 60_000)) {
  return prisma.citizenEmailVerification.create({ data: { tokenHash: sha256(token), email: "citizen@example.com", googleSub: "google-123", next: "/me", expiresAt } });
}
describe("Citizen email verification and sessions", () => {
  beforeEach(async () => { await resetDb(); });
  it("requires confirmation, creates a Google account and hashed session, and supports sign-out", async () => {
    await pending();
    expect(await prisma.citizen.count()).toBe(0);
    const session = await verifyCitizenEmail(token);
    expect(await citizenFromToken(session.token)).toMatchObject({ email: "citizen@example.com" });
    const stored = await prisma.citizenSession.findFirstOrThrow();
    expect(stored.tokenHash).toBe(sha256(session.token));
    await signOutCitizen(session.token);
    expect(await citizenFromToken(session.token)).toBeNull();
  });
  it("rejects expired and unknown links", async () => {
    await pending(new Date(Date.now() - 1000));
    await expect(verifyCitizenEmail(token)).rejects.toThrow();
    await expect(verifyCitizenEmail("b".repeat(43))).rejects.toThrow();
    expect(await prisma.citizen.count()).toBe(0);
  });
  it("consumes a verification link once under concurrent requests", async () => {
    await pending();
    const results = await Promise.allSettled([verifyCitizenEmail(token), verifyCitizenEmail(token)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.citizenSession.count()).toBe(1);
  });
  it("does not link to another Google identity by email", async () => {
    await prisma.citizen.create({ data: { email: "citizen@example.com", googleSub: "someone-else" } });
    await pending();
    await expect(verifyCitizenEmail(token)).rejects.toThrow();
    expect(await prisma.citizenSession.count()).toBe(0);
  });
});
