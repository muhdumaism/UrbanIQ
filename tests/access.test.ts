import { beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { canActOnTicket, createSession, officerFromToken } from "@/lib/auth";
import { applyCitizenUpdate, getTrackingView } from "@/lib/citizen";
import { ActionError, performAction } from "@/lib/officer";
import { trackingTokenFor } from "@/lib/tokens";
import { resetDb, school, submitAndProcess } from "./helpers";

describe("access controls", () => {
  let depts: Awaited<ReturnType<typeof resetDb>>;
  beforeEach(async () => {
    depts = await resetDb();
  });

  it("tracking tokens are opaque: unknown, malformed or forged tokens reveal nothing", async () => {
    await submitAndProcess({ text: "Pothole", lat: school.lat, lng: school.lng });
    expect(await getTrackingView("not-a-token")).toBeNull();
    expect(await getTrackingView("A".repeat(43))).toBeNull();
    expect(await getTrackingView(trackingTokenFor("some-other-report-id"))).toBeNull();
  });

  it("a citizen sees only their own report and public events, never internal notes or other reports", async () => {
    const a = await submitAndProcess({ text: "Flooded pothole obstructing a lane outside Alder Primary School", lat: school.lat, lng: school.lng });
    const b = await submitAndProcess({ text: "Same pothole, second reporter, secret phone 555-0100", lat: school.lat, lng: school.lng });
    expect(b.ticketId).toBe(a.ticketId);
    await prisma.ticketEvent.create({ data: { ticketId: a.ticketId!, actorType: "OFFICER", type: "note", note: "INTERNAL: crew roster" } });
    const view = await getTrackingView(trackingTokenFor(a.id));
    const json = JSON.stringify(view);
    expect(view!.reference).toBe(a.reference);
    expect(json).not.toContain(b.reference);
    expect(json).not.toContain("555-0100");
    expect(json).not.toContain("INTERNAL");
    expect(json).not.toMatch(/photoKey|reviewReasons|severity/);
  });

  it("officer sessions: invalid tokens are rejected; valid ones resolve", async () => {
    const o = await prisma.officer.create({ data: { email: "o@x.test", name: "O", passwordHash: await bcrypt.hash("pw", 4), departmentId: depts.roads.id, isDemo: true } });
    expect(await officerFromToken(undefined)).toBeNull();
    expect(await officerFromToken("forged")).toBeNull();
    const { token } = await createSession(o.id);
    expect((await officerFromToken(token))?.id).toBe(o.id);
  });

  it("officers can only act on their own department's tickets (or unassigned); supervisors on all", async () => {
    expect(canActOnTicket({ role: "OFFICER", departmentId: "roads" }, { departmentId: "roads" })).toBe(true);
    expect(canActOnTicket({ role: "OFFICER", departmentId: "roads" }, { departmentId: null })).toBe(true);
    expect(canActOnTicket({ role: "OFFICER", departmentId: "roads" }, { departmentId: "elec" })).toBe(false);
    expect(canActOnTicket({ role: "SUPERVISOR", departmentId: null }, { departmentId: "elec" })).toBe(true);

    const r = await submitAndProcess({ text: "Downed wire sparking near Alder Primary School", lat: school.lat, lng: school.lng });
    const roadsOfficer = { id: "x", email: "r@x", name: "R", role: "OFFICER" as const, departmentId: depts.roads.id, isDemo: true, departmentName: "Roads" };
    await expect(performAction(roadsOfficer, r.ticketId!, { action: "acknowledge" })).rejects.toBeInstanceOf(ActionError);
  });

  it("officer actions are audited with before/after; reroute and severity corrections require a reason", async () => {
    const sup = await prisma.officer.create({ data: { email: "s@x.test", name: "Sup", passwordHash: "x", role: "SUPERVISOR" } });
    const officer = { id: sup.id, email: sup.email, name: sup.name, role: sup.role, departmentId: null, isDemo: false, departmentName: null };
    const r = await submitAndProcess({ text: "Flooded pothole obstructing a lane", lat: school.lat, lng: school.lng });
    await expect(performAction(officer, r.ticketId!, { action: "assign_department", departmentId: depts.elec.id })).rejects.toThrow(/reason/);
    await performAction(officer, r.ticketId!, { action: "assign_department", departmentId: depts.elec.id, reason: "Cable trench, not road surface" });
    await performAction(officer, r.ticketId!, { action: "correct_severity", severity: "MEDIUM", reason: "Lane reopened by police" });
    const ev = await prisma.ticketEvent.findMany({ where: { ticketId: r.ticketId!, actorType: "OFFICER" }, orderBy: { createdAt: "asc" } });
    expect(ev.map((e) => e.type)).toEqual(["rerouted", "severity_corrected"]);
    expect(ev[0].before).toMatchObject({ department: "Roads Maintenance" });
    expect(ev[1].after).toMatchObject({ severity: "MEDIUM" });
    expect(ev.every((e) => e.officerId === sup.id)).toBe(true);
  });

  it("citizen location correction re-routes a ticket waiting for details and keeps history", async () => {
    const r = await submitAndProcess({ text: "Pothole full of water obstructing a lane near a school" });
    expect(r.ticket!.status).toBe("WAITING_FOR_DETAILS");
    const req = await prisma.infoRequest.findFirstOrThrow({ where: { reportId: r.id } });
    await applyCitizenUpdate(trackingTokenFor(r.id), { infoRequestId: req.id, answer: "Alder Primary School" });
    const t = await prisma.ticket.findUniqueOrThrow({ where: { id: r.ticketId! } });
    expect(t.wardCode).toBe(school.wardCode);
    // A typed landmark is an approximate location, so the ticket goes to an officer for review.
    expect(t.status).toBe("NEEDS_REVIEW");
    expect(t.needsReevaluation).toBe(true);
    expect(t.departmentId).toBe(depts.roads.id);
    expect((await prisma.report.findUniqueOrThrow({ where: { id: r.id } })).text).toContain("Pothole full of water");
  });
});
