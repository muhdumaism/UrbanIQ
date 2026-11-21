/** Service regions (client-safe). UrbanIQ is configured for India by default (SERVICE_REGION=IN). */
export type ServiceRegion = {
  code: string;
  name: string;
  /** Coarse bounding box used for map restriction and server-side validation. */
  bounds: { south: number; west: number; north: number; east: number };
  center: { lat: number; lng: number };
  zoom: number;
};

export const REGIONS: Record<string, ServiceRegion> = {
  IN: {
    code: "IN",
    name: "India",
    // Mainland + Andaman & Nicobar + Lakshadweep. A bounding box, so it also covers some
    // neighbouring border areas; Places search is additionally restricted to India.
    bounds: { south: 6.4, west: 68.0, north: 37.6, east: 97.5 },
    center: { lat: 22.5, lng: 79.0 },
    zoom: 5,
  },
};

export function inRegion(r: ServiceRegion | null | undefined, lat: number, lng: number) {
  if (!r) return true;
  const b = r.bounds;
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
}
