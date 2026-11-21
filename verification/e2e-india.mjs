/**
 * UI verification for the India deployment profile (SERVICE_REGION=IN, WARDS_MODE=none, no sample data):
 * India-only locations, officer location detection, distance filter and heatmap.
 * Google Maps is replaced by verification/google-maps-stub.js (NOT live Google).
 *
 * Server: build with NEXT_PUBLIC_GOOGLE_MAPS_API_KEY set; start with SERVICE_REGION=IN WARDS_MODE=none.
 * Data: reset-data --yes, then create-officer test@urbaniq.test (SUPERVISOR) with password india-check-123.
 * Usage: node verification/e2e-india.mjs [baseUrl]
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = path.resolve("verification/screenshots");
fs.mkdirSync(OUT, { recursive: true });
const STUB = fs.readFileSync("verification/google-maps-stub.js", "utf8");
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail, against: "stubbed Google Maps" });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail && (!ok || detail.length < 140) ? ` — ${detail}` : ""}`);
};
const browser = await chromium.launch();
async function ctxWith(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  await ctx.route(/maps\.googleapis\.com\/maps\/api\/js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: STUB }));
  return ctx;
}
async function report(page, text, place) {
  await page.goto(`${BASE}/report`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel("Describe the issue").fill(text);
  await page.locator("gmp-place-autocomplete input").fill(place[0]);
  await page.getByRole("option", { name: place[1] }).click();
  await page.getByRole("button", { name: "Confirm this location" }).click();
  await page.getByRole("button", { name: "Submit report" }).click();
  await page.waitForURL(/\/track\//, { timeout: 20000 });
  await page.waitForFunction(() => !document.body.innerText.includes("We're reading your report"), null, { timeout: 30000 });
  return { text: await page.locator("main").innerText(), ref: (await page.locator("h1 .font-mono").innerText()).trim() };
}

// ── Citizen (India only)
const c = await ctxWith();
const p = await c.newPage();
await p.goto(`${BASE}/report`);
await p.locator("gmp-place-autocomplete input").waitFor();
const req = await p.evaluate(() => ({ maps: window.__gmapsRequest, places: window.__placesOptions }));
check("Maps loaded with region=IN and Places restricted to India", req.maps?.region === "IN" && JSON.stringify(req.places?.includedRegionCodes) === '["in"]', JSON.stringify(req));
check("Search label says India", /Search for a place in India/.test(await p.locator("main").innerText()));

const delhiPothole = await report(p, "Flooded pothole obstructing a lane near the school", ["india gate", "India Gate, New Delhi"]);
check("Delhi pothole → Roads Maintenance", /Roads Maintenance/.test(delhiPothole.text), delhiPothole.ref);
const delhiBin = await report(p, "Overflowing garbage bin spilling onto the footpath", ["connaught", "Connaught Place, New Delhi"]);
check("Delhi garbage → Solid Waste Management", /Solid Waste Management/.test(delhiBin.text), delhiBin.ref);
const mumbaiWire = await report(p, "A downed wire is sparking next to the bus stop", ["gateway", "Gateway of India, Mumbai"]);
check("Mumbai sparking wire → Electrical Response", /Electrical Response/.test(mumbaiWire.text), mumbaiWire.ref);

await p.goto(`${BASE}/report`);
await p.locator("gmp-place-autocomplete input").fill("big ben");
await p.getByRole("option", { name: "Big Ben, London" }).click();
const outside = await p.locator("main").innerText();
const confirmDisabled = await p.getByRole("button", { name: "Confirm this location" }).isDisabled();
check("Pin outside India is blocked in the form", /outside India/.test(outside) && confirmDisabled);
const api = await p.request.post(`${BASE}/api/reports`, { multipart: { idempotencyKey: "india-check-outside-0001", text: "Pothole", lat: "51.5007", lng: "-0.1246", locationConfirmed: "true", locationSource: "PIN" } });
const apiBody = await api.json();
check("Server rejects a report located outside India", api.status() === 400 && /India/.test(JSON.stringify(apiBody)), `${api.status()} ${JSON.stringify(apiBody.fieldErrors)}`);

const abroad = await ctxWith({ permissions: ["geolocation"], geolocation: { latitude: 51.5, longitude: -0.12 } });
const ap = await abroad.newPage();
await ap.goto(`${BASE}/report`);
await ap.locator("gmp-place-autocomplete input").waitFor();
await ap.getByRole("button", { name: "Use my location" }).click();
await ap.getByText(/outside India/).waitFor({ timeout: 10000 });
check("Citizen device location outside India is refused with a fallback message", true);

// ── Officer with location detection (Delhi)
const o = await ctxWith({ permissions: ["geolocation"], geolocation: { latitude: 28.62, longitude: 77.22 } });
const op = await o.newPage();
await op.goto(`${BASE}/officer/login`);
await op.getByLabel("Work email").fill("test@urbaniq.test");
await op.getByLabel("Password").fill("india-check-123");
await op.getByRole("button", { name: "Sign in" }).click();
await op.waitForURL(`${BASE}/officer`);
await op.locator('[aria-label="Tickets"] li').first().waitFor();
await op.getByText("Your location detected").waitFor({ timeout: 10000 });
check("Real (non-demo) officer signs in; no sample tickets present", !(await op.locator(`[title="Seeded illustrative data"]`).count()) && (await op.locator('[aria-label="Tickets"] li').count()) === 3);
check("Officer location detected and shown on the map", (await op.locator('[data-me="1"]').count()) === 1);
const rowsText = (await op.locator('[aria-label="Tickets"] li').allInnerTexts()).join(" | ");
check("Queue shows distance from the officer", /km away/.test(rowsText) && /\b1\d{3} km away|\b11\d\d km away/.test(rowsText), rowsText.replace(/\n/g, " ").slice(0, 300));
await op.waitForTimeout(800);
const heat = await op.locator('canvas[data-heatmap="1"]').evaluate((cv) => {
  const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return { n, display: cv.style.display };
});
check("Heatmap is drawn around the officer's area", heat.n > 100 && heat.display !== "none", JSON.stringify(heat));
await op.screenshot({ path: path.join(OUT, "12-officer-india-heatmap.png") });
await op.locator("#f-near").selectOption("10");
await op.waitForTimeout(300);
const near = await op.locator('[aria-label="Tickets"] li').allInnerTexts();
check("'Within 10 km of me' keeps Delhi tickets and drops Mumbai", near.length === 2 && near.every((t) => !/Sparking/.test(t)), `${near.length} rows`);
await op.getByRole("button", { name: /Heatmap on/ }).click();
check("Heatmap can be switched off", (await op.locator('canvas[data-heatmap="1"]').evaluate((cv) => cv.style.display)) === "none");

const od = await ctxWith({ permissions: [], storageState: await o.storageState() });
const odp = await od.newPage();
await odp.goto(`${BASE}/officer`);
await odp.getByText(/Location permission denied/).waitFor({ timeout: 10000 });
check("Officer location denied: message shown, all tickets still listed", (await odp.locator('[aria-label="Tickets"] li').count()) === 3);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (India profile, stubbed Google Maps)`);
fs.writeFileSync(path.join(OUT, "results-india.json"), JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
