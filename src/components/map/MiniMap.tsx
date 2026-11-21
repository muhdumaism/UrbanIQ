"use client";
import { useEffect, useRef, useState } from "react";
import { StaticCityMap } from "../StaticCityMap";
import { GOOGLE_MAP_ID, googleMapsEnabled, loadGoogleMaps } from "./google";

/** Small read-only location map: Google when configured, otherwise the offline sample-city drawing. */
export function MiniMap({ lat, lng, label, className = "h-40 w-full" }: { lat: number; lng: number; label: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(!googleMapsEnabled());
  useEffect(() => {
    if (failed) return;
    let live = true;
    loadGoogleMaps()
      .then(({ maps, marker }) => {
        if (!live || !box.current) return;
        const map = new maps.Map(box.current, { mapId: GOOGLE_MAP_ID, colorScheme: "DARK", center: { lat, lng }, zoom: 16, disableDefaultUI: true, gestureHandling: "none", keyboardShortcuts: false, clickableIcons: false });
        new marker.AdvancedMarkerElement({ map, position: { lat, lng } });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [lat, lng, failed]);
  if (failed) return <StaticCityMap className={className} pins={[{ lat, lng, ring: true, color: "#ff6b1a" }]} focus={{ lat, lng, zoom: 3 }} label={label} />;
  return <div ref={box} className={className} role="img" aria-label={label} />;
}
