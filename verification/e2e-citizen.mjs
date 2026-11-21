/**
 * Citizen Google sign-in entry point, private reports, and officer system status.
 * Server: demo mode, sample geography (WARDS_MODE=sample SERVICE_REGION=) so the offline map can be used.
 * Usage: node verification/e2e-citizen.mjs [baseUrl]
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = path.resolve("verification/screenshots");
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail && !ok ? ` — ${detail}` : ""}`);
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const p = await ctx.newPage();

await p.goto(`${BASE}/login`);
check("Mobile OTP login is removed", await p.getByLabel("Mobile number").count() === 0);
check("Google sign-in or setup notice is visible", /Continue with Google|Google sign-in is not configured/.test(await p.locator("main").innerText()));
// Live Google consent and inbox verification require configured credentials and a test account.
const anon = await browser.newContext();
const ap = await anon.newPage();
await ap.goto(`${BASE}/me`);
check("My reports is private (redirects to sign-in)", ap.url().includes("/login"));

// Officer system status + detector test
const o = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const op = await o.newPage();
await op.goto(`${BASE}/officer/login`);
await op.getByRole("button", { name: "Use" }).first().click();
await op.getByRole("button", { name: "Sign in" }).click();
await op.waitForURL(`${BASE}/officer`);
await op.goto(`${BASE}/officer/system`);
const sys = await op.locator("main").innerText();
check("System status lists triage, YOLO and Google", /Report triage/.test(sys) && /Photo detector \(YOLO\)/.test(sys) && /Google sign-in/.test(sys));
await op.locator('input[type="file"]').setInputFiles(path.resolve("public/samples/overflowing-bin.jpg"));
await op.getByText(/Photo detector · advisory/).waitFor({ timeout: 15000 });
check("Detector test runs and reports the detector status", /Not configured|Detected|Inconclusive|Unavailable/.test(await op.locator("main").innerText()));
await op.screenshot({ path: path.join(OUT, "14-officer-system-status.png"), fullPage: true });

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (citizen sign-in + system status)`);
process.exit(failed.length ? 1 : 0);
