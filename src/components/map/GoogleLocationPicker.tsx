"use client";
import { useEffect, useRef, useState } from "react";
import type { PickedLocation } from "./location-types";
import { fetchWards, GOOGLE_MAP_ID, loadGoogleMaps, styleWards, wardFromGeojson, wardsBounds, type WardsPayload } from "./google";

/**
 * Google Maps location picker: Places search, click/drag pin, browser geolocation, explicit confirmation.
 * Citizen-supplied data (typed text, confirmed pin) is kept separate from Google data (only the Place ID
 * is kept). Manual landmark entry always remains available.
 */
export function GoogleLocationPicker({ value, onChange, error, idPrefix = "loc" }: { value: PickedLocation; onChange: (v: PickedLocation) => void; error?: string; idPrefix?: string }) {
  const mapBox = useRef<HTMLDivElement>(null);
  const searchBox = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [wards, setWards] = useState<WardsPayload | null>(null);
  const [geoMsg, setGeoMsg] = useState("");
  const [locating, setLocating] = useState(false);

  const setPin = (lat: number, lng: number, source: "DEVICE" | "PIN", placeId: string | null) => {
    onChange({ ...valueRef.current, lat, lng, source, placeId, confirmed: false });
  };

  useEffect(() => {
    let cancelled = false;
    const onAuthFail = () => setState("failed");
    window.addEventListener("civicflow:maps-auth-failed", onAuthFail);
    Promise.all([loadGoogleMaps(), fetchWards()])
      .then(([{ maps, places }, w]) => {
        if (cancelled || !mapBox.current) return;
        setWards(w);
        const map = new maps.Map(mapBox.current, {
          mapId: GOOGLE_MAP_ID,
          colorScheme: "DARK",
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "cooperative",
        });
        map.fitBounds(wardsBounds(w.geojson), 16);
        styleWards(map, w.geojson);
        (mapBox.current as HTMLDivElement & { __gmap?: google.maps.Map }).__gmap = map;
        mapRef.current = map;
        map.addListener("click", (e: google.maps.MapMouseEvent) => e.latLng && setPin(e.latLng.lat(), e.latLng.lng(), "PIN", null));

        const ac = new places.PlaceAutocompleteElement({});
        ac.id = `${idPrefix}-search`;
        ac.setAttribute("aria-label", "Search for a street, landmark or place");
        ac.addEventListener("gmp-select", async (ev: Event) => {
          const place = (ev as google.maps.places.PlacePredictionSelectEvent).placePrediction.toPlace();
          await place.fetchFields({ fields: ["location"] });
          if (!place.location) return;
          setPin(place.location.lat(), place.location.lng(), "PIN", place.id);
          map.panTo(place.location);
          map.setZoom(17);
        });
        searchBox.current?.replaceChildren(ac);
        setState("ready");
      })
      .catch(() => !cancelled && setState("failed"));
    return () => {
      cancelled = true;
      window.removeEventListener("civicflow:maps-auth-failed", onAuthFail);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the draggable marker in sync with the value.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || state !== "ready") return;
    if (value.lat == null || value.lng == null) {
      if (markerRef.current) markerRef.current.map = null;
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const pin = document.createElement("div");
      pin.innerHTML = `<svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 43C17 43 32 27 32 16A15 15 0 1 0 2 16C2 27 17 43 17 43Z" fill="#cdeb3f" stroke="#0d1013" stroke-width="2.5"/><circle cx="17" cy="16" r="5.5" fill="#0d1013"/></svg>`;
      const marker = new google.maps.marker.AdvancedMarkerElement({ map, content: pin, gmpDraggable: true, title: "Report location (drag to adjust)" });
      marker.addListener("dragend", () => {
        const p = marker.position as google.maps.LatLngLiteral | google.maps.LatLng | null;
        if (!p) return;
        const lat = typeof p.lat === "function" ? p.lat() : p.lat;
        const lng = typeof p.lng === "function" ? p.lng() : p.lng;
        setPin(lat as number, lng as number, "PIN", valueRef.current.placeId ?? null);
      });
      markerRef.current = marker;
    }
    markerRef.current.position = { lat: value.lat, lng: value.lng };
  }, [value.lat, value.lng, state]);

  const useDevice = () => {
    setGeoMsg("");
    if (!("geolocation" in navigator)) return setGeoMsg("Your browser can't share location. Search, drop a pin, or type a landmark instead.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        setPin(latitude, longitude, "DEVICE", null);
        mapRef.current?.panTo({ lat: latitude, lng: longitude });
        mapRef.current?.setZoom(17);
      },
      (err) => {
        setLocating(false);
        setGeoMsg(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. You can search, drop a pin, or type a landmark instead."
            : "We couldn't get your location. Search, drop a pin, or type a landmark instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const ward = value.lat != null && value.lng != null && wards ? wardFromGeojson(wards.geojson, value.lat, value.lng) : null;
  const errId = `${idPrefix}-error`;

  return (
    <div className="space-y-3">
      {state !== "failed" && (
        <div>
          <label htmlFor={`${idPrefix}-search`} className="label">
            Search for a place
          </label>
          <div ref={searchBox} className="min-h-11 [&_gmp-place-autocomplete]:w-full" />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-outline btn-sm" onClick={useDevice} disabled={locating}>
          {locating ? "Locating…" : "Use my location"}
        </button>
        {value.lat != null && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => onChange({ ...value, lat: null, lng: null, placeId: null, source: value.text ? "LANDMARK" : "NONE", confirmed: false })}>
            Remove pin
          </button>
        )}
      </div>
      {geoMsg && (
        <p role="status" className="rounded-lg bg-med-soft px-3 py-2 text-sm text-med">
          {geoMsg}
        </p>
      )}

      {state === "failed" ? (
        <p role="status" className="rounded-xl border border-line-strong bg-surface px-4 py-3 text-sm text-ink-2">
          The map couldn&apos;t load. Type a street or nearby landmark below — that works just as well.
        </p>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-night-line bg-night">
          <div ref={mapBox} className="h-64 w-full sm:h-80" aria-label="Google map. Click or tap to drop a pin; drag the pin to adjust." role="application" data-map="google" />
          {state === "loading" && <div className="absolute inset-0 animate-pulse bg-night" aria-label="Loading map" />}
          {wards?.sample && (
            <p className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/75 px-2.5 py-1.5 text-xs text-white">Sample wards · fictional city</p>
          )}
        </div>
      )}

      {value.lat != null && value.lng != null && (
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${value.confirmed ? "border-[#b9d36a] bg-accent-soft" : "border-line-strong bg-surface"}`}>
          <p className="text-sm">
            {ward ? (
              <>
                Pin looks like it&apos;s in <strong>{ward.label}</strong>
                {value.source === "DEVICE" ? " (from your device)" : ""}.
              </>
            ) : (
              <>This pin is outside the city&apos;s wards. You can still send it — an officer will review the location.</>
            )}
          </p>
          {value.confirmed ? (
            <span className="text-sm font-medium text-accent-ink">✓ Location confirmed</span>
          ) : (
            <button type="button" className="btn-dark btn-sm" onClick={() => onChange({ ...value, confirmed: true })}>
              Confirm this location
            </button>
          )}
        </div>
      )}

      <div>
        <label htmlFor={`${idPrefix}-text`} className="label">
          Street or nearby landmark <span className="font-normal text-muted">(in your own words)</span>
        </label>
        <input
          id={`${idPrefix}-text`}
          className="input"
          value={value.text}
          maxLength={200}
          placeholder="e.g. outside the school gate, by the bus shelter"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errId : undefined}
          onChange={(e) => onChange({ ...value, text: e.target.value, source: value.lat != null ? value.source : e.target.value ? "LANDMARK" : "NONE" })}
        />
        {error && (
          <p id={errId} className="mt-1.5 text-sm text-crit">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
