import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findMatches } from "@/lib/matching";
import { processReport } from "@/lib/pipeline";
import { resetDb, school, submit, submitAndProcess } from "./helpers";

const cfg = { distance: 150, strongDistance: 60, windowDays: 21, recurrenceDays: 60 };
const now = new Date("2026-11-21T12:00:00Z");
const cand = (o: Partial<Parameters<typeof findMatches>[1][number]>) => ({
  id: "t1", reference: "T-1", status: "NEW", subtype: "pothole", lat: -30, lng: -20, precise: true, wardCode: "W2", landmark: null, text: "pothole on school road", assets: [],
  createdAt: new Date("2026-11-21T10:00:00Z"), updatedAt: new Date("2026-11-21T10:00:00Z"), resolvedAt: null, ...o,
});
const subj = (o: Partial<Parameters<typeof findMatches>[0]> = {}) => ({ subtype: "pothole", lat: -30.0001, lng: -20, precise: true, wardCode: "W2", landmark: null, text: "big pothole school road", assets: [], ...o });

describe("matching rules", () => {
  it("auto-links a strong match: same subtype, precise pins ~11 m apart", () => {
    const out = findMatches(subj(), [cand({})], cfg, now);
    expect(out.autoLink?.ticketId).toBe("t1");
  });
  it("only suggests when location is uncertain (no auto-link)", () => {
    const out = findMatches(subj({ precise: false, lat: null, lng: null, landmark: "Alder Primary School" }), [cand({ landmark: "Alder Primary School" })], cfg, now);
    expect(out.autoLink).toBeNull();
    expect(out.suggestions[0]).toMatchObject({ kind: "POSSIBLE_DUPLICATE", ticketId: "t1" });
  });
  it("suggests (not links) when 60–150 m apart", () => {
    const out = findMatches(subj({ lat: -30.001 }), [cand({})], cfg, now);
    expect(out.autoLink).toBeNull();
    expect(out.suggestions).toHaveLength(1);
  });
  it("ignores different issue types and old tickets", () => {
    expect(findMatches(subj(), [cand({ subtype: "sparking_wire" })], cfg, now).suggestions).toHaveLength(0);
    expect(findMatches(subj(), [cand({ createdAt: new Date("2026-09-01"), updatedAt: new Date("2026-09-01") })], cfg, now).autoLink).toBeNull();
  });
  it("flags a recently resolved match as a possible recurrence", () => {
    const out = findMatches(subj(), [cand({ status: "RESOLVED", resolvedAt: new Date("2026-11-10") })], cfg, now);
    expect(out.autoLink).toBeNull();
    expect(out.suggestions[0].kind).toBe("POSSIBLE_RECURRENCE");
  });
});

describe("pipeline linking (database)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("links a second report about the same pothole to one ticket; both keep their own report", async () => {
    const a = await submitAndProcess({ text: "Flooded pothole obstructing a lane outside Alder Primary School", lat: school.lat, lng: school.lng });
    const b = await submitAndProcess({ text: "Pothole full of water near the school", lat: school.lat + 0.0002, lng: school.lng });
    expect(a.ticket!.severity).toBe("HIGH");
    expect(b.ticketId).toBe(a.ticketId);
    expect(b.linkType).toBe("AUTO_LINKED");
    expect(await prisma.ticket.count()).toBe(1);
    expect(await prisma.report.count({ where: { ticketId: a.ticketId } })).toBe(2);
  });

  it("simultaneous submissions about the same issue never create two tickets (transactional matching)", async () => {
    const reports = await Promise.all(
      [0, 1, 2, 3].map((i) => submit({ text: `Pothole on School Road number ${i}`, lat: school.lat + i * 0.00005, lng: school.lng })),
    );
    await Promise.all(reports.map((r) => processReport(r.id)));
    expect(await prisma.ticket.count()).toBe(1);
    expect(await prisma.report.count({ where: { ticketId: { not: null } } })).toBe(4);
  });

  it("new evidence of a greater hazard raises severity; report count alone does not", async () => {
    const first = await submitAndProcess({ text: "Small pothole on School Road", lat: school.lat, lng: school.lng });
    expect(first.ticket!.severity).toBe("LOW");
    await submitAndProcess({ text: "Small pothole on School Road", lat: school.lat, lng: school.lng });
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: first.ticketId! } })).severity).toBe("LOW");
    await submitAndProcess({ text: "The pothole is now flooded and obstructing a lane", lat: school.lat, lng: school.lng });
    const t = await prisma.ticket.findUniqueOrThrow({ where: { id: first.ticketId! } });
    expect(t.severity).toBe("HIGH");
    expect(await prisma.ticketEvent.count({ where: { ticketId: t.id, type: "severity_raised" } })).toBe(1);
  });

  it("idempotency: the same submission key returns the original report", async () => {
    const a = await submit({ text: "Pothole", key: "same-key-123456789012" });
    const b = await submit({ text: "Pothole", key: "same-key-123456789012" });
    expect(b.reference).toBe(a.reference);
    expect(b.token).toBe(a.token);
    expect(b.duplicate).toBe(true);
    expect(await prisma.report.count()).toBe(1);
  });

  it("critical hazard without a location goes to urgent review with a location question", async () => {
    const r = await submitAndProcess({ text: "A downed wire is sparking next to the bus stop" });
    expect(r.ticket).toMatchObject({ severity: "CRITICAL", status: "NEEDS_REVIEW", urgentReview: true });
    expect(await prisma.infoRequest.count({ where: { ticketId: r.ticketId!, kind: "LOCATION", status: "OPEN" } })).toBe(1);
  });
});
