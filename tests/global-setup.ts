import { execSync } from "child_process";

/** Integration tests run against a separate database (TEST_DATABASE_URL) with migrations applied. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://civicflow:civicflow@localhost:5432/civicflow_test?schema=public";
  process.env.DATABASE_URL = url;
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
}
