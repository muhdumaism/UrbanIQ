/**
 * Idempotent base setup for real deployments: departments + default routing rules.
 * Never deletes or overwrites anything (existing departments/rules edited by admins are kept).
 * Runs automatically on container start.
 */
import "../scripts/load-env";
import { prisma } from "../src/lib/db";
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
