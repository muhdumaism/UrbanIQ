/**
 * Create or update a real (non-demo) officer account.
 *   npx tsx scripts/create-officer.ts --email ana@city.gov --name "Ana Diaz" --role SUPERVISOR
 *   npx tsx scripts/create-officer.ts --email sam@city.gov --name "Sam Lee" --role OFFICER --department ROADS
 * Password: --password, or the OFFICER_PASSWORD environment variable (min 12 characters).
 * Re-running for an existing email updates name/role/department and resets the password.
 */
import "./load-env";
import { parseArgs } from "util";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";

async function main() {
  const { values } = parseArgs({
    options: { email: { type: "string" }, name: { type: "string" }, role: { type: "string", default: "OFFICER" }, department: { type: "string" }, password: { type: "string" } },
  });
  const email = values.email?.trim().toLowerCase();
  const password = values.password ?? process.env.OFFICER_PASSWORD;
  const role = values.role?.toUpperCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("--email is required");
  if (!values.name) throw new Error("--name is required");
  if (role !== "OFFICER" && role !== "SUPERVISOR") throw new Error("--role must be OFFICER or SUPERVISOR");
  if (!password || password.length < 12) throw new Error("Password must be at least 12 characters (--password or OFFICER_PASSWORD)");
  let departmentId: string | null = null;
  if (role === "OFFICER") {
    const codes = (await prisma.department.findMany({ select: { code: true } })).map((d) => d.code);
    if (!values.department) throw new Error(`--department is required for officers. One of: ${codes.join(", ")}`);
    const dept = await prisma.department.findUnique({ where: { code: values.department.toUpperCase() } });
    if (!dept) throw new Error(`Unknown department "${values.department}". One of: ${codes.join(", ")}`);
    departmentId = dept.id;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const data = { name: values.name, role, departmentId, passwordHash, isDemo: false } as const;
  const o = await prisma.officer.upsert({ where: { email }, update: data, create: { email, ...data } });
  await prisma.officerSession.deleteMany({ where: { officerId: o.id } });
  console.log(`[urbaniq] officer ready: ${o.email} (${o.role}${values.department ? `, ${values.department.toUpperCase()}` : ""})`);
}

main()
  .catch((e) => {
    console.error(`[urbaniq] ${e.message}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
