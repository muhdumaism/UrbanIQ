import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { interpretVision } from "@/lib/vision";
import { performAction } from "@/lib/officer";
import { processReport } from "@/lib/pipeline";
import { LANDMARKS } from "@/lib/geo";
import { resetDb, school, submit } from "./helpers";

const W = 640;
const H = 480;
let photo: Buffer;
const fetchMock = vi.spyOn(globalThis, "fetch");

/** Stub of the private YOLO service's /v1/detect contract (the real checkpoint is not executed in tests). */
function detectorReturns(label: string, mapped: string | null, confidence: number) {
  fetchMock.mockImplementation(async () =>
    new Response(
      JSON.stringify({
        model: { name: "civic_guardian.pt", sha256: "11a5db9c6ad7252bcd336d6c7d84630f504683e7429f9e71d6bc7cc8af75ea81" },
        image: { width: W, height: H },
        detections: [{ label, mapped, confidence, box: { x1: 64, y1: 48, x2: 320, y2: 240 } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
}

async function photoReport(opts: { text?: string; lat?: number; lng?: number } = {}) {
  const r = await submit({ ...opts, photo });
  await processReport(r.id);
  return prisma.report.findUniqueOrThrow({ where: { id: r.id }, include: { ticket: { include: { department: true } } } });
}

describe("vision evidence interpretation", () => {
  it("normalises boxes, keeps unmapped labels, and only trusts mapped detections above threshold", () => {
    const ev = interpretVision(
      {
        model: { name: "m", sha256: null },
        image: { width: 200, height: 100 },
        detections: [
          { label: "open_manhole", mapped: null, confidence: 0.95, box: { x1: 0, y1: 0, x2: 100, y2: 50 } },
          { label: "pothole", mapped: "pothole", confidence: 0.7, box: { x1: 100, y1: 50, x2: 200, y2: 100 } },
        ],
      },
      0.5,
    );
    expect(ev.status).toBe("detected");
    expect(ev.top).toMatchObject({ issueType: "pothole", subtype: "pothole", box: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } });
    expect(ev.detections[0]).toMatchObject({ label: "open_manhole", issueType: null });
    const weak = interpretVision({ model: { name: "m" }, image: { width: 1, height: 1 }, detections: [{ label: "garbage", mapped: "garbage", confidence: 0.3, box: { x1: 0, y1: 0, x2: 1, y2: 1 } }] }, 0.5);
    expect(weak.status).toBe("inconclusive");
    expect(weak.top).toBeNull();
  });
});

describe("pipeline with the photo detector", () => {
  beforeEach(async () => {
    photo = await sharp({ create: { width: W, height: H, channels: 3, background: "#777" } }).jpeg().toBuffer();
    await resetDb();
    fetchMock.mockReset();
  });
  afterEach(() => fetchMock.mockReset());

  const cases: [string, string, string, string][] = [
    ["streetlight", "broken_streetlight", "streetlight_out", "Streetlighting Maintenance"],
    ["water_leak", "water_leak", "water_leak", "Water Supply"],
    ["fallen_tree", "fallen_tree", "fallen_tree", "Tree Response"],
    ["garbage", "garbage", "garbage", "Solid Waste Management"],
    ["pothole", "pothole", "pothole", "Roads Maintenance"],
  ];
  it.each(cases)("photo-only %s detection → %s ticket routed to %s, with advisory evidence stored", async (label, mapped, subtype, dept) => {
    detectorReturns(label, mapped, 0.88);
    const r = await photoReport({ lat: school.lat, lng: school.lng });
    expect(r.visionStatus).toBe("detected");
    expect(r.vision).toMatchObject({ top: { label, issueType: mapped, confidence: 0.88, box: { x: 0.1, y: 0.1, w: 0.4, h: 0.4 } } });
    expect(r.ticket!.subtype).toBe(subtype);
    expect(r.ticket!.department?.name).toBe(dept);
    expect(r.ticket!.wardCode).toBe(school.wardCode);
    // A detection alone is not hazard evidence: backend severity rules are unchanged.
    expect(r.ticket!.severity).toBe("LOW");
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer test-vision-token" });
  });

  it("no vision model loaded (503): triage continues with text + location", async () => {
    fetchMock.mockResolvedValue(new Response("Model not ready", { status: 503 }));
    const r = await photoReport({ text: "Flooded pothole obstructing a lane", lat: school.lat, lng: school.lng });
    expect(r.visionStatus).toBe("unavailable");
    expect(r.ticket).toMatchObject({ subtype: "pothole", severity: "HIGH", status: "NEW" });
  });

  it("vision offline + photo-only → saved and sent to Needs review for insufficient evidence", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const r = await photoReport({ lat: school.lat, lng: school.lng });
    expect(r.visionStatus).toBe("unavailable");
    expect(r.ticket!.status).toBe("NEEDS_REVIEW");
    expect(r.ticket!.reviewReasons.join()).toMatch(/insufficient evidence/);
  });

  it("inconclusive detection on a photo-only report → Needs review", async () => {
    detectorReturns("garbage", "garbage", 0.2);
    const r = await photoReport({ lat: school.lat, lng: school.lng });
    expect(r.visionStatus).toBe("inconclusive");
    expect(r.ticket!.status).toBe("NEEDS_REVIEW");
  });

  it("detector disagreeing with the text is flagged as advisory and does not change severity", async () => {
    detectorReturns("garbage", "garbage", 0.93);
    const r = await photoReport({ text: "Flooded pothole obstructing a lane", lat: school.lat, lng: school.lng });
    expect(r.ticket).toMatchObject({ subtype: "pothole", severity: "HIGH", status: "NEEDS_REVIEW" });
    expect(r.ticket!.reviewReasons.join()).toMatch(/Photo detector suggests garbage/);
  });

  it("re-running vision after an officer correction keeps the officer's decision", async () => {
    detectorReturns("pothole", "pothole", 0.9);
    const r = await photoReport({ text: "Pothole on School Road", lat: school.lat, lng: school.lng });
    const sup = await prisma.officer.create({ data: { email: "sup@x.test", name: "Sup", passwordHash: "x", role: "SUPERVISOR" } });
    const officer = { id: sup.id, email: sup.email, name: sup.name, role: sup.role, departmentId: null, isDemo: false, departmentName: null };
    await performAction(officer, r.ticketId!, { action: "correct_severity", severity: "HIGH", reason: "Deep, at a crossing" });
    detectorReturns("garbage", "garbage", 0.99);
    await processReport(r.id);
    const t = await prisma.ticket.findUniqueOrThrow({ where: { id: r.ticketId! } });
    expect(t).toMatchObject({ severity: "HIGH", subtype: "pothole" });
  });
});

describe("ward matching", () => {
  beforeEach(async () => {
    await resetDb();
    fetchMock.mockReset();
  });
  it("assigns the ward containing a confirmed pin", async () => {
    const park = LANDMARKS.find((l) => l.name === "Millbrook Park")!;
    const r = await submit({ text: "Pothole by the park gate", lat: park.lat, lng: park.lng });
    await processReport(r.id);
    const t = await prisma.ticket.findFirstOrThrow({ where: { reports: { some: { id: r.id } } } });
    expect(t.wardCode).toBe("W3");
    expect(t.status).toBe("NEW");
  });
  it("an out-of-area pin is accepted and sent to review", async () => {
    const r = await submit({ text: "Pothole on the road", lat: 51.5007, lng: -0.1246 });
    await processReport(r.id);
    const t = await prisma.ticket.findFirstOrThrow({ where: { reports: { some: { id: r.id } } } });
    expect(t.wardCode).toBeNull();
    expect(t.status).toBe("NEEDS_REVIEW");
    expect(t.reviewReasons.join()).toMatch(/outside the municipal ward boundaries/);
  });
});
