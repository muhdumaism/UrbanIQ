/**
 * Generates the SAMPLE geography for the fictional municipality of Port Alder.
 * Coordinates are deliberately placed in the open South Atlantic so they can never be
 * mistaken for a real city. Output is committed to /data; re-run with `npm run geo:generate`.
 */
import fs from "fs";
import path from "path";

const CENTER = { lat: -30.0, lng: -20.0 };
const KM_LAT = 1 / 111.0;
const KM_LNG = 1 / (111.32 * Math.cos((CENTER.lat * Math.PI) / 180));

// deterministic pseudo-random
let seed = 42;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

const COLS = 3;
const ROWS = 2;
const SUB = 3; // subdivisions per cell edge
const WIDTH_KM = 7.2;
const HEIGHT_KM = 4.8;

const nx = COLS * SUB + 1;
const ny = ROWS * SUB + 1;
const grid: [number, number][][] = [];
for (let j = 0; j < ny; j++) {
  grid[j] = [];
  for (let i = 0; i < nx; i++) {
    const xKm = (i / (nx - 1) - 0.5) * WIDTH_KM;
    const yKm = (j / (ny - 1) - 0.5) * HEIGHT_KM;
    const jitter = 0.28;
    const dx = (rand() - 0.5) * jitter * (WIDTH_KM / (nx - 1));
    const dy = (rand() - 0.5) * jitter * (HEIGHT_KM / (ny - 1)) * 2;
    grid[j][i] = [
      +(CENTER.lng + (xKm + dx) * KM_LNG).toFixed(6),
      +(CENTER.lat + (yKm + dy) * KM_LAT).toFixed(6),
    ];
  }
}

const WARDS = [
  // row 0 is south
  { code: "W1", name: "Harbourside", col: 0, row: 0 },
  { code: "W2", name: "Old Town", col: 1, row: 0 },
  { code: "W3", name: "Millbrook", col: 2, row: 0 },
  { code: "W4", name: "Riverside", col: 0, row: 1 },
  { code: "W5", name: "Northgate", col: 1, row: 1 },
  { code: "W6", name: "Eastfield", col: 2, row: 1 },
];

function cellRing(col: number, row: number): [number, number][] {
  const i0 = col * SUB, i1 = (col + 1) * SUB, j0 = row * SUB, j1 = (row + 1) * SUB;
  const ring: [number, number][] = [];
  for (let i = i0; i <= i1; i++) ring.push(grid[j0][i]);
  for (let j = j0 + 1; j <= j1; j++) ring.push(grid[j][i1]);
  for (let i = i1 - 1; i >= i0; i--) ring.push(grid[j1][i]);
  for (let j = j1 - 1; j > j0; j--) ring.push(grid[j][i0]);
  ring.push(ring[0]);
  return ring;
}

const wards = {
  type: "FeatureCollection",
  name: "Port Alder sample wards (fictional)",
  features: WARDS.map((w) => ({
    type: "Feature",
    properties: { code: w.code, name: w.name, label: `${w.code} · ${w.name}` },
    geometry: { type: "Polygon", coordinates: [cellRing(w.col, w.row)] },
  })),
};

const pt = (xKm: number, yKm: number): [number, number] => [
  +(CENTER.lng + xKm * KM_LNG).toFixed(6),
  +(CENTER.lat + yKm * KM_LAT).toFixed(6),
];

// Streets (fictional)
const streets: { name: string; kind: "major" | "minor"; coords: [number, number][] }[] = [
  { name: "Alder Avenue", kind: "major", coords: [pt(-3.6, -0.3), pt(-1.2, -0.1), pt(0.4, 0.05), pt(2.2, 0.2), pt(3.6, 0.35)] },
  { name: "Quay Road", kind: "major", coords: [pt(-3.6, -1.9), pt(-1.4, -1.7), pt(0.6, -1.85), pt(3.6, -1.6)] },
  { name: "Northgate Road", kind: "major", coords: [pt(-0.6, -2.4), pt(-0.45, -0.9), pt(-0.3, 0.6), pt(-0.1, 2.4)] },
  { name: "Mill Lane", kind: "major", coords: [pt(2.0, -2.4), pt(1.9, -0.6), pt(2.1, 1.0), pt(2.0, 2.4)] },
  { name: "Station Street", kind: "minor", coords: [pt(-2.4, -2.4), pt(-2.3, 0.0), pt(-2.5, 2.4)] },
  { name: "Elm Street", kind: "minor", coords: [pt(-3.6, 1.2), pt(-1.0, 1.25), pt(1.0, 1.1), pt(3.6, 1.3)] },
  { name: "School Road", kind: "minor", coords: [pt(0.6, -2.4), pt(0.75, -1.0), pt(0.7, 0.0)] },
  { name: "Canal Walk", kind: "minor", coords: [pt(-3.6, -0.9), pt(-1.2, -0.95), pt(1.2, -0.7), pt(3.6, -0.85)] },
  { name: "Orchard Row", kind: "minor", coords: [pt(1.2, 0.2), pt(1.25, 1.6), pt(1.1, 2.4)] },
  { name: "Ferry Lane", kind: "minor", coords: [pt(-1.4, -2.4), pt(-1.35, -1.0)] },
];

// River Alder winds through the north-west
const river: [number, number][] = [pt(-3.7, 0.7), pt(-2.8, 0.55), pt(-1.9, 0.8), pt(-1.1, 1.65), pt(-0.6, 2.0), pt(-0.2, 2.5)];

const outline = cellRingOuter();
function cellRingOuter(): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i < nx; i++) ring.push(grid[0][i]);
  for (let j = 1; j < ny; j++) ring.push(grid[j][nx - 1]);
  for (let i = nx - 2; i >= 0; i--) ring.push(grid[ny - 1][i]);
  for (let j = ny - 2; j > 0; j--) ring.push(grid[j][0]);
  ring.push(ring[0]);
  return ring;
}

const basemap = {
  type: "FeatureCollection",
  name: "Port Alder offline basemap (fictional)",
  features: [
    { type: "Feature", properties: { kind: "city" }, geometry: { type: "Polygon", coordinates: [outline] } },
    { type: "Feature", properties: { kind: "river", name: "River Alder" }, geometry: { type: "LineString", coordinates: river } },
    ...streets.map((s) => ({
      type: "Feature",
      properties: { kind: s.kind, name: s.name },
      geometry: { type: "LineString", coordinates: s.coords },
    })),
  ],
};

// Landmarks (fictional). Used for typed-landmark geocoding and map labels.
const landmarks = [
  { name: "Alder Primary School", aliases: ["alder primary", "alder school", "primary school"], at: pt(0.78, -1.15) },
  { name: "Northgate High School", aliases: ["northgate high", "northgate school", "high school"], at: pt(-0.2, 1.4) },
  { name: "Central Bus Station", aliases: ["bus station", "central station", "bus stand"], at: pt(-2.3, -0.25) },
  { name: "Quay Road Bus Stop", aliases: ["quay road stop", "quay bus stop"], at: pt(-1.5, -1.72) },
  { name: "Riverside Market", aliases: ["market", "riverside market"], at: pt(-2.6, 0.95) },
  { name: "Port Alder Clinic", aliases: ["clinic", "health centre", "health center", "hospital"], at: pt(1.3, 0.4) },
  { name: "Millbrook Park", aliases: ["millbrook park", "park"], at: pt(2.7, -1.2) },
  { name: "Old Town Square", aliases: ["town square", "old town square", "square"], at: pt(0.1, -0.6) },
  { name: "Eastfield Library", aliases: ["library", "eastfield library"], at: pt(2.6, 1.5) },
  { name: "Harbour Ferry Terminal", aliases: ["ferry terminal", "ferry", "harbour"], at: pt(-3.0, -2.0) },
  { name: "Northgate Community Hall", aliases: ["community hall", "northgate hall"], at: pt(0.3, 1.9) },
  { name: "Elm Street Playground", aliases: ["playground", "elm playground"], at: pt(-1.6, 1.3) },
];

function pointInRing(p: [number, number], ring: [number, number][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const landmarkOut = landmarks.map((l) => {
  const ward = wards.features.find((f) => pointInRing(l.at, f.geometry.coordinates[0] as [number, number][]));
  return { name: l.name, aliases: l.aliases, lng: l.at[0], lat: l.at[1], wardCode: ward?.properties.code ?? null };
});

const dir = path.join(process.cwd(), "data");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "wards.json"), JSON.stringify(wards, null, 1));
fs.writeFileSync(path.join(dir, "basemap.json"), JSON.stringify(basemap, null, 1));
fs.writeFileSync(path.join(dir, "landmarks.json"), JSON.stringify(landmarkOut, null, 1));
fs.writeFileSync(
  path.join(dir, "city.json"),
  JSON.stringify(
    {
      name: "Port Alder",
      note: "Fictional municipality. All wards, streets, landmarks and reports are sample data.",
      center: [CENTER.lng, CENTER.lat],
      bounds: [pt(-4.2, -3.0), pt(4.2, 3.0)],
    },
    null,
    1,
  ),
);
console.log("Wrote data/wards.json, basemap.json, landmarks.json, city.json");
console.log(landmarkOut.map((l) => `${l.name} → ${l.wardCode}`).join("\n"));
