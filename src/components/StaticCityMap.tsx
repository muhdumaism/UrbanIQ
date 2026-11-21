/** Lightweight SVG rendering of the sample city (no WebGL, no tiles) for previews and small maps. */
import wards from "../../data/wards.json";
import basemap from "../../data/basemap.json";
import city from "../../data/city.json";

type Pt = [number, number];
const [[W, S], [E, N]] = city.bounds as [Pt, Pt];

export function StaticCityMap({
  pins = [],
  focus,
  className = "",
  label = "Map of Port Alder (sample city)",
  showWardLabels = true,
}: {
  pins?: { lat: number; lng: number; color?: string; ring?: boolean }[];
  focus?: { lat: number; lng: number; zoom?: number };
  className?: string;
  label?: string;
  showWardLabels?: boolean;
}) {
  const fullW = 840;
  const fullH = (fullW * (N - S)) / ((E - W) * Math.cos((30 * Math.PI) / 180));
  const x = (lng: number) => ((lng - W) / (E - W)) * fullW;
  const y = (lat: number) => ((N - lat) / (N - S)) * fullH;
  let vb = `0 0 ${fullW} ${fullH.toFixed(0)}`;
  if (focus) {
    const z = focus.zoom ?? 3;
    const w = fullW / z;
    const h = fullH / z;
    vb = `${(x(focus.lng) - w / 2).toFixed(1)} ${(y(focus.lat) - h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
  }
  const path = (coords: Pt[], close = false) => coords.map((c, i) => `${i ? "L" : "M"}${x(c[0]).toFixed(1)},${y(c[1]).toFixed(1)}`).join("") + (close ? "Z" : "");
  const feats = (basemap as unknown as { features: { properties: { kind: string }; geometry: { type: string; coordinates: unknown } }[] }).features;
  const scale = focus ? 1 / (focus.zoom ?? 3) : 1;

  return (
    <svg viewBox={vb} className={className} role="img" aria-label={label} preserveAspectRatio="xMidYMid slice">
      <rect x={-2000} y={-2000} width={6000} height={6000} fill="#0d1013" />
      {feats
        .filter((f) => f.properties.kind === "city")
        .map((f, i) => (
          <path key={i} d={path((f.geometry.coordinates as Pt[][])[0], true)} fill="#141a20" />
        ))}
      {(wards as unknown as { features: { properties: { code: string; name: string }; geometry: { coordinates: Pt[][] } }[] }).features.map((f) => (
        <path key={f.properties.code} d={path(f.geometry.coordinates[0], true)} fill="none" stroke="#3a4651" strokeWidth={1.4 * scale} strokeDasharray={`${6 * scale} ${4 * scale}`} />
      ))}
      {feats
        .filter((f) => f.properties.kind === "river")
        .map((f, i) => (
          <path key={i} d={path(f.geometry.coordinates as Pt[])} fill="none" stroke="#173149" strokeWidth={14 * scale} strokeLinecap="round" />
        ))}
      {feats
        .filter((f) => f.properties.kind === "major" || f.properties.kind === "minor")
        .map((f, i) => (
          <path key={i} d={path(f.geometry.coordinates as Pt[])} fill="none" stroke={f.properties.kind === "major" ? "#36414b" : "#262e36"} strokeWidth={(f.properties.kind === "major" ? 5 : 3) * scale} strokeLinecap="round" />
        ))}
      {showWardLabels &&
        !focus &&
        (wards as unknown as { features: { properties: { code: string; name: string }; geometry: { coordinates: Pt[][] } }[] }).features.map((f) => {
          const ring = f.geometry.coordinates[0];
          const cx = ring.reduce((a, c) => a + x(c[0]), 0) / ring.length;
          const cy = ring.reduce((a, c) => a + y(c[1]), 0) / ring.length;
          return (
            <text key={f.properties.code} x={cx} y={cy} textAnchor="middle" fill="#8996a3" fontSize={15} fontFamily="system-ui" letterSpacing="0.08em">
              {f.properties.code} · {f.properties.name.toUpperCase()}
            </text>
          );
        })}
      {pins.map((p, i) => (
        <g key={i} transform={`translate(${x(p.lng)},${y(p.lat)}) scale(${scale})`}>
          {p.ring && <circle r={22} fill="none" stroke={p.color ?? "#ff6b1a"} strokeOpacity={0.45} strokeWidth={6} />}
          <circle r={9} fill={p.color ?? "#ff6b1a"} stroke="#0d1013" strokeWidth={3} />
        </g>
      ))}
    </svg>
  );
}
