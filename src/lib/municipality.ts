/**
 * Municipality-configured geography (server-side source of truth).
 * WARDS_GEOJSON_PATH: FeatureCollection of Polygon/MultiPolygon wards with properties { code, name }.
 * LANDMARKS_JSON_PATH: optional gazetteer [{ name, aliases[], lat, lng, wardCode }].
 * Without them, UrbanIQ uses the clearly labelled SAMPLE wards of the fictional city of Port Alder.
 */
import fs from "fs";
import path from "path";
import { z } from "zod";
import { env } from "./env";
import { LANDMARKS, WARDS, findLandmark as findSampleLandmark, pointInRing, type WardFeature } from "./geo";

const Ring = z.array(z.tuple([z.number(), z.number()]).rest(z.number())).min(4);
const WardFile = z.object({
  type: z.literal("FeatureCollection"),
  features: z
    .array(
      z.object({
        properties: z.object({ code: z.string().min(1).max(20), name: z.string().min(1).max(80) }).passthrough(),
        geometry: z.discriminatedUnion("type", [
          z.object({ type: z.literal("Polygon"), coordinates: z.array(Ring).min(1) }),
          z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(z.array(Ring).min(1)).min(1) }),
        ]),
      }),
    )
    .min(1),
});
const LandmarkFile = z.array(z.object({ name: z.string(), aliases: z.array(z.string()).default([]), lat: z.number(), lng: z.number(), wardCode: z.string().nullable() }));

type Polygon = [number, number][][];
type Ward = { code: string; name: string; label: string; polygons: Polygon[] };
type Muni = { sample: boolean; wards: Ward[]; geojson: unknown; landmarks: typeof LANDMARKS };

let cached: Muni | null = null;

export function municipality(): Muni {
  if (cached) return cached;
  const p = env().WARDS_GEOJSON_PATH;
  if (!p) {
    cached = {
      sample: true,
      wards: WARDS.features.map((f: WardFeature) => ({ code: f.properties.code, name: f.properties.name, label: f.properties.label, polygons: [f.geometry.coordinates] })),
      geojson: WARDS,
      landmarks: LANDMARKS,
    };
    return cached;
  }
  const raw = JSON.parse(fs.readFileSync(path.resolve(p), "utf8"));
  const parsed = WardFile.parse(raw);
  const lp = process.env.LANDMARKS_JSON_PATH;
  cached = {
    sample: false,
    wards: parsed.features.map((f) => ({
      code: f.properties.code,
      name: f.properties.name,
      label: `${f.properties.code} · ${f.properties.name}`,
      polygons: (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Polygon[],
    })),
    geojson: raw,
    landmarks: lp ? LandmarkFile.parse(JSON.parse(fs.readFileSync(path.resolve(lp), "utf8"))) : [],
  };
  return cached;
}

/** Server-side ward match for confirmed coordinates. null = outside every configured ward. */
export function wardForPoint(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  for (const w of municipality().wards) {
    for (const [outer, ...holes] of w.polygons) {
      if (pointInRing(lng, lat, outer) && !holes.some((h) => pointInRing(lng, lat, h))) return w.code;
    }
  }
  return null;
}

export function wardLabel(code: string | null | undefined) {
  if (!code) return null;
  return municipality().wards.find((w) => w.code === code)?.label ?? code;
}

export function findLandmark(...texts: (string | null | undefined)[]) {
  const m = municipality();
  if (m.sample) return findSampleLandmark(...texts);
  const hay = ` ${texts.filter(Boolean).join(" ").toLowerCase()} `;
  return m.landmarks.find((l) => [l.name, ...l.aliases].some((a) => a.length >= 6 && hay.includes(a.toLowerCase()))) ?? null;
}

/** Public, cacheable description of the configured wards for maps. */
export function wardsForClient() {
  const m = municipality();
  return { sample: m.sample, geojson: m.geojson };
}
