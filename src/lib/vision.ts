/**
 * Client for the private photo-analysis service (AI Civic Guardian YOLO checkpoint, see /vision).
 * Detections are ADVISORY evidence for officers. Vision never sets severity, routing or status;
 * when the service is missing, offline or inconclusive, triage continues with text + location.
 */
import { z } from "zod";
import { env } from "./env";
import type { Subtype } from "./taxonomy";

export const VISION_ISSUE_TYPES = ["broken_streetlight", "water_leak", "fallen_tree", "garbage", "pothole"] as const;
export type VisionIssueType = (typeof VISION_ISSUE_TYPES)[number];

/** Verified detector labels → UrbanIQ subtypes (fixed taxonomy). */
export const VISION_TO_SUBTYPE: Record<VisionIssueType, Subtype> = {
  broken_streetlight: "streetlight_out",
  water_leak: "water_leak",
  fallen_tree: "fallen_tree",
  garbage: "garbage",
  pothole: "pothole",
};

const Box = z.object({ x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() });

/** Wire format returned by vision/app.py (validated; anything else is treated as an error). */
export const VisionResponseSchema = z.object({
  model: z.object({ name: z.string(), sha256: z.string().nullable().optional(), framework: z.string().optional() }),
  image: z.object({ width: z.number().positive(), height: z.number().positive() }),
  detections: z
    .array(
      z.object({
        label: z.string().max(64),
        mapped: z.enum(VISION_ISSUE_TYPES).nullable(),
        confidence: z.number().min(0).max(1),
        box: Box,
      }),
    )
    .max(100),
  inference_ms: z.number().optional(),
});

export type VisionStatus = "not_configured" | "no_photo" | "unavailable" | "error" | "inconclusive" | "detected";

export type VisionDetection = {
  label: string;
  issueType: VisionIssueType | null;
  subtype: Subtype | null;
  confidence: number;
  /** Bounding box normalised to 0–1 of the stored (EXIF-stripped) image. */
  box: { x: number; y: number; w: number; h: number };
};

export type VisionEvidence = {
  status: VisionStatus;
  message: string;
  checkedAt: string;
  threshold: number;
  model: { name: string; sha256: string | null } | null;
  detections: VisionDetection[];
  /** Highest-confidence mapped detection at or above the threshold. */
  top: VisionDetection | null;
};

export function visionConfigured() {
  return Boolean(env().VISION_URL);
}

function evidence(status: VisionStatus, message: string, extra: Partial<VisionEvidence> = {}): VisionEvidence {
  return { status, message, checkedAt: new Date().toISOString(), threshold: env().VISION_MIN_CONFIDENCE, model: null, detections: [], top: null, ...extra };
}

/** Pure: turn a validated service response into stored evidence. */
export function interpretVision(res: z.infer<typeof VisionResponseSchema>, threshold: number): VisionEvidence {
  const { width, height } = res.image;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const detections: VisionDetection[] = res.detections
    .map((d) => ({
      label: d.label,
      issueType: d.mapped,
      subtype: d.mapped ? VISION_TO_SUBTYPE[d.mapped] : null,
      confidence: +d.confidence.toFixed(3),
      box: {
        x: clamp(d.box.x1 / width),
        y: clamp(d.box.y1 / height),
        w: clamp((d.box.x2 - d.box.x1) / width),
        h: clamp((d.box.y2 - d.box.y1) / height),
      },
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10);
  const top = detections.find((d) => d.issueType && d.confidence >= threshold) ?? null;
  const model = { name: res.model.name, sha256: res.model.sha256 ?? null };
  if (!top) {
    const best = detections[0];
    return evidence("inconclusive", best ? `No mapped detection at or above ${Math.round(threshold * 100)}% (best: ${best.label} ${Math.round(best.confidence * 100)}%).` : "No objects detected.", { model, detections, threshold });
  }
  return evidence("detected", `Detector suggests ${top.issueType!.replace(/_/g, " ")} (${Math.round(top.confidence * 100)}%).`, { model, detections, top, threshold });
}

export async function analyzePhoto(photo: { data: Buffer; mime: string } | null): Promise<VisionEvidence> {
  if (!photo) return evidence("no_photo", "No photo attached.");
  const e = env();
  if (!e.VISION_URL) return evidence("not_configured", "Photo analysis is not configured; triage used text and location only.");
  const form = new FormData();
  form.set("image", new Blob([new Uint8Array(photo.data)], { type: photo.mime }), "photo");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), e.VISION_TIMEOUT_MS);
  try {
    const res = await fetch(`${e.VISION_URL.replace(/\/$/, "")}/v1/detect`, {
      method: "POST",
      body: form,
      signal: ctrl.signal,
      headers: e.VISION_TOKEN ? { Authorization: `Bearer ${e.VISION_TOKEN}` } : {},
    });
    if (res.status === 503) return evidence("unavailable", "Photo analysis service is up but the model is not loaded.");
    if (!res.ok) return evidence("error", `Photo analysis service returned HTTP ${res.status}.`);
    const parsed = VisionResponseSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) return evidence("error", "Photo analysis service returned an invalid response.");
    return interpretVision(parsed.data, e.VISION_MIN_CONFIDENCE);
  } catch (err) {
    const aborted = (err as Error).name === "AbortError";
    return evidence("unavailable", aborted ? "Photo analysis timed out." : "Photo analysis service is offline.");
  } finally {
    clearTimeout(timer);
  }
}

export function parseStoredVision(v: unknown): VisionEvidence | null {
  if (!v || typeof v !== "object" || !("status" in v)) return null;
  return v as VisionEvidence;
}
