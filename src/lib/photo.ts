import sharp, { type Metadata, type OutputInfo } from "sharp";
import crypto from "crypto";

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

export class PhotoError extends Error {}

function sniff(buf: Buffer): keyof typeof ALLOWED | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export type ProcessedPhoto = {
  data: Buffer;
  mime: string;
  ext: string;
  width: number;
  height: number;
  /** sha256 of the original upload, used by the demo adapter to recognise sample photos */
  originalSha256: string;
};

/**
 * Validates by magic bytes AND by fully decoding the image, then re-encodes it.
 * Re-encoding without `withMetadata()` drops EXIF (incl. GPS), XMP, ICC comments etc.
 */
export async function processPhoto(input: Buffer): Promise<ProcessedPhoto> {
  if (input.length === 0) throw new PhotoError("The photo file is empty.");
  if (input.length > MAX_PHOTO_BYTES) throw new PhotoError("Photos must be 10 MB or smaller.");
  const kind = sniff(input);
  if (!kind) throw new PhotoError("Photos must be JPEG, PNG or WebP images.");
  let meta: Metadata;
  try {
    meta = await sharp(input, { failOn: "error", limitInputPixels: 50_000_000 }).metadata();
  } catch {
    throw new PhotoError("We couldn't read that image. Please try another photo.");
  }
  if (meta.format !== kind && !(kind === "jpeg" && meta.format === "jpeg")) {
    throw new PhotoError("The file contents don't match a supported image type.");
  }
  const pipeline = sharp(input, { failOn: "error", limitInputPixels: 50_000_000 })
    .rotate() // apply EXIF orientation before it is stripped
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true });
  let out: { data: Buffer; info: OutputInfo };
  try {
    out =
      kind === "png"
        ? await pipeline.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
        : kind === "webp"
          ? await pipeline.webp({ quality: 85 }).toBuffer({ resolveWithObject: true })
          : await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  } catch {
    throw new PhotoError("We couldn't process that image. Please try another photo.");
  }
  return {
    data: out.data,
    mime: ALLOWED[kind],
    ext: kind === "jpeg" ? "jpg" : kind,
    width: out.info.width,
    height: out.info.height,
    originalSha256: crypto.createHash("sha256").update(input).digest("hex"),
  };
}
