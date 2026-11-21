"use client";
import dynamic from "next/dynamic";
import type { PickedLocation } from "./location-types";
import { googleMapsEnabled } from "./google";

const Offline = dynamic(() => import("./LocationPicker").then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-2xl bg-night sm:h-80" aria-label="Loading map" />,
});
const Google = dynamic(() => import("./GoogleLocationPicker").then((m) => m.GoogleLocationPicker), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-2xl bg-night sm:h-80" aria-label="Loading map" />,
});

/** Google Maps when a browser key is configured; otherwise the offline sample-city map. */
export function LocationField(props: { value: PickedLocation; onChange: (v: PickedLocation) => void; error?: string; idPrefix?: string }) {
  return googleMapsEnabled() ? <Google {...props} /> : <Offline {...props} />;
}
