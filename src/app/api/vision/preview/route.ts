import { NextResponse } from "next/server";
import { analyzePhoto } from "@/lib/vision";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { jsonError, sameOrigin, serverError } from "@/lib/http";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Plain-language names shown to the citizen for each detector issue type. */
const FRIENDLY: Record<string, string> = {
  pothole: "a pothole",
  fallen_tree: "a fallen tree",
  garbage: "garbage on the road",
  water_leak: "a water leak",
  broken_streetlight: "a broken streetlight",
};

/**
 * Instant, advisory photo check for the report form. The photo is analysed and discarded
 * (nothing is stored). The authoritative check still runs in the background triage job on the
 * stored, EXIF-stripped photo, and that result is what officers see on the ticket.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "Cross-site requests are not allowed.");
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES + 64 * 1024) return jsonError(413, "Photos must be 10 MB or smaller.");
  const rl = rateLimit(`vision-preview:${clientIp(req)}`, 30, 10 * 60_000);
  if (!rl.ok) return jsonError(429, `Too many photo checks. Try again in ${rl.retryAfter} seconds.`);

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("photo");
    file = f instanceof File ? f : null;
  } catch {
    return jsonError(400, "We couldn't read the photo.");
  }
  if (!file || file.size === 0) return jsonError(400, "No photo was sent.");
  if (!TYPES.includes(file.type)) return jsonError(415, "Photos must be JPEG, PNG or WebP.");
  if (file.size > MAX_BYTES) return jsonError(413, "Photos must be 10 MB or smaller.");

  try {
    const result = await analyzePhoto({ data: Buffer.from(await file.arrayBuffer()), mime: file.type });
    const top = result.top;
    const message =
      result.status === "detected" && top?.issueType
        ? `This looks like ${FRIENDLY[top.issueType] ?? top.issueType.replace(/_/g, " ")} (${Math.round(top.confidence * 100)}% match).`
        : result.status === "inconclusive"
          ? "We couldn't recognise the issue from the photo. Please describe it below."
          : null; // not configured / offline: show nothing, the form works as before
    return NextResponse.json({
      status: result.status,
      message,
      top: top ? { issueType: top.issueType, label: top.label, confidence: top.confidence } : null,
    });
  } catch (e) {
    return serverError(e);
  }
}
