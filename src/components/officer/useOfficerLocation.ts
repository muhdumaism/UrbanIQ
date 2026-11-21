"use client";
import { useCallback, useEffect, useState } from "react";

export type OfficerLocation =
  | { status: "locating" | "denied" | "unavailable" | "idle"; pos: null }
  | { status: "ok"; pos: { lat: number; lng: number; accuracy: number } };

/**
 * Detects where the officer is working from (browser geolocation). The position stays in the
 * browser: it is used to centre the map and measure distances, and is never sent to the server.
 */
export function useOfficerLocation() {
  const [loc, setLoc] = useState<OfficerLocation>({ status: "idle", pos: null });
  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) return setLoc({ status: "unavailable", pos: null });
    setLoc({ status: "locating", pos: null });
    navigator.geolocation.getCurrentPosition(
      (p) => setLoc({ status: "ok", pos: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy } }),
      (err) => setLoc({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable", pos: null }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60_000 },
    );
  }, []);
  useEffect(() => {
    locate();
  }, [locate]);
  return { loc, locate };
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const t = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(t(b.lat - a.lat) / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(t(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
