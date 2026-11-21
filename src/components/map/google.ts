"use client";
/**
 * Google Maps JavaScript API loader (browser key only; restrict it by HTTP referrer and API — see README).
 * English-only UI. If the key is missing or Google rejects it, callers fall back to manual entry.
 */
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

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
  setOptions({ key: GOOGLE_KEY, v: "weekly", language: "en", mapIds: [GOOGLE_MAP_ID] });
  const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Google Maps took too long to load")), 15000));
  pending = Promise.race([
    Promise.all([importLibrary("maps"), importLibrary("marker"), importLibrary("places")]).then(([maps, marker, places]) => ({ maps, marker, places })),
    timeout,
  ]).catch((e) => {
    pending = null;
    throw e;
  });
  return pending;
}

export type WardsPayload = { sample: boolean; geojson: GeoJSON.FeatureCollection };
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

export function styleWards(map: google.maps.Map, fc: GeoJSON.FeatureCollection) {
  map.data.addGeoJson(fc);
  map.data.setStyle({ strokeColor: "#9aa7b4", strokeWeight: 1.5, strokeOpacity: 0.9, fillColor: "#cdeb3f", fillOpacity: 0.04, clickable: false });
}
