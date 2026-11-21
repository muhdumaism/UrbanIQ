/**
 * TEST STUB of the private vision service contract (POST /v1/detect) — NOT the YOLO model.
 * Picks a deterministic detection from the uploaded image's width so UI tests can cover every
 * issue type: 801 pothole · 802 water_leak · 803 fallen_tree · 804 garbage · 805 streetlight ·
 * 899 → 503 (model not loaded). Anything else → inconclusive (no detections).
 */
import http from "http";
import { createRequire } from "module";
const sharp = createRequire(import.meta.url)("sharp");

const PORT = Number(process.env.PORT ?? 8099);
const TOKEN = process.env.VISION_TOKEN ?? "stub-token";
const BY_WIDTH = { 801: ["pothole", "pothole"], 802: ["water_leak", "water_leak"], 803: ["fallen_tree", "fallen_tree"], 804: ["garbage", "garbage"], 805: ["streetlight", "broken_streetlight"] };

http
  .createServer(async (req, res) => {
    const send = (code, body) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.url === "/healthz") return send(200, { ok: true, model: "stub" });
    if (req.method !== "POST" || req.url !== "/v1/detect") return send(404, { detail: "not found" });
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { detail: "Unauthorized" });
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const form = await new Request("http://x", { method: "POST", headers: { "content-type": req.headers["content-type"] }, body: Buffer.concat(chunks) }).formData();
    const file = form.get("image");
    const meta = await sharp(Buffer.from(await file.arrayBuffer())).metadata();
    if (meta.width === 899) return send(503, { detail: "Model not ready: missing" });
    const hit = BY_WIDTH[meta.width];
    send(200, {
      model: { name: "vision-stub (not the YOLO checkpoint)", sha256: null },
      image: { width: meta.width, height: meta.height },
      detections: hit ? [{ label: hit[0], mapped: hit[1], confidence: 0.87, box: { x1: meta.width * 0.2, y1: meta.height * 0.3, x2: meta.width * 0.7, y2: meta.height * 0.8 } }] : [],
      inference_ms: 1,
    });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`vision stub on :${PORT}`));
