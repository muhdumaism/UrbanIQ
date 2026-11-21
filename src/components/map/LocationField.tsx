"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { PickedLocation } from "./location-types";
import { fetchWards, googleMapsEnabled } from "./google";

const Offline = dynamic(() => import("./LocationPicker").then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-2xl bg-night sm:h-80" aria-label="Loading map" />,
});
const Google = dynamic(() => import("./GoogleLocationPicker").then((m) => m.GoogleLocationPicker), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-2xl bg-night sm:h-80" aria-label="Loading map" />,
});

/**
 * Google Maps when a browser key is configured. Without a key, the offline map is only meaningful for
 * the fictional sample city; for real regions the Google picker degrades to search-free manual entry
 * plus "Use my location".
 */
export function LocationField(props: { value: PickedLocation; onChange: (v: PickedLocation) => void; error?: string; idPrefix?: string }) {
  const [offline, setOffline] = useState<boolean | null>(googleMapsEnabled() ? false : null);
  useEffect(() => {
    if (offline !== null) return;
    fetchWards()
      .then((w) => setOffline(w.mode === "sample"))
      .catch(() => setOffline(false));
  }, [offline]);
  if (offline === null) return <div className="h-64 animate-pulse rounded-2xl bg-night sm:h-80" aria-label="Loading map" />;
  return offline ? <Offline {...props} /> : <Google {...props} />;
}
