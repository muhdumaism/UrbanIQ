/**
 * Idempotent base setup for real deployments: departments + default routing rules.
 * Never deletes or overwrites anything (existing departments/rules edited by admins are kept).
 * Runs automatically on container start.
 */
import "../scripts/load-env";
import { prisma } from "../src/lib/db";
import { storage } from "../src/lib/storage";
import { DEPARTMENTS, RULES } from "./reference-data";

async function main() {
  for (const d of DEPARTMENTS) {
    await prisma.department.upsert({ where: { code: d.code }, update: {}, create: d });
  }
  const ids = Object.fromEntries((await prisma.department.findMany()).map((d) => [d.code, d.id]));
  const res = await prisma.routingRule.createMany({
    data: RULES.map(([subtype, code, ward]) => ({ subtype, departmentId: ids[code], wardCode: ward ?? "*", note: ward ? "Default ward override" : null })),
    skipDuplicates: true,
  });
  console.log(`[urbaniq] base setup: ${DEPARTMENTS.length} departments ensured, ${res.count} routing rules added`);
  await removeSampleData();
}

/**
 * Removes the pre-built demo content unless it is explicitly wanted:
 *  - seeded sample tickets/reports/photos (isSample = true; real citizen reports are never touched)
 *  - demo officer accounts when running in live mode
 */
async function removeSampleData() {
  if (process.env.SEED_DEMO_DATA === "true" || process.env.KEEP_SAMPLE_DATA === "true") return;
  const reports = await prisma.report.findMany({ where: { OR: [{ isSample: true }, { ticket: { isSample: true } }] }, select: { id: true, photoKey: true } });
  const tickets = await prisma.ticket.findMany({ where: { isSample: true }, select: { id: true } });
  if (reports.length || tickets.length) {
    const rIds = reports.map((r) => r.id);
    const tIds = tickets.map((t) => t.id);
    await prisma.$transaction([
      prisma.job.deleteMany({ where: { reportId: { in: rIds } } }),
      prisma.ticketEvent.deleteMany({ where: { OR: [{ ticketId: { in: tIds } }, { reportId: { in: rIds } }] } }),
      prisma.duplicateSuggestion.deleteMany({ where: { OR: [{ reportId: { in: rIds } }, { sourceTicketId: { in: tIds } }, { candidateTicketId: { in: tIds } }] } }),
      prisma.infoRequest.deleteMany({ where: { OR: [{ ticketId: { in: tIds } }, { reportId: { in: rIds } }] } }),
      prisma.report.deleteMany({ where: { id: { in: rIds } } }),
      prisma.ticket.deleteMany({ where: { id: { in: tIds } } }),
    ]);
    for (const r of reports) if (r.photoKey) await storage().delete(r.photoKey).catch(() => {});
    console.log(`[urbaniq] removed sample data: ${tickets.length} tickets, ${reports.length} reports`);
  }
  if (process.env.CIVICFLOW_MODE === "live" || process.env.CIVICFLOW_MODE === "production") {
    const demo = await prisma.officer.findMany({ where: { isDemo: true }, select: { id: true } });
    if (demo.length) {
      const ids = demo.map((o) => o.id);
      await prisma.ticketEvent.updateMany({ where: { officerId: { in: ids } }, data: { officerId: null } });
      await prisma.officer.deleteMany({ where: { id: { in: ids } } });
      console.log(`[urbaniq] removed ${demo.length} demo officer accounts (production mode)`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
