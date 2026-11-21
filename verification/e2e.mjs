/**
 * End-to-end verification of the demo flows through the real UI.
 * Usage: (server running, freshly seeded)  node verification/e2e.mjs [baseUrl]
 * Screenshots are written to verification/screenshots/.
 */
import { createRequire } from "module";
const { chromium, devices } = createRequire(import.meta.url)("playwright");
import fs from "fs";
import path from "path";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = path.resolve("verification/screenshots");
fs.mkdirSync(OUT, { recursive: true });
const landmarks = JSON.parse(fs.readFileSync("data/landmarks.json", "utf8"));
const lm = (n) => landmarks.find((l) => l.name === n);
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  const shown = ok && detail.length > 120 ? "" : detail;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${shown ? ` — ${shown}` : ""}`);
};

const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });

async function pinAt(page, lat, lng) {
  await page.waitForFunction(() => {
    const el = document.querySelector('[aria-label^="Map of Port Alder"]');
    return el && el.__map && el.__map.loaded();
  }, null, { timeout: 20000 });
  const box = await page.locator('[aria-label^="Map of Port Alder"]').first();
  await box.evaluate((el, [lat, lng]) => el.__map.jumpTo({ center: [lng, lat], zoom: 15 }), [lat, lng]);
  await box.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const pt = await box.evaluate((el, [lat, lng]) => el.__map.project([lng, lat]), [lat, lng]);
  const bb = await box.boundingBox();
  await page.mouse.click(bb.x + pt.x, bb.y + pt.y);
  await page.getByRole("button", { name: "Confirm this location" }).click();
}

async function submitReport(page, { text, sample, pin, landmark, shot }) {
  await page.goto(`${BASE}/report`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  if (text) await page.getByLabel("Describe the issue").fill(text);
  if (sample) await page.getByRole("button", { name: sample }).click();
  if (sample) await page.getByAltText("Preview of the photo you selected").waitFor();
  if (pin) await pinAt(page, pin.lat, pin.lng);
  if (landmark) await page.locator("#loc-text").fill(landmark);
  if (shot) await page.screenshot({ path: path.join(OUT, shot), fullPage: true });
  await page.getByRole("button", { name: "Submit report" }).click();
  await page.waitForURL(/\/track\/[A-Za-z0-9_-]+\?new=1/, { timeout: 20000 });
  await page.getByText(/Status/).first().waitFor();
  await page.waitForFunction(() => !document.body.innerText.includes("We're reading your report"), null, { timeout: 30000 });
  const url = page.url().replace("?new=1", "");
  const reference = (await page.locator("h1 .font-mono").innerText()).trim();
  return { url, reference };
}

// ── Citizen: flows 1–4 (mobile)
const mobile = await browser.newContext({ ...devices["iPhone 13"] });
const m = await mobile.newPage();
const school = lm("Alder Primary School");

const r1 = await submitReport(m, {
  text: "Flooded pothole obstructing a lane outside Alder Primary School. Cars are swerving at drop-off.",
  sample: "Flooded pothole",
  pin: school,
  shot: "01-report-form-mobile.png",
});
await m.screenshot({ path: path.join(OUT, "02-confirmation-mobile.png"), fullPage: true });
const r1Text = await m.locator("main").innerText();
check("1. Pothole report routed to Roads Maintenance", r1Text.includes("Roads Maintenance"), r1.reference);
const ticketRef1 = (r1Text.match(/ticket (T-\d+)/) ?? [])[1];

const r2 = await submitReport(m, { text: "Big pothole full of water near the school on School Road, blocking a lane.", pin: { lat: school.lat + 0.00015, lng: school.lng + 0.0001 } });
const r2Text = await m.locator("main").innerText();
const ticketRef2 = (r2Text.match(/ticket (T-\d+)/) ?? [])[1];
check("2. Second pothole report linked to the same ticket", ticketRef1 && ticketRef1 === ticketRef2, `${r1.reference} & ${r2.reference} → ${ticketRef2}`);
await m.goto(r1.url);
check("2. First tracking link still works independently", (await m.locator("h1").innerText()).includes(r1.reference));
await m.goto(r2.url);
check("2. Second tracking link shows its own report", (await m.locator("h1").innerText()).includes(r2.reference) && !(await m.locator("main").innerText()).includes(r1.reference));

const busStop = lm("Quay Road Bus Stop");
const r3 = await submitReport(m, { text: "A downed wire is sparking next to the Quay Road bus stop. People are waiting right beside it.", sample: "Hanging wire", pin: busStop });
const r3b = await submitReport(m, { text: "Power line down and sparking next to a bus stop!" });
const r3bText = await m.locator("main").innerText();
check("3. Sparking wire without location asks for location", /needs? a detail from you/i.test(r3bText), r3b.reference);

const r4 = await submitReport(m, { sample: "Overflowing bin" });
const r4Text = await m.locator("main").innerText();
await m.screenshot({ path: path.join(OUT, "03-photo-only-asks-location-mobile.png"), fullPage: true });
check("4. Photo-only report saved and asks for location", /Where exactly is/i.test(r4Text) && r4Text.includes(r4.reference), r4.reference);

// ── Officer: flows 1, 3, 4, 5 (desktop)
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const d = await desk.newPage();
await d.goto(`${BASE}/officer`);
check("6. Unauthenticated /officer redirects to sign-in", d.url().includes("/officer/login"));
await d.getByRole("button", { name: "Use" }).first().click();
await d.getByRole("button", { name: "Sign in" }).click();
await d.waitForURL(`${BASE}/officer`);
await d.locator('[aria-label="Tickets"] li').first().waitFor();
await d.waitForTimeout(2500); // map pins
await d.screenshot({ path: path.join(OUT, "04-officer-queue-map.png") });

const queueText = await d.locator('section[aria-label="Ticket queue"]').innerText();
const urgentSection = await d.locator("text=Urgent review").count();
check("3. Wire report without location is in Urgent review", urgentSection > 0 && /Urgent review[\s\S]*Critical[\s\S]*Sparking wire/i.test(queueText));
const order = await d.locator('[aria-label="Tickets"] li').allInnerTexts();
const idxCrit = order.findIndex((t) => t.includes("Sparking wire") && t.includes("Critical"));
const idxPot = order.findIndex((t) => t.includes(ticketRef1));
check("3. Sparking wire (Critical) is above the pothole (High)", idxCrit >= 0 && idxPot > idxCrit, `positions ${idxCrit} < ${idxPot}`);
const potRow = order[idxPot] ?? "";
check("1. Pothole ticket is High, Roads Maintenance, 2 reports", /High/.test(potRow) && /Roads Maintenance/.test(potRow) && /2 reports/.test(potRow));
check("4. Photo-only report visible to officers with missing-location label", /Overflowing bin[\s\S]{0,200}Location missing/.test(queueText));

// Select pothole row → detail panel + highlighted pin
await d.locator('[aria-label="Tickets"] li', { hasText: ticketRef1 }).getByRole("button").click();
await d.getByRole("heading", { level: 2, name: /Pothole/ }).waitFor();
const pinPressed = await d.locator('button[aria-pressed="true"]').count();
check("Desktop: selecting a row highlights its pin", pinPressed === 1);
await d.getByRole("img", { name: /Photo submitted with/ }).first().waitFor();
const photoOk = await d.getByRole("img", { name: /Photo submitted with/ }).first().evaluate((img) => img.complete && img.naturalWidth > 0);
const realPhotoSrc = await d.getByRole("img", { name: /Photo submitted with/ }).first().getAttribute("src");
check("Officer can view the private photo", photoOk);
const detail = await d.locator("article").innerText();
check("Detail shows severity reason, citizen facts, image observations", /Why High/.test(detail) && /What the citizen reported/i.test(detail) && /What the image shows/i.test(detail) && /water-filled/i.test(detail), detail.slice(0, 1500).replace(/\n/g, " | "));
await d.waitForTimeout(800);
await d.screenshot({ path: path.join(OUT, "05-officer-ticket-detail.png") });

// Flow 5: reroute, acknowledge, start, resolve
const panel = d.locator("article");
await panel.getByRole("button", { name: "Reroute" }).click();
await panel.locator("#dept").selectOption({ label: "Stormwater Drainage" });
await panel.getByLabel(/Reason/).fill("Flooding comes from a blocked drain beside the pothole; drainage crew first.");
await panel.getByRole("button", { name: "Save" }).click();
await panel.getByText("✓ Rerouted").waitFor();
await panel.getByRole("button", { name: "Correct severity" }).click();
await panel.getByLabel("Critical").check();
await panel.getByLabel(/Reason/).fill("Children crossing at drop-off; lane hazard is immediate.");
await panel.getByRole("button", { name: "Save" }).click();
await panel.getByText("✓ Severity corrected").waitFor();
await panel.getByRole("button", { name: "Acknowledge" }).click();
await panel.getByText("✓ Acknowledged").waitFor();
await panel.getByRole("button", { name: "Start work (In progress)" }).click();
await panel.getByText("✓ Moved to In progress").waitFor();
await panel.getByRole("button", { name: "Resolve", exact: true }).click();
await panel.getByLabel(/Resolution note/).fill("Drain cleared and pothole patched; lane reopened.");
await panel.getByRole("button", { name: "Save" }).click();
await panel.getByText("✓ Resolved").waitFor();
const history = await panel.locator('section[aria-labelledby="h-activity"]').innerText();
check("5. Activity history records reroute, severity correction and status changes with actor", /rerouted/.test(history) && /corrected severity/.test(history) && (history.match(/changed status/g) ?? []).length >= 3 && /Dana Okafor/.test(history), history.slice(0, 900).replace(/\n/g, " | "));
await d.screenshot({ path: path.join(OUT, "06-officer-after-resolve.png"), fullPage: false });

await m.goto(r1.url);
const trackAfter = await m.locator("main").innerText();
check("5. Citizen tracking shows reroute + resolution, hides internal reasons", /Resolved/.test(trackAfter) && /Drain cleared and pothole patched/.test(trackAfter) && /Reassigned to Stormwater Drainage/.test(trackAfter) && !/drainage crew first/.test(trackAfter) && !/Children crossing/.test(trackAfter));
await m.goto(r2.url);
check("5. Second reporter also sees the resolution", /Drain cleared and pothole patched/.test(await m.locator("main").innerText()));
await m.goto(r1.url);
await m.screenshot({ path: path.join(OUT, "07-citizen-tracking-resolved-mobile.png"), fullPage: true });

// Citizen answers the location question on the photo-only report
await m.goto(r4.url);
await m.getByLabel("Street or nearby landmark").first().fill("Riverside Market");
await m.getByRole("button", { name: "Send answer" }).click();
await m.waitForFunction(() => !/the city needs a detail from you/i.test(document.body.innerText), null, { timeout: 15000 });
const ans = await m.locator("main").innerText();
check("Citizen can answer a location request", /Riverside Market/.test(ans), ans.slice(0, 900).replace(/\n/g, " | "));

// Pin → ticket (map selection opens ticket)
await d.goto(`${BASE}/officer`);
await d.locator('[aria-label="Tickets"] li').first().waitFor();
await d.waitForTimeout(2000);
const pin = d.locator('button[aria-label^="T-"][aria-label*="Critical"]').first();
const pinBoxes = await d.locator('button[aria-label^="T-"]').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return `${Math.round(r.x)},${Math.round(r.y)}`; }));
check("Map pins are placed at distinct positions", new Set(pinBoxes).size === pinBoxes.length && pinBoxes.length >= 8, `${pinBoxes.length} pins`);
await pin.click();
await d.locator("article h2").waitFor();
check("Desktop: clicking a pin opens its ticket", (await d.locator("article").innerText()).includes((await pin.getAttribute("aria-label")).split(",")[0]));

// ── Flow 6: access controls
const anon = await browser.newContext();
const a = await anon.newPage();
const api = await a.request.get(`${BASE}/api/officer/tickets`);
check("6. Officer API rejects unauthenticated requests", api.status() === 401, `status ${api.status()}`);
const photoPath = realPhotoSrc;
const ph = await a.request.get(`${BASE}${photoPath}`);
check("6. Private photo URL rejects unauthenticated requests", ph.status() === 401, `${photoPath} → ${ph.status()}`);
const forged = await a.request.get(`${BASE}/api/track/${"x".repeat(43)}`);
check("6. Unrelated/forged tracking token is not found", forged.status() === 404);
await a.goto(`${BASE}/track/${"Q".repeat(43)}`);
check("6. Forged tracking page shows not-found", /couldn.t find that report/i.test(await a.locator("main").innerText()));
const uploadsDirect = await a.request.get(`${BASE}/storage/uploads`);
check("6. Upload storage is not publicly served", uploadsDirect.status() === 404);

// ── Flow 7: officer mobile tabs
const mo = await browser.newContext({ ...devices["Pixel 7"], storageState: await desk.storageState() });
const mp = await mo.newPage();
await mp.goto(`${BASE}/officer`);
await mp.locator('[aria-label="Tickets"] li').first().waitFor();
await mp.screenshot({ path: path.join(OUT, "08-officer-mobile-queue.png") });
await mp.getByRole("tab", { name: "Map" }).click();
await mp.waitForTimeout(2000);
await mp.screenshot({ path: path.join(OUT, "09-officer-mobile-map.png") });
check("7. Officer mobile: queue/map tabs switch", await mp.locator('section[aria-label="Ward map"]').isVisible());
const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check("7. Citizen pages have no horizontal overflow on mobile", !overflow);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
