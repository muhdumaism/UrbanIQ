"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { addWardLabels, createCityMap, webglAvailable } from "./baseMap";
import { findLandmark, inCityBounds, LANDMARKS, wardForPoint, wardLabel } from "@/lib/geo";

export type PickedLocation = {
  lat: number | null;
  lng: number | null;
  source: "DEVICE" | "PIN" | "LANDMARK" | "NONE";
  text: string;
  confirmed: boolean;
};

export const EMPTY_LOCATION: PickedLocation = { lat: null, lng: null, source: "NONE", text: "", confirmed: false };

export function LocationPicker({
  value,
  onChange,
  error,
  idPrefix = "loc",
}: {
  value: PickedLocation;
  onChange: (v: PickedLocation) => void;
  error?: string;
  idPrefix?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [mapFailed, setMapFailed] = useState(false);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "error">("idle");
  const [geoMsg, setGeoMsg] = useState("");

  const setPin = (lat: number, lng: number, source: "DEVICE" | "PIN") => {
    onChange({ ...valueRef.current, lat, lng, source, confirmed: false });
  };

  useEffect(() => {
    if (!box.current) return;
    if (!webglAvailable()) {
      setMapFailed(true);
      return;
    }
    let map: maplibregl.Map;
    try {
      map = createCityMap(box.current, { cooperativeGestures: false });
    } catch {
      setMapFailed(true);
      return;
    }
    mapRef.current = map;
    // Handle for automated UI tests (projecting coordinates to pixels).
    (box.current as HTMLDivElement & { __map?: maplibregl.Map }).__map = map;
    map.on("load", () => addWardLabels(map));
    map.on("click", (e) => setPin(e.lngLat.lat, e.lngLat.lng, "PIN"));
    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker with value
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (value.lat == null || value.lng == null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.innerHTML = `<svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 43C17 43 32 27 32 16A15 15 0 1 0 2 16C2 27 17 43 17 43Z" fill="#cdeb3f" stroke="#0d1013" stroke-width="2.5"/><circle cx="17" cy="16" r="5.5" fill="#0d1013"/></svg>`;
      el.setAttribute("aria-label", "Report location pin (drag to adjust)");
      markerRef.current = new maplibregl.Marker({ element: el, draggable: true, anchor: "bottom" }).setLngLat([value.lng, value.lat]).addTo(map);
      markerRef.current.on("dragend", () => {
        const p = markerRef.current!.getLngLat();
        setPin(p.lat, p.lng, "PIN");
      });
    } else markerRef.current.setLngLat([value.lng, value.lat]);
  }, [value.lat, value.lng]);

  const useDevice = () => {
    if (!("geolocation" in navigator)) {
      setGeoState("error");
      setGeoMsg("Your browser can't share location. Drop a pin on the map or type a landmark instead.");
      return;
    }
    setGeoState("locating");
    setGeoMsg("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (!inCityBounds(latitude, longitude)) {
          setGeoState("error");
          setGeoMsg("Your device location is outside Port Alder (the sample city). Drop a pin on the map or type a landmark instead.");
          return;
        }
        setGeoState("idle");
        setPin(latitude, longitude, "DEVICE");
        mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 15 });
      },
      () => {
        setGeoState("error");
        setGeoMsg("We couldn't get your location. Drop a pin on the map or type a landmark instead.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const ward = value.lat != null && value.lng != null ? wardForPoint(value.lat, value.lng) : null;
  const typedLandmark = !value.lat && value.text ? findLandmark(value.text) : null;
  const errId = `${idPrefix}-error`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-outline btn-sm" onClick={useDevice} disabled={geoState === "locating"}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
          {geoState === "locating" ? "Locating…" : "Use my location"}
        </button>
        {value.lat != null && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => onChange({ ...value, lat: null, lng: null, source: value.text ? "LANDMARK" : "NONE", confirmed: false })}>
            Remove pin
          </button>
        )}
      </div>
      {geoMsg && (
        <p role="status" className="rounded-lg bg-med-soft px-3 py-2 text-sm text-med">
          {geoMsg}
        </p>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-night-line bg-night">
        <div ref={box} className="h-64 w-full sm:h-80" role="application" aria-label="Map of Port Alder. Click or tap to drop a pin." aria-describedby={`${idPrefix}-maphint`} />
        {mapFailed && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-night-text">
            The interactive map isn&apos;t available on this device. Type a street or landmark below instead.
          </div>
        )}
        {!mapFailed && value.lat == null && (
          <p id={`${idPrefix}-maphint`} className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/70 px-2.5 py-1.5 text-xs text-white">
            Tap the map to drop a pin
          </p>
        )}
      </div>

      {value.lat != null && value.lng != null && (
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${value.confirmed ? "border-[#b9d36a] bg-accent-soft" : "border-line-strong bg-surface"}`}>
          <p className="text-sm">
            {ward ? (
              <>
                Pin is in <strong>{wardLabel(ward)}</strong>
                {value.source === "DEVICE" ? " (from your device)" : ""}.
              </>
            ) : (
              <>Pin is outside the sample ward boundaries. Move it inside Port Alder.</>
            )}
          </p>
          {value.confirmed ? (
            <span className="text-sm font-medium text-accent-ink">✓ Location confirmed</span>
          ) : (
            <button type="button" className="btn-dark btn-sm" disabled={!ward} onClick={() => onChange({ ...value, confirmed: true })}>
              Confirm this location
            </button>
          )}
        </div>
      )}

      <div>
        <label htmlFor={`${idPrefix}-text`} className="label">
          Street or nearby landmark <span className="font-normal text-muted">(optional if you pin it)</span>
        </label>
        <input
          id={`${idPrefix}-text`}
          className="input"
          list={`${idPrefix}-landmarks`}
          value={value.text}
          maxLength={200}
          placeholder="e.g. School Road, outside Alder Primary School"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errId : `${idPrefix}-texthint`}
          onChange={(e) => onChange({ ...value, text: e.target.value, source: value.lat != null ? value.source : e.target.value ? "LANDMARK" : "NONE" })}
        />
        <datalist id={`${idPrefix}-landmarks`}>
          {LANDMARKS.map((l) => (
            <option key={l.name} value={l.name} />
          ))}
        </datalist>
        {error ? (
          <p id={errId} className="mt-1.5 text-sm text-crit">
            {error}
          </p>
        ) : (
          <p id={`${idPrefix}-texthint`} className="mt-1.5 hint">
            {typedLandmark ? `We recognise “${typedLandmark.name}” (${wardLabel(typedLandmark.wardCode)}).` : "Helps the crew find the exact spot."}
          </p>
        )}
      </div>
    </div>
  );
}
