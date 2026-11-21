"use client";
import { useEffect, useState } from "react";
import { googleMapsEnabled, loadGoogleMaps } from "./google";

/**
 * Shows the name of the Google place a citizen picked. Only the Place ID is stored; the name is
 * fetched live from Google for display (with attribution), in line with Google's caching terms.
 */
export function GooglePlaceName({ placeId }: { placeId: string }) {
  const [name, setName] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!googleMapsEnabled()) return setFailed(true);
    let live = true;
    loadGoogleMaps()
      .then(async ({ places }) => {
        const place = new places.Place({ id: placeId });
        await place.fetchFields({ fields: ["displayName", "formattedAddress"] });
        if (live) setName([place.displayName, place.formattedAddress].filter(Boolean).join(", "));
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [placeId]);
  return (
    <p className="mt-1 text-xs text-muted">
      Citizen picked a place in Google search:{" "}
      {name ? <span className="text-ink-2">{name}</span> : failed ? <span className="font-mono">{placeId.slice(0, 18)}…</span> : "loading…"}
      {name && <span className="ml-1">· Place data © Google</span>}
    </p>
  );
}
