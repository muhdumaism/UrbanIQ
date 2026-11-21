/** Ward lookup, distances and landmark geocoding against the SAMPLE geography. Client-safe. */
import wardsData from "../../data/wards.json";
import landmarksData from "../../data/landmarks.json";
import cityData from "../../data/city.json";

type Ring = [number, number][];
export type WardFeature = { properties: { code: string; name: string; label: string }; geometry: { coordinates: Ring[] } };

export const WARDS = wardsData as unknown as { type: "FeatureCollection"; features: WardFeature[] };
export const LANDMARKS = landmarksData as { name: string; aliases: string[]; lat: number; lng: number; wardCode: string | null }[];
export const CITY = cityData as { name: string; note: string; center: [number, number]; bounds: [[number, number], [number, number]] };

export const WARD_LIST = WARDS.features.map((f) => ({ code: f.properties.code, name: f.properties.name, label: f.properties.label }));

export function wardLabel(code: string | null | undefined) {
  if (!code) return null;
  return WARD_LIST.find((w) => w.code === code)?.label ?? code;
}

export function pointInRing(lng: number, lat: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Returns the ward code containing the point, or null when outside all sample wards. */
export function wardForPoint(lat: number, lng: number, wards: WardFeature[] = WARDS.features): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  for (const f of wards) {
    const [outer, ...holes] = f.geometry.coordinates;
    if (pointInRing(lng, lat, outer) && !holes.some((h) => pointInRing(lng, lat, h))) return f.properties.code;
  }
  return null;
}

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Match free text against known sample landmarks. Longest alias wins to avoid "school" beating "alder primary school". */
export function findLandmark(...texts: (string | null | undefined)[]) {
  const hay = ` ${norm(texts.filter(Boolean).join(" "))} `;
  let best: { lm: (typeof LANDMARKS)[number]; len: number } | null = null;
  for (const lm of LANDMARKS) {
    for (const alias of [lm.name, ...lm.aliases]) {
      const a = norm(alias);
      // bare generic words ("school", "park") are too vague to geocode
      if (a.split(" ").length < 2 && a.length < 8) continue;
      if (hay.includes(` ${a} `) && (!best || a.length > best.len)) best = { lm, len: a.length };
    }
  }
  return best?.lm ?? null;
}

export function inCityBounds(lat: number, lng: number) {
  const [[w, s], [e, n]] = CITY.bounds;
  return lng >= w && lng <= e && lat >= s && lat <= n;
}
