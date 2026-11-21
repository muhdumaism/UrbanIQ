"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { QueueRow } from "@/lib/officer";
import { SEVERITY_LABEL, type SeverityCode } from "@/lib/taxonomy";
import { addWardLabels, createCityMap, webglAvailable } from "../map/baseMap";

const PIN: Record<SeverityCode, { bg: string; letter: string }> = {
  CRITICAL: { bg: "#ff4d4a", letter: "C" },
  HIGH: { bg: "#ff9a3c", letter: "H" },
  MEDIUM: { bg: "#f5d04c", letter: "M" },
  LOW: { bg: "#7fb4ff", letter: "L" },
};

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
      const size = active ? 34 : hot ? 30 : 24;
      el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;background:${PIN[sev].bg};color:#0d1013;font:700 ${active ? 14 : 12}px/1 var(--font-geist-sans),sans-serif;display:flex;align-items:center;justify-content:center;cursor:pointer;border:${el.dataset.precise === "true" ? "2.5px solid #0d1013" : "2.5px dashed #0d1013"};box-shadow:${active ? "0 0 0 4px #fff, 0 0 0 9px rgba(205,235,63,.55)" : hot ? "0 0 0 3px #fff" : "0 1px 6px rgba(0,0,0,.6)"};transition:width .12s,height .12s,box-shadow .12s;`;
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

  const unlocated = rows.filter((r) => r.lat == null);

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
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-2">
        <div className="pointer-events-auto rounded-xl bg-[#0d1013]/90 px-3 py-2.5 text-xs text-night-text ring-1 ring-night-line">
          <p className="mb-1.5 font-medium text-white">Severity</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
            {(Object.keys(PIN) as SeverityCode[]).map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-[#0d1013]" style={{ background: PIN[s].bg }} aria-hidden="true">
                  {PIN[s].letter}
                </span>
                {SEVERITY_LABEL[s]}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-[#97a3ae]">Dashed outline = approximate location</p>
        </div>
        {unlocated.length > 0 && (
          <p className="pointer-events-auto rounded-xl bg-white px-3 py-2 text-xs font-medium text-ink shadow">
            {unlocated.length} ticket{unlocated.length === 1 ? "" : "s"} without a map location — listed in the queue
          </p>
        )}
      </div>
    </div>
  );
}
