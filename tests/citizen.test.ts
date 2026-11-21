import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { citizenFromToken, normalizeIndianMobile, OtpError, requestOtp, verifyOtp } from "@/lib/citizen-auth";
import { resetDb } from "./helpers";

describe("Indian mobile numbers", () => {
  it.each([
    ["9812345678", "+919812345678"],
    ["98123 45678", "+919812345678"],
    ["+91 98123-45678", "+919812345678"],
    ["09812345678", "+919812345678"],
    ["919812345678", "+919812345678"],
  ])("normalises %s", (input, out) => expect(normalizeIndianMobile(input)).toBe(out));
  it.each(["12345", "5812345678", "+1 415 555 0100", "98123456789"])("rejects %s", (bad) => expect(normalizeIndianMobile(bad)).toBeNull());
});

describe("OTP sign-in", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("issues a code (shown on screen only in demo mode), verifies it once, and creates a session", async () => {
    const { phone, devCode } = await requestOtp("98123 45678");
    expect(phone).toBe("+919812345678");
    expect(devCode).toMatch(/^\d{6}$/);
    const stored = await prisma.otpChallenge.findFirstOrThrow({ where: { phone } });
    expect(stored.codeHash).not.toContain(devCode!);
    const { token } = await verifyOtp("9812345678", devCode!);
    expect((await citizenFromToken(token))?.phone).toBe(phone);
    await expect(verifyOtp("9812345678", devCode!)).rejects.toBeInstanceOf(OtpError); // single use
  });

  it("rejects wrong codes and locks after 5 attempts", async () => {
    const { devCode } = await requestOtp("9812345678");
    const wrong = devCode === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await expect(verifyOtp("9812345678", wrong)).rejects.toThrow(/isn't right/);
    await expect(verifyOtp("9812345678", devCode!)).rejects.toThrow(/Too many/);
  });

  it("rejects expired codes and enforces a resend cooldown", async () => {
    const { devCode } = await requestOtp("9812345678");
    await expect(requestOtp("9812345678")).rejects.toThrow(/wait 30 seconds/);
    await prisma.otpChallenge.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(verifyOtp("9812345678", devCode!)).rejects.toThrow(/expired/);
  });
});
