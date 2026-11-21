import { prisma } from "@/lib/db";
import { createReportFromForm } from "@/lib/intake";
import { processReport } from "@/lib/pipeline";
import { LANDMARKS } from "@/lib/geo";

export async function resetDb() {
  await prisma.job.deleteMany();
  await prisma.ticketEvent.deleteMany();
  await prisma.duplicateSuggestion.deleteMany();
  await prisma.infoRequest.deleteMany();
  await prisma.report.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.routingRule.deleteMany();
  await prisma.officerSession.deleteMany();
  await prisma.officer.deleteMany();
  await prisma.department.deleteMany();
  const roads = await prisma.department.create({ data: { code: "ROADS", name: "Roads Maintenance" } });
  const elec = await prisma.department.create({ data: { code: "ELEC", name: "Electrical Response" } });
  for (const s of ["pothole", "damaged_road"]) await prisma.routingRule.create({ data: { subtype: s, departmentId: roads.id } });
  for (const s of ["sparking_wire", "downed_wire"]) await prisma.routingRule.create({ data: { subtype: s, departmentId: elec.id } });
  return { roads, elec };
}

export const school = LANDMARKS.find((l) => l.name === "Alder Primary School")!;
let n = 0;

export async function submit(opts: { text?: string; lat?: number; lng?: number; locationText?: string; key?: string }) {
  const fd = new FormData();
  fd.set("idempotencyKey", opts.key ?? `test-${Date.now()}-${n++}-abcdefgh`);
  if (opts.text) fd.set("text", opts.text);
  if (opts.lat != null) {
    fd.set("lat", String(opts.lat));
    fd.set("lng", String(opts.lng));
    fd.set("locationConfirmed", "true");
    fd.set("locationSource", "PIN");
  }
  if (opts.locationText) fd.set("locationText", opts.locationText);
  const res = await createReportFromForm(fd);
  const report = await prisma.report.findUniqueOrThrow({ where: { reference: res.reference } });
  return { ...res, id: report.id };
}

export async function submitAndProcess(opts: Parameters<typeof submit>[0]) {
  const r = await submit(opts);
  await processReport(r.id);
  return prisma.report.findUniqueOrThrow({ where: { id: r.id }, include: { ticket: true } });
}
