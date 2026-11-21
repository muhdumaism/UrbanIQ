/**
 * Deletes ALL reports, tickets, history and uploaded photos (e.g. to remove the sample data).
 * Keeps departments, routing rules and officer accounts. Requires --yes.
 *   npx tsx scripts/reset-data.ts --yes
 */
import "./load-env";
import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/db";

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("[urbaniq] This deletes every report, ticket and photo. Re-run with --yes to confirm.");
    process.exit(2);
  }
  const counts = { reports: await prisma.report.count(), tickets: await prisma.ticket.count() };
  await prisma.$transaction([
    prisma.job.deleteMany(),
    prisma.ticketEvent.deleteMany(),
    prisma.duplicateSuggestion.deleteMany(),
    prisma.infoRequest.deleteMany(),
    prisma.report.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.counter.deleteMany(),
  ]);
  if ((process.env.STORAGE_DRIVER ?? "local") === "local") {
    const dir = path.resolve(process.env.LOCAL_STORAGE_DIR || "./storage/uploads", "reports");
    fs.rmSync(dir, { recursive: true, force: true });
  } else {
    console.log("[urbaniq] note: photos in the S3 bucket were not deleted (prefix reports/).");
  }
  console.log(`[urbaniq] removed ${counts.reports} reports and ${counts.tickets} tickets; departments, routing rules and officers kept.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
