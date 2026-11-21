/**
 * Citizen mobile sign-in (demo mode: the OTP is shown on screen; no SMS sent) and officer system status.
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
await p.getByLabel("Mobile number").fill("12345");
await p.getByRole("button", { name: "Send code" }).click();
check("Invalid mobile number is rejected", await p.getByText(/valid 10-digit/).isVisible());
const phone = `9${String(Date.now()).slice(-9)}`;
await p.getByLabel("Mobile number").fill(phone);
await p.getByRole("button", { name: "Send code" }).click();
await p.getByText(/Your code is/).waitFor();
const code = (await p.locator("strong.font-mono").innerText()).trim();
check("Demo mode shows the OTP on screen", /^\d{6}$/.test(code));
await p.screenshot({ path: path.join(OUT, "13-citizen-otp.png") });
await p.getByLabel("6-digit code").fill(code === "000000" ? "111111" : "000000");
await p.getByRole("button", { name: "Verify and sign in" }).click();
check("Wrong code shows an error", await p.getByText(/isn.t right/).waitFor({ timeout: 8000 }).then(() => true, () => false));
await p.getByLabel("6-digit code").fill(code);
await p.getByRole("button", { name: "Verify and sign in" }).click();
await p.waitForURL(`${BASE}/me`);
check("Correct code signs in and opens My reports", /My reports/.test(await p.locator("h1").innerText()) && /No reports yet/.test(await p.locator("main").innerText()));

await p.goto(`${BASE}/report`);
check("Report page shows the signed-in number", /Signed in as \+91/.test(await p.locator("main").innerText()));
await p.getByLabel("Describe the issue").fill("Overflowing garbage bin spilling onto the footpath");
await p.locator("#loc-text").fill("Riverside Market");
await p.getByRole("button", { name: "Submit report" }).click();
await p.waitForURL(/\/track\//);
const ref = (await p.locator("h1 .font-mono").innerText()).trim();
await p.goto(`${BASE}/me`);
check("New report appears in My reports", (await p.locator("main").innerText()).includes(ref), ref);
await p.getByRole("link", { name: new RegExp(ref) }).click();
await p.waitForURL(/\/track\//);
check("My reports links to the private tracking page", (await p.locator("h1").innerText()).includes(ref));
await p.goto(`${BASE}/me`);
await p.getByRole("button", { name: "Sign out" }).click();
await p.waitForURL(`${BASE}/`);
await p.goto(`${BASE}/me`);
check("After sign-out, My reports requires sign-in", p.url().includes("/login"));
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
check("System status lists triage, YOLO and SMS", /Report triage/.test(sys) && /Photo detector \(YOLO\)/.test(sys) && /Citizen SMS sign-in/.test(sys));
await op.locator('input[type="file"]').setInputFiles(path.resolve("public/samples/overflowing-bin.jpg"));
await op.getByText(/Photo detector · advisory/).waitFor({ timeout: 15000 });
check("Detector test runs and reports the detector status", /Not configured|Detected|Inconclusive|Unavailable/.test(await op.locator("main").innerText()));
await op.screenshot({ path: path.join(OUT, "14-officer-system-status.png"), fullPage: true });

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (citizen sign-in + system status)`);
process.exit(failed.length ? 1 : 0);
