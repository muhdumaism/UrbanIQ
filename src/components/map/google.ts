"use client";
/**
 * Google Maps JavaScript API loader (browser key only; restrict it by HTTP referrer and API — see README).
 * English-only UI. If the key is missing or Google rejects it, callers fall back to manual entry.
 */
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { inRegion, type ServiceRegion } from "@/lib/region";

export const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
export const GOOGLE_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
export const googleMapsEnabled = () => GOOGLE_KEY.length > 0;

type Libs = {
  maps: google.maps.MapsLibrary;
  marker: google.maps.MarkerLibrary;
  places: google.maps.PlacesLibrary;
};

let pending: Promise<Libs> | null = null;
let authFailed = false;

export function loadGoogleMaps(): Promise<Libs> {
  if (!googleMapsEnabled()) return Promise.reject(new Error("Google Maps key not configured"));
  if (authFailed) return Promise.reject(new Error("Google Maps rejected the API key"));
  if (pending) return pending;
  // Google calls this global when the key is invalid or not authorised for this site.
  (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
    authFailed = true;
    window.dispatchEvent(new Event("civicflow:maps-auth-failed"));
  };
  const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Google Maps took too long to load")), 15000));
  pending = Promise.race([
    fetchWards()
      .catch(() => null)
      .then((w) => {
        // region=IN: India-specific map borders and place results.
        setOptions({ key: GOOGLE_KEY, v: "weekly", language: "en", mapIds: [GOOGLE_MAP_ID], ...(w?.region ? { region: w.region.code } : {}) });
        return Promise.all([importLibrary("maps"), importLibrary("marker"), importLibrary("places")]);
      })
      .then(([maps, marker, places]) => ({ maps, marker, places })),
    timeout,
  ]).catch((e) => {
    pending = null;
    throw e;
  });
  return pending;
}

export type WardsPayload = {
  sample: boolean;
  mode: "sample" | "custom" | "none";
  geojson: GeoJSON.FeatureCollection;
  center: google.maps.LatLngLiteral | null;
  zoom: number;
  region: ServiceRegion | null;
};

/** Map options that keep the view inside the service region (India). */
export function regionMapOptions(w: WardsPayload): Partial<google.maps.MapOptions> {
  if (!w.region) return {};
  const pad = 2;
  const b = w.region.bounds;
  return { restriction: { latLngBounds: { south: b.south - pad, west: b.west - pad, north: b.north + pad, east: b.east + pad }, strictBounds: false }, minZoom: 4 };
}

export const pointInServiceRegion = (w: WardsPayload | null, lat: number, lng: number) => inRegion(w?.region, lat, lng);
let wardsPromise: Promise<WardsPayload> | null = null;
export function fetchWards() {
  wardsPromise ??= fetch("/api/wards").then((r) => {
    if (!r.ok) throw new Error("wards");
    return r.json();
  });
  return wardsPromise;
}

/** Client-side preview only; the server re-checks confirmed coordinates against configured wards. */
export function wardFromGeojson(fc: GeoJSON.FeatureCollection, lat: number, lng: number): { code: string; label: string } | null {
  const inRing = (ring: number[][]) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  for (const f of fc.features) {
    const g = f.geometry;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    if (polys.some(([outer, ...holes]) => inRing(outer) && !holes.some(inRing))) {
      const p = f.properties as { code: string; name: string };
      return { code: p.code, label: `${p.code} · ${p.name}` };
    }
  }
  return null;
}

export function wardsBounds(fc: GeoJSON.FeatureCollection) {
  const b = new google.maps.LatLngBounds();
  for (const f of fc.features) {
    const g = f.geometry;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const p of polys) for (const [lng, lat] of p[0]) b.extend({ lat, lng });
  }
  return b;
}

/**
 * Initial view: fit the wards when configured; otherwise fit the given points (e.g. ticket pins),
 * then MAP_DEFAULT_CENTER, then a world view.
 */
export function setInitialView(map: google.maps.Map, w: WardsPayload, points: google.maps.LatLngLiteral[] = []) {
  if (w.geojson.features.length) return map.fitBounds(wardsBounds(w.geojson), 24);
  if (points.length > 1) {
    const b = new google.maps.LatLngBounds();
    points.forEach((p) => b.extend(p));
    return map.fitBounds(b, 48);
  }
  if (points.length === 1) {
    map.setCenter(points[0]);
    return map.setZoom(15);
  }
  map.setCenter(w.center ?? { lat: 20, lng: 0 });
  map.setZoom(w.center ? w.zoom : 2);
}

export function styleWards(map: google.maps.Map, fc: GeoJSON.FeatureCollection) {
  map.data.addGeoJson(fc);
  map.data.setStyle({ strokeColor: "#9aa7b4", strokeWeight: 1.5, strokeOpacity: 0.9, fillColor: "#cdeb3f", fillOpacity: 0.04, clickable: false });
}
