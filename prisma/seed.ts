/**
 * Seeds the fictional municipality of Port Alder with SAMPLE departments, routing rules,
 * demo officer accounts and illustrative reports. Re-running wipes and recreates all data.
 */
import "../scripts/load-env";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { demoTriage } from "../src/lib/ai/demo";
import { fileTriage } from "../src/lib/pipeline";
import { processPhoto } from "../src/lib/photo";
import { newPhotoKey, storage } from "../src/lib/storage";
import { newReportReference, sha256, trackingTokenFor, trackingUrl } from "../src/lib/tokens";
import { LANDMARKS } from "../src/lib/geo";
import { DEPARTMENTS, RULES } from "./reference-data";

const DEMO_PASSWORD = "civicflow-demo";



const KM_LAT = 1 / 111.0;
const KM_LNG = 1 / (111.32 * Math.cos((-30 * Math.PI) / 180));
const at = (xKm: number, yKm: number) => ({ lat: -30 + yKm * KM_LAT, lng: -20 + xKm * KM_LNG });
const near = (landmark: string, dxM = 0, dyM = 0) => {
  const l = LANDMARKS.find((x) => x.name === landmark)!;
  return { lat: l.lat + (dyM / 1000) * KM_LAT, lng: l.lng + (dxM / 1000) * KM_LNG };
};

type Scenario = {
  text: string | null;
  photo?: string;
  pin?: { lat: number; lng: number };
  locationText?: string;
  hoursAgo: number;
  status?: "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED";
  resolution?: string;
};

const SCENARIOS: Scenario[] = [
  {
    text: "Exposed junction box with sparking wires right next to the Elm Street Playground gate. Kids are playing nearby.",
    pin: near("Elm Street Playground", 25, -10),
    locationText: "Elm Street Playground gate",
    hoursAgo: 0.6,
  },
  {
    text: "Water main burst on Orchard Row, water gushing across the whole street outside the clinic.",
    pin: near("Port Alder Clinic", -40, 30),
    locationText: "Orchard Row by Port Alder Clinic",
    hoursAgo: 5,
    status: "IN_PROGRESS",
  },
  {
    text: "A tree has fallen across Mill Lane and is blocking both lanes.",
    photo: "fallen-tree",
    pin: at(1.95, -0.3),
    locationText: "Mill Lane",
    hoursAgo: 3,
  },
  {
    text: "Sewage overflowing from a manhole on Quay Road, flowing down the street towards the ferry.",
    pin: at(-2.6, -1.82),
    locationText: "Quay Road",
    hoursAgo: 9,
    status: "ACKNOWLEDGED",
  },
  {
    text: "Overflowing bin at Riverside Market, rubbish spilling onto the footpath.",
    photo: "overflowing-bin",
    pin: near("Riverside Market", 30, 15),
    locationText: "Riverside Market entrance",
    hoursAgo: 20,
    status: "ACKNOWLEDGED",
  },
  {
    text: "Storm drain on Canal Walk is clogged with leaves, standing water across the footpath after rain.",
    pin: at(0.2, -0.82),
    locationText: "Canal Walk",
    hoursAgo: 30,
  },
  {
    text: "Someone dumped old furniture and mattresses at the Millbrook Park entrance.",
    pin: near("Millbrook Park", -60, 20),
    locationText: "Millbrook Park entrance",
    hoursAgo: 50,
  },
  {
    text: "One streetlight is out on Elm Street; the rest of the street is otherwise lit.",
    pin: at(0.4, 1.12),
    locationText: "Elm Street",
    hoursAgo: 70,
  },
  {
    text: "Only one street lamp near the Harbour Ferry Terminal car park is not working, otherwise lit.",
    pin: near("Harbour Ferry Terminal", 40, 30),
    locationText: "Ferry terminal car park",
    hoursAgo: 26,
  },
  {
    text: "Strange smell near the Northgate Community Hall for a few days. Not sure what it is.",
    locationText: "Northgate Community Hall",
    hoursAgo: 14,
  },
  {
    text: "Large pothole on Northgate Road near the junction with Elm Street.",
    pin: at(-0.15, 1.2),
    locationText: "Northgate Road / Elm Street",
    hoursAgo: 24 * 12,
    status: "RESOLVED",
    resolution: "Pothole patched with hot-mix asphalt.",
  },
];

async function wipe() {
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
  await prisma.counter.deleteMany();
  const dir = path.resolve(process.env.LOCAL_STORAGE_DIR || "./storage/uploads");
  fs.rmSync(dir, { recursive: true, force: true });
}

async function main() {
  console.log("Seeding Port Alder SAMPLE data…");
  await wipe();

  const depts: Record<string, string> = {};
  for (const d of DEPARTMENTS) depts[d.code] = (await prisma.department.create({ data: d })).id;
  for (const [subtype, dept, ward] of RULES) {
    await prisma.routingRule.create({ data: { subtype, departmentId: depts[dept], wardCode: ward ?? "*", note: ward ? "Sample ward override" : null } });
  }

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const officers = [
    { email: "supervisor@civicflow.demo", name: "Dana Okafor (demo)", role: "SUPERVISOR" as const, departmentId: null },
    { email: "roads@civicflow.demo", name: "Sam Rivera (demo)", role: "OFFICER" as const, departmentId: depts.ROADS },
    { email: "electrical@civicflow.demo", name: "Lee Haddad (demo)", role: "OFFICER" as const, departmentId: depts.ELEC },
  ];
  for (const o of officers) await prisma.officer.create({ data: { ...o, passwordHash: hash, isDemo: true } });
  const supervisor = await prisma.officer.findUniqueOrThrow({ where: { email: "supervisor@civicflow.demo" } });

  const links: string[] = [];
  for (const s of SCENARIOS) {
    const id = randomUUID();
    const token = trackingTokenFor(id);
    const submittedAt = new Date(Date.now() - s.hoursAgo * 3600_000);
    let photo = null;
    if (s.photo) {
      const buf = fs.readFileSync(path.join(process.cwd(), "public", "samples", `${s.photo}.jpg`));
      const processed = await processPhoto(buf);
      const key = newPhotoKey(processed.ext);
      await storage().put(key, processed.data, processed.mime);
      photo = { key, ...processed };
    }
    const report = await prisma.report.create({
      data: {
        id,
        reference: newReportReference(),
        trackingTokenHash: sha256(token),
        idempotencyKey: `seed-${id}`,
        text: s.text,
        photoKey: photo?.key ?? null,
        photoMime: photo?.mime ?? null,
        photoWidth: photo?.width ?? null,
        photoHeight: photo?.height ?? null,
        photoFingerprint: photo?.originalSha256 ?? null,
        lat: s.pin?.lat ?? null,
        lng: s.pin?.lng ?? null,
        locationText: s.locationText ?? null,
        locationSource: s.pin ? "PIN" : s.locationText ? "LANDMARK" : "NONE",
        locationConfirmed: Boolean(s.pin),
        submittedAt,
        isSample: true,
      },
    });
    const result = demoTriage({
      text: s.text,
      photo: photo ? { data: photo.data, mime: photo.mime, fingerprint: photo.originalSha256 } : null,
      locationText: s.locationText ?? null,
      wardName: null,
    });
    await fileTriage(report.id, result, "demo:keyword-rules", null);
    const r = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    const ticketId = r.ticketId!;
    await prisma.ticket.update({ where: { id: ticketId }, data: { createdAt: submittedAt, updatedAt: submittedAt } });
    await prisma.ticketEvent.updateMany({ where: { ticketId }, data: { createdAt: submittedAt } });

    if (s.status) {
      const steps = s.status === "ACKNOWLEDGED" ? ["ACKNOWLEDGED"] : s.status === "IN_PROGRESS" ? ["ACKNOWLEDGED", "IN_PROGRESS"] : ["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED"];
      let prev = "NEW";
      let t = submittedAt.getTime();
      for (const step of steps) {
        t += Math.min(s.hoursAgo / 4, 2) * 3600_000;
        await prisma.ticketEvent.create({
          data: {
            ticketId,
            actorType: "OFFICER",
            officerId: supervisor.id,
            type: "status_changed",
            before: { status: prev },
            after: { status: step },
            visibility: "PUBLIC",
            publicMessage: step === "ACKNOWLEDGED" ? "Acknowledged by the responsible department." : step === "IN_PROGRESS" ? "A crew is working on this." : `Resolved: ${s.resolution}`,
            createdAt: new Date(t),
          },
        });
        prev = step;
      }
      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status: s.status,
          urgentReview: false,
          resolvedAt: s.status === "RESOLVED" ? new Date(t) : null,
          resolutionNote: s.resolution ?? null,
          updatedAt: new Date(t),
        },
      });
    }
    links.push(`${r.reference}  ${trackingUrl(token)}`);
  }

  console.log("\nDemo officer accounts (password: %s)", DEMO_PASSWORD);
  for (const o of officers) console.log(`  ${o.email.padEnd(28)} ${o.role}`);
  console.log("\nSample citizen tracking links:");
  for (const l of links) console.log("  " + l);
  const counts = await prisma.ticket.groupBy({ by: ["severity"], _count: true });
  console.log("\nTickets by severity:", Object.fromEntries(counts.map((c) => [c.severity, c._count])));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
