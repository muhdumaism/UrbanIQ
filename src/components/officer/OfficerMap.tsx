"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { QueueRow } from "@/lib/officer";
import { SEVERITY_LABEL, type SeverityCode } from "@/lib/taxonomy";
import { addWardLabels, createCityMap, webglAvailable } from "../map/baseMap";
import { PIN_STYLE, pinCss } from "./pins";

const PIN = PIN_STYLE;

export function OfficerMap({ rows, selectedId, hoveredId, onSelect }: { rows: QueueRow[]; selectedId: string | null; hoveredId: string | null; onSelect: (id: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef(new Map<string, { marker: maplibregl.Marker; el: HTMLButtonElement }>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!box.current) return;
    if (!webglAvailable()) return setFailed(true);
    let map: maplibregl.Map;
    try {
      map = createCityMap(box.current);
    } catch {
      return setFailed(true);
    }
    mapRef.current = map;
    // Handle for automated UI tests (projecting coordinates to pixels).
    (box.current as HTMLDivElement & { __map?: maplibregl.Map }).__map = map;
    map.on("load", () => {
      addWardLabels(map);
      setReady(true);
    });
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(box.current);
    const all = markers.current;
    return () => {
      ro.disconnect();
      all.clear();
      map.remove();
    };
  }, []);

  // Sync pins with rows
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const live = new Set<string>();
    for (const r of rows) {
      if (r.lat == null || r.lng == null) continue;
      live.add(r.id);
      const label = `${r.reference}, ${SEVERITY_LABEL[r.severity]}: ${r.title}${r.locationPrecise ? "" : " (approximate location)"}`;
      let m = markers.current.get(r.id);
      if (!m) {
        // MapLibre positions the wrapper via its inline transform; we only restyle the inner button.
        const wrap = document.createElement("div");
        const el = document.createElement("button");
        el.type = "button";
        wrap.appendChild(el);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectRef.current(el.dataset.id!);
        });
        const marker = new maplibregl.Marker({ element: wrap }).setLngLat([r.lng, r.lat]).addTo(map);
        m = { marker, el };
        markers.current.set(r.id, m);
      }
      m.el.dataset.id = r.id;
      m.el.dataset.severity = r.severity;
      m.el.dataset.precise = String(r.locationPrecise);
      m.el.setAttribute("aria-label", label);
      m.el.title = label;
      m.el.textContent = PIN[r.severity].letter;
      m.marker.setLngLat([r.lng, r.lat]);
    }
    for (const [id, m] of markers.current) {
      if (!live.has(id)) {
        m.marker.remove();
        markers.current.delete(id);
      }
    }
    styleMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, ready]);

  const styleMarkers = () => {
    for (const [id, { el, marker }] of markers.current) {
      const sev = el.dataset.severity as SeverityCode;
      const active = id === selectedId;
      const hot = id === hoveredId;
      el.style.cssText = pinCss(sev, el.dataset.precise === "true", active, hot);
      marker.getElement().style.zIndex = active ? "30" : hot ? "20" : String(10 - Object.keys(PIN).indexOf(sev));
      if (active) el.setAttribute("aria-pressed", "true");
      else el.removeAttribute("aria-pressed");
    }
  };

  useEffect(() => {
    styleMarkers();
    const map = mapRef.current;
    const row = rows.find((r) => r.id === selectedId);
    if (map && row?.lat != null && row.lng != null) map.easeTo({ center: [row.lng, row.lat], zoom: Math.max(map.getZoom(), 14.2), duration: 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, hoveredId]);

  return (
    <div className="absolute inset-0">
      <div ref={box} className="h-full w-full" aria-label="Dark ward map with ticket pins. Pins are buttons; press Tab to move between them." role="region" />
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-night-text">
          <p>
            The interactive map isn&apos;t available in this browser.
            <br />
            The queue, filters and ticket details still work.
          </p>
        </div>
      )}
    </div>
  );
}
