import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { processPhoto, PhotoError, MAX_PHOTO_BYTES } from "./photo";
import { newPhotoKey, storage } from "./storage";
import { newReportReference, sha256, trackingTokenFor } from "./tokens";
import { enqueueTriage } from "./jobs";

export const MAX_TEXT = 4000;

const FieldsSchema = z
  .object({
    idempotencyKey: z.string().regex(/^[A-Za-z0-9-]{16,64}$/, "Missing submission key. Please reload the page."),
    text: z.string().max(MAX_TEXT, `Please keep the description under ${MAX_TEXT} characters.`).optional().default(""),
    locationText: z.string().max(200, "Please keep the landmark under 200 characters.").optional().default(""),
    locationSource: z.enum(["DEVICE", "PIN", "LANDMARK", "NONE"]).default("NONE"),
    locationConfirmed: z.enum(["true", "false"]).default("false"),
    lat: z.string().optional(),
    lng: z.string().optional(),
    placeId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{10,300}$/, "Invalid place selection.")
      .optional()
      .or(z.literal("")),
  })
  .transform((v) => ({ ...v, text: v.text.trim(), locationText: v.locationText.trim() }));

export type FieldErrors = Partial<Record<"text" | "photo" | "location" | "form", string>>;
export class IntakeError extends Error {
  constructor(public fieldErrors: FieldErrors, public status = 400) {
    super("Validation failed");
  }
}

export type IntakeResult = { reference: string; token: string; duplicate: boolean };

export async function createReportFromForm(form: FormData): Promise<IntakeResult> {
  const raw = Object.fromEntries(
    ["idempotencyKey", "text", "locationText", "locationSource", "locationConfirmed", "lat", "lng", "placeId"].map((k) => [k, form.get(k)?.toString() ?? undefined]),
  );
  const parsed = FieldsSchema.safeParse(raw);
  if (!parsed.success) {
    const errs: FieldErrors = {};
    for (const i of parsed.error.issues) {
      const key = i.path[0] === "text" ? "text" : i.path[0] === "locationText" ? "location" : "form";
      errs[key] ??= i.message;
    }
    throw new IntakeError(errs);
  }
  const f = parsed.data;

  // Idempotency: a retry or double tap returns the original report.
  const existing = await prisma.report.findUnique({ where: { idempotencyKey: f.idempotencyKey } });
  if (existing) return { reference: existing.reference, token: trackingTokenFor(existing.id), duplicate: true };

  const file = form.get("photo");
  const hasPhoto = file instanceof File && file.size > 0;
  if (!f.text && !hasPhoto) throw new IntakeError({ text: "Describe the issue, add a photo, or both." });
  if (f.text && f.text.replace(/\s/g, "").length < 3 && !hasPhoto) throw new IntakeError({ text: "Please add a few more words about the issue." });

  let lat: number | null = null;
  let lng: number | null = null;
  if (f.lat && f.lng) {
    lat = Number(f.lat);
    lng = Number(f.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new IntakeError({ location: "That map location isn't valid. Please drop the pin again." });
    }
    // Out-of-area pins are accepted and sent to officer review (never silently dropped).
  }
  const confirmed = f.locationConfirmed === "true" && lat != null;
  const source = lat != null ? (f.locationSource === "DEVICE" ? "DEVICE" : "PIN") : f.locationText ? "LANDMARK" : "NONE";

  let photo: Awaited<ReturnType<typeof processPhoto>> | null = null;
  if (hasPhoto) {
    if (file.size > MAX_PHOTO_BYTES) throw new IntakeError({ photo: "Photos must be 10 MB or smaller." });
    try {
      photo = await processPhoto(Buffer.from(await file.arrayBuffer()));
    } catch (e) {
      if (e instanceof PhotoError) throw new IntakeError({ photo: e.message });
      throw e;
    }
  }

  const id = randomUUID();
  const token = trackingTokenFor(id);
  const photoKey = photo ? newPhotoKey(photo.ext) : null;
  if (photo && photoKey) await storage().put(photoKey, photo.data, photo.mime);

  // The original report is saved (with its job) before any AI processing happens.
  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = newReportReference();
    try {
      await prisma.$transaction(async (tx) => {
        await tx.report.create({
          data: {
            id,
            reference,
            trackingTokenHash: sha256(token),
            idempotencyKey: f.idempotencyKey,
            text: f.text || null,
            photoKey,
            photoMime: photo?.mime ?? null,
            photoWidth: photo?.width ?? null,
            photoHeight: photo?.height ?? null,
            photoFingerprint: photo?.originalSha256 ?? null,
            lat,
            lng,
            locationText: f.locationText || null,
            locationSource: source,
            locationConfirmed: confirmed,
            locationPlaceId: f.placeId || null,
          },
        });
        await enqueueTriage(tx, id);
      });
      return { reference, token, duplicate: false };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = String((e.meta as { target?: unknown })?.target ?? "");
        if (target.includes("idempotencyKey")) {
          if (photoKey) await storage().delete(photoKey).catch(() => {});
          const winner = await prisma.report.findUniqueOrThrow({ where: { idempotencyKey: f.idempotencyKey } });
          return { reference: winner.reference, token: trackingTokenFor(winner.id), duplicate: true };
        }
        if (target.includes("reference")) continue; // reference collision: try another code
      }
      if (photoKey) await storage().delete(photoKey).catch(() => {});
      throw e;
    }
  }
  throw new Error("Could not allocate a report reference");
}
