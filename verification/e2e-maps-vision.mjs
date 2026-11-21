/**
 * UI verification for photo analysis + Google Maps integration.
 *
 * Runs against a server built with NEXT_PUBLIC_GOOGLE_MAPS_API_KEY set and started with
 * VISION_URL pointing at verification/vision-stub.mjs. The Maps JS API is replaced in the browser by
 * verification/google-maps-stub.js and the detector by the vision stub: these checks exercise
 * UrbanIQ's integration code, NOT live Google Maps or the real YOLO checkpoint.
 *
 * Usage: node verification/e2e-maps-vision.mjs [baseUrl]
 */
import { createRequire } from "module";
import fs from "fs";
import os from "os";
import path from "path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const sharp = require("sharp");

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = path.resolve("verification/screenshots");
fs.mkdirSync(OUT, { recursive: true });
const STUB = fs.readFileSync("verification/google-maps-stub.js", "utf8");
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail, against: "stubbed Google Maps + stubbed vision service" });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail && (!ok || detail.length < 140) ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
async function newContext(opts = {}, { mapsDown = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  await ctx.route(/maps\.googleapis\.com\/maps\/api\/js/, (route) =>
    mapsDown ? route.abort() : route.fulfill({ status: 200, contentType: "text/javascript", body: STUB }),
  );
  await ctx.route(/(maps\.gstatic\.com|places\.googleapis\.com)/, (r) => r.abort());
  return ctx;
}

async function photo(width) {
  const file = path.join(os.tmpdir(), `cf-e2e-${width}.jpg`);
  fs.writeFileSync(file, await sharp({ create: { width, height: 600, channels: 3, background: "#808a90" } }).jpeg().toBuffer());
  return file;
}

async function pickPlace(page, query, optionName) {
  const search = page.locator("gmp-place-autocomplete input").first();
  await search.waitFor({ timeout: 15000 });
  await search.fill(query);
  await page.getByRole("option", { name: optionName }).click();
  await page.getByRole("button", { name: "Confirm this location" }).click();
}

async function report(page, { text, width, place, landmark, beforeSubmit }) {
  await page.goto(`${BASE}/report`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  if (text) await page.getByLabel("Describe the issue").fill(text);
  if (width) await page.locator("#photo-input").setInputFiles(await photo(width));
  if (place) await pickPlace(page, place[0], place[1]);
  if (landmark) await page.locator("#loc-text").fill(landmark);
  if (beforeSubmit) await beforeSubmit();
  await page.getByRole("button", { name: "Submit report" }).click();
  await page.waitForURL(/\/track\//, { timeout: 20000 });
  await page.waitForFunction(() => !document.body.innerText.includes("We're reading your report"), null, { timeout: 30000 });
  return { url: page.url().replace("?new=1", ""), text: await page.locator("main").innerText(), ref: (await page.locator("h1 .font-mono").innerText()).trim() };
}

// ── Citizen flows
const ctx = await newContext();
const p = await ctx.newPage();

await p.goto(`${BASE}/report`);
await p.locator("gmp-place-autocomplete input").waitFor();
const req = await p.evaluate(() => window.__gmapsRequest);
check("Maps JS API requested with browser key, English UI and map ID", Boolean(req?.key) && req.language === "en" && Boolean(req.map_ids), JSON.stringify(req));

const TYPES = [
  [801, "Pothole", "Roads Maintenance"],
  [802, "Water supply leak", "Water Supply"],
  [803, "Fallen tree", "Tree Response"],
  [804, "Garbage / litter", "Solid Waste Management"],
  [805, "Streetlight out", "Streetlighting Maintenance"],
];
const typeRefs = {};
for (const [w, label, dept] of TYPES) {
  const r = await report(p, { width: w, place: ["alder", "Alder Primary School"] });
  typeRefs[label] = r.ref;
  check(`Vision issue type → ${label} routed to ${dept} (photo-only, Places pin)`, r.text.includes(label) && r.text.includes(dept), r.ref);
}
await p.screenshot({ path: path.join(OUT, "10-tracking-after-vision.png"), fullPage: true });

const noVision = await report(p, { text: "Flooded pothole obstructing a lane near the school", width: 899, place: ["alder", "Alder Primary School"] });
check("No vision model (503): report still triaged from text + location", noVision.text.includes("Roads Maintenance"), noVision.ref);

const inconclusive = await report(p, { width: 700, place: ["alder", "Alder Primary School"] });
check("Photo-only report with inconclusive detector is saved (status: being reviewed)", /Being reviewed/.test(inconclusive.text), inconclusive.ref);

const ward = await report(p, { text: "Deep pothole by the park gate", place: ["millbrook", "Millbrook Park"] });
check("Places-selected location matched to ward W3 on the server", /W3 · Millbrook/.test(ward.text), ward.ref);

await p.goto(`${BASE}/report`);
await p.locator("gmp-place-autocomplete input").fill("big ben");
await p.getByRole("option", { name: "Big Ben, London" }).click();
const outText = await p.locator("main").innerText();
check("Out-of-area pin warns but can still be confirmed", /outside the city.s wards/i.test(outText));
const outside = await report(p, { text: "Pothole on the road", place: ["big ben", "Big Ben, London"] });
check("Out-of-area report accepted", /Being reviewed|Received/.test(outside.text), outside.ref);

// Location permission denied → manual landmark
const denied = await newContext({ permissions: [] });
const dp = await denied.newPage();
const deniedReport = await report(dp, {
  text: "Overflowing bin spilling onto the footpath",
  landmark: "Riverside Market",
  beforeSubmit: async () => {
    await dp.getByRole("button", { name: "Use my location" }).click();
    await dp.getByText(/Location permission was denied/).waitFor({ timeout: 10000 });
    check("Location permission denied shows a manual-entry fallback message", true);
  },
});
check("Report with permission denied saved via typed landmark (ward W4)", /Riverside Market/.test(deniedReport.text) && /W4 · Riverside/.test(deniedReport.text), deniedReport.ref);

// Maps fails to load → manual entry still works
const down = await newContext({}, { mapsDown: true });
const mp = await down.newPage();
await mp.goto(`${BASE}/report`);
await mp.getByText(/The map couldn.t load/).waitFor({ timeout: 20000 });
const manual = await report(mp, { text: "Streetlight out on Elm Street, otherwise lit", landmark: "Elm Street Playground" });
check("Google Maps unavailable: manual landmark entry still submits", manual.text.includes(manual.ref) && /Elm Street Playground/.test(manual.text), manual.ref);

// ── Officer dashboard
const o = await newContext();
const op = await o.newPage();
await op.goto(`${BASE}/officer/login`);
await op.getByRole("button", { name: "Use" }).first().click();
await op.getByRole("button", { name: "Sign in" }).click();
await op.waitForURL(`${BASE}/officer`);
await op.locator('[aria-label="Tickets"] li').first().waitFor();
await op.locator('[data-stub="google-maps-stub"]').waitFor({ timeout: 15000 });
await op.waitForTimeout(1000);

const queue = await op.locator('section[aria-label="Ticket queue"]').innerText();
const wardRow = (await op.locator('[aria-label="Tickets"] li').allInnerTexts()).find((t) => t.includes("Deep pothole") || (t.includes("Pothole") && t.includes("W3")));
check("Officer queue shows the ticket in ward W3", Boolean(wardRow && /W3/.test(wardRow)), wardRow?.replace(/\n/g, " | "));

// Queue → map sync
await op.locator('[aria-label="Tickets"] li', { hasText: "Garbage" }).first().getByRole("button").click();
await op.locator("article h2").waitFor();
const info = await op.locator("[data-stub-info]").innerText().catch(() => "");
const card = await op.locator("article").innerText();
check("Selecting a queue row highlights its pin and shows ticket, severity and ward at the pin", (await op.locator('section[aria-label="Ward map"] button[aria-pressed="true"]').count()) === 1 && /T-\d+ · (Low|Medium|High|Critical)/.test(info) && /W2/.test(info), info.replace(/\n/g, " | "));
check("Detail panel shows the selected ticket's reference and severity", /T-\d+/.test(card) && /(Low|Medium|High|Critical)/.test(card));

await op.locator("article").getByRole("tab", { name: /Evidence/ }).click();
const detail = await op.locator("article").innerText();
check("Ticket shows advisory detector label, confidence and box", /Photo detector · advisory/i.test(detail) && /garbage → garbage/.test(detail) && /87%/.test(detail));
check("Detector bounding box drawn over the photo", (await op.locator("article figure div[aria-hidden=true]").count()) >= 1);
await op.screenshot({ path: path.join(OUT, "11-officer-google-stub-vision.png") });

// Pin → ticket
const pinBtn = op.locator('[data-stub-marker] button[aria-label*="Critical"]').first();
const pinLabel = await pinBtn.getAttribute("aria-label");
await pinBtn.dispatchEvent("click"); // pin may be panned out of view in the stub map
await op.waitForTimeout(500);
const after = await op.locator("article").innerText();
const info2 = await op.locator("[data-stub-info]").innerText().catch(() => "");
check("Clicking a pin opens its ticket and shows ticket/ward/severity", after.includes(pinLabel.split(",")[0]) && info2.includes(pinLabel.split(",")[0]) && /Critical/.test(info2), info2.replace(/\n/g, " | "));

// Place ID displayed via live fetch (stub) with attribution; Google data not stored
await op.locator("#q").fill(ward.ref);
await op.waitForTimeout(800);
await op.locator('[aria-label="Tickets"] li').first().getByRole("button").click();
await op.locator("article h2").waitFor();
await op.locator("article").getByRole("tab", { name: /Evidence/ }).click();
await op.locator("article").getByText(/Citizen picked a place in Google search/).waitFor();
const placeLine = await op.locator("article").getByText(/Citizen picked a place in Google search/).first().innerText();
check("Officer sees the citizen's Google place (fetched live, attributed)", /Millbrook Park/.test(placeLine) && /© Google/.test(placeLine), placeLine);

// No-vision ticket shows the detector status
await op.locator("#q").fill(noVision.ref);
await op.waitForTimeout(800);
await op.locator('[aria-label="Tickets"] li').first().getByRole("button").click();
await op.locator("article h2").waitFor();
await op.locator("article").getByRole("tab", { name: /Evidence/ }).click();
check("No-vision ticket shows 'Unavailable' detector status", /Unavailable/.test(await op.locator("article").innerText()));

// Inconclusive photo-only report → Needs review for officers
await op.locator("#q").fill(inconclusive.ref);
await op.waitForTimeout(800);
await op.locator('[aria-label="Tickets"] li').first().getByRole("button").click();
await op.locator("article h2").waitFor();
let incDetail = await op.locator("article").innerText();
await op.locator("article").getByRole("tab", { name: /Evidence/ }).click();
incDetail += await op.locator("article").innerText();
check("Inconclusive photo-only ticket is in Needs review for insufficient evidence", /Needs review/.test(incDetail) && /insufficient evidence/.test(incDetail) && /Inconclusive/.test(incDetail));

// Out-of-area in review
await op.locator("#q").fill(outside.ref);
await op.waitForTimeout(800);
await op.locator('[aria-label="Tickets"] li').first().getByRole("button").click();
await op.locator("article h2").waitFor();
const outDetail = await op.locator("article").innerText();
check("Out-of-area ticket is in Needs review with reason", /Needs review/.test(outDetail) && /outside the municipal ward boundaries/.test(outDetail));

// Maps down on the officer dashboard → offline map fallback
const od = await newContext({ storageState: await o.storageState() }, { mapsDown: true });
const odp = await od.newPage();
await odp.goto(`${BASE}/officer`);
await odp.getByText(/Google Maps couldn.t load; showing the offline map/).waitFor({ timeout: 20000 });
check("Officer map falls back to the offline map when Google Maps can't load", true);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (stubbed Google Maps + stubbed vision)`);
fs.writeFileSync(path.join(OUT, "results-maps-vision.json"), JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
