"use client";
import { useEffect, useRef, useState } from "react";
import type { QueueRow } from "@/lib/officer";
import { SEVERITY_LABEL, type SeverityCode } from "@/lib/taxonomy";
import { fetchWards, GOOGLE_MAP_ID, loadGoogleMaps, styleWards, wardsBounds } from "../map/google";
import { PIN_STYLE, pinCss } from "./pins";

/** Google Maps variant of the officer map: same props and behaviour as the offline OfficerMap. */
export function GoogleOfficerMap({ rows, selectedId, hoveredId, onSelect, onFail }: { rows: QueueRow[]; selectedId: string | null; hoveredId: string | null; onSelect: (id: string) => void; onFail: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const markers = useRef(new Map<string, { marker: google.maps.marker.AdvancedMarkerElement; el: HTMLButtonElement }>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [ready, setReady] = useState(false);
  const [sample, setSample] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fail = () => !cancelled && onFail();
    window.addEventListener("civicflow:maps-auth-failed", fail);
    Promise.all([loadGoogleMaps(), fetchWards()])
      .then(([{ maps }, w]) => {
        if (cancelled || !box.current) return;
        const map = new maps.Map(box.current, { mapId: GOOGLE_MAP_ID, colorScheme: "DARK", disableDefaultUI: true, zoomControl: true, clickableIcons: false });
        map.fitBounds(wardsBounds(w.geojson), 24);
        styleWards(map, w.geojson);
        infoRef.current = new maps.InfoWindow({ headerDisabled: true });
        mapRef.current = map;
        (box.current as HTMLDivElement & { __gmap?: google.maps.Map }).__gmap = map;
        setSample(w.sample);
        setReady(true);
      })
      .catch(fail);
    const all = markers.current;
    return () => {
      cancelled = true;
      window.removeEventListener("civicflow:maps-auth-failed", fail);
      for (const m of all.values()) m.marker.map = null;
      all.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const live = new Set<string>();
    for (const r of rows) {
      if (r.lat == null || r.lng == null) continue;
      live.add(r.id);
      let m = markers.current.get(r.id);
      if (!m) {
        const el = document.createElement("button");
        el.type = "button";
        const marker = new google.maps.marker.AdvancedMarkerElement({ map, content: el, position: { lat: r.lat, lng: r.lng } });
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectRef.current(el.dataset.id!);
        });
        m = { marker, el };
        markers.current.set(r.id, m);
      }
      const label = `${r.reference}, ${SEVERITY_LABEL[r.severity]}: ${r.title}${r.locationPrecise ? "" : " (approximate location)"}`;
      Object.assign(m.el.dataset, { id: r.id, severity: r.severity, precise: String(r.locationPrecise) });
      m.el.setAttribute("aria-label", label);
      m.el.title = label;
      m.el.textContent = PIN_STYLE[r.severity].letter;
      m.marker.position = { lat: r.lat, lng: r.lng };
    }
    for (const [id, m] of markers.current) {
      if (!live.has(id)) {
        m.marker.map = null;
        markers.current.delete(id);
      }
    }
    restyle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, ready]);

  const restyle = () => {
    for (const [id, { el, marker }] of markers.current) {
      const active = id === selectedId;
      el.style.cssText = pinCss(el.dataset.severity as SeverityCode, el.dataset.precise === "true", active, id === hoveredId);
      marker.zIndex = active ? 1000 : id === hoveredId ? 900 : 10 - Object.keys(PIN_STYLE).indexOf(el.dataset.severity!);
      if (active) el.setAttribute("aria-pressed", "true");
      else el.removeAttribute("aria-pressed");
    }
  };

  useEffect(() => {
    restyle();
    const map = mapRef.current;
    const row = rows.find((r) => r.id === selectedId);
    const info = infoRef.current;
    if (!map || !info) return;
    if (row?.lat != null && row.lng != null) {
      map.panTo({ lat: row.lat, lng: row.lng });
      if ((map.getZoom() ?? 0) < 15) map.setZoom(15);
      // Selected ticket, ward and severity shown at the pin.
      const card = document.createElement("div");
      card.style.cssText = "font:13px/1.35 var(--font-geist-sans),sans-serif;color:#16171a;max-width:220px";
      const strong = document.createElement("strong");
      strong.textContent = `${row.reference} · ${SEVERITY_LABEL[row.severity]}`;
      const title = document.createElement("div");
      title.textContent = row.title;
      const ward = document.createElement("div");
      ward.style.color = "#63676e";
      ward.textContent = row.ward ?? "Outside configured wards";
      card.append(strong, title, ward);
      info.setContent(card);
      info.open({ map, anchor: markers.current.get(row.id)?.marker });
    } else info.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, hoveredId, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={box} className="h-full w-full" data-map="google" role="region" aria-label="Google map with ticket pins. Pins are buttons." />
      {sample && <p className="pointer-events-none absolute right-14 top-3 rounded-md bg-black/75 px-2.5 py-1.5 text-xs text-white">Sample wards · fictional city</p>}
    </div>
  );
}
