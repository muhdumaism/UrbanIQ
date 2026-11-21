"use client";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import wards from "../../../data/wards.json";
import basemap from "../../../data/basemap.json";
import city from "../../../data/city.json";

export const CITY_BOUNDS = city.bounds as [[number, number], [number, number]];

/**
 * Dark city style built from LOCAL GeoJSON. Raster tiles are optional (NEXT_PUBLIC_MAP_TILE_URL);
 * if they fail to load, wards, streets and pins still render because they never depend on tiles.
 */
export function cityStyle(): StyleSpecification {
  const tileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL;
  const style: StyleSpecification = {
    version: 8,
    sources: {
      basemap: { type: "geojson", data: basemap as FeatureCollection },
      wards: { type: "geojson", data: wards as FeatureCollection },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#0d1013" } },
      { id: "city", type: "fill", source: "basemap", filter: ["==", ["get", "kind"], "city"], paint: { "fill-color": "#141a20" } },
      { id: "river", type: "line", source: "basemap", filter: ["==", ["get", "kind"], "river"], paint: { "line-color": "#173149", "line-width": ["interpolate", ["linear"], ["zoom"], 12, 6, 16, 28] }, layout: { "line-cap": "round" } },
      { id: "minor", type: "line", source: "basemap", filter: ["==", ["get", "kind"], "minor"], paint: { "line-color": "#29323b", "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.5, 16, 8] }, layout: { "line-cap": "round" } },
      { id: "major", type: "line", source: "basemap", filter: ["==", ["get", "kind"], "major"], paint: { "line-color": "#3a4651", "line-width": ["interpolate", ["linear"], ["zoom"], 12, 2.5, 16, 12] }, layout: { "line-cap": "round" } },
      { id: "ward-fill", type: "fill", source: "wards", paint: { "fill-color": "#cdeb3f", "fill-opacity": ["case", ["boolean", ["feature-state", "active"], false], 0.07, 0] } },
      { id: "ward-line", type: "line", source: "wards", paint: { "line-color": "#5d6b78", "line-width": 1.4, "line-dasharray": [3, 2] } },
    ],
  };
  if (tileUrl) {
    style.sources.tiles = { type: "raster", tiles: [tileUrl], tileSize: 256, attribution: process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION || "" };
    style.layers.splice(1, 0, { id: "tiles", type: "raster", source: "tiles", paint: { "raster-opacity": 0.85 } });
  }
  return style;
}

export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function createCityMap(container: HTMLElement, opts: Partial<maplibregl.MapOptions> = {}, withControls = true) {
  const map = new maplibregl.Map({
    container,
    style: cityStyle(),
    bounds: CITY_BOUNDS,
    fitBoundsOptions: { padding: 24 },
    maxBounds: [
      [CITY_BOUNDS[0][0] - 0.06, CITY_BOUNDS[0][1] - 0.05],
      [CITY_BOUNDS[1][0] + 0.06, CITY_BOUNDS[1][1] + 0.05],
    ],
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    ...opts,
  });
  map.touchZoomRotate.disableRotation();
  if (withControls) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "Port Alder sample geography" }));
  // Tiles are optional: never let a tile failure break the map.
  map.on("error", (e) => {
    if ((e as { sourceId?: string }).sourceId === "tiles" && map.getLayer("tiles")) map.setLayoutProperty("tiles", "visibility", "none");
  });
  return map;
}

/** HTML ward labels (no glyph server needed, readable on the dark map). */
export function addWardLabels(map: maplibregl.Map) {
  const markers: maplibregl.Marker[] = [];
  for (const f of (wards as unknown as { features: { properties: { code: string; name: string }; geometry: { coordinates: [number, number][][] } }[] }).features) {
    const ring = f.geometry.coordinates[0].slice(0, -1);
    const lng = ring.reduce((a, c) => a + c[0], 0) / ring.length;
    const lat = ring.reduce((a, c) => a + c[1], 0) / ring.length;
    const el = document.createElement("div");
    el.className = "pointer-events-none select-none text-[11px] font-medium tracking-[0.12em] uppercase text-[#9aa7b4]";
    el.dataset.full = `${f.properties.code} · ${f.properties.name}`;
    el.dataset.short = f.properties.code;
    el.setAttribute("aria-hidden", "true");
    markers.push(new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map));
  }
  // Short codes when zoomed out so labels never collide on small screens.
  const update = () => {
    const full = map.getZoom() >= 13.4;
    for (const m of markers) {
      const el = m.getElement();
      el.textContent = (full ? el.dataset.full : el.dataset.short) ?? "";
    }
  };
  update();
  map.on("zoomend", update);
  return markers;
}
