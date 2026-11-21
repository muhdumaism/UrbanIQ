/** Illustrative officer workspace (decorative). */
const ROWS = [
  { c: "#ff4d4a", t: "Sparking wire near a bus stop", s: "Critical · 0.8 km away", d: "Electrical Response" },
  { c: "#ff9a3c", t: "Pothole near the school", s: "High · 1.2 km away", d: "Roads Maintenance" },
  { c: "#ff9a3c", t: "Water main leak", s: "High · 2.4 km away", d: "Water Supply" },
  { c: "#f5d04c", t: "Overflowing garbage bin", s: "Medium · 1.3 km away", d: "Solid Waste" },
  { c: "#7fb4ff", t: "Streetlight out", s: "Low · 3.1 km away", d: "Streetlighting" },
];

export function DashboardMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-[#1b2027] shadow-[0_50px_100px_-40px_rgba(24,24,27,.4)]" aria-hidden="true">
      <div className="flex items-center gap-1.5 border-b border-zinc-200 bg-zinc-100 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 rounded-md bg-white px-3 py-0.5 text-[11px] text-zinc-400">urbaniq / operations</span>
      </div>
      <div className="relative grid h-[340px] grid-cols-[minmax(0,220px)_1fr] gap-3 p-3 sm:h-[420px]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {["M0 30 L100 36", "M0 70 L100 64", "M30 0 L36 100", "M66 0 L60 100", "M0 52 C 30 46, 60 58, 100 50"].map((d) => (
            <path key={d} d={d} stroke="#1c232b" strokeWidth="0.8" fill="none" />
          ))}
        </svg>
        <div className="lp-heat absolute left-[52%] top-[22%] h-40 w-40 rounded-full bg-[radial-gradient(closest-side,rgba(255,77,74,.5),rgba(255,154,60,.2),transparent)]" />
        <div className="lp-heat absolute left-[70%] top-[50%] h-36 w-36 rounded-full bg-[radial-gradient(closest-side,rgba(255,154,60,.45),transparent)] [animation-delay:2s]" />
        {[
          [60, 33, "#ff4d4a", "C"],
          [74, 58, "#ff9a3c", "H"],
          [83, 36, "#f5d04c", "M"],
          [66, 75, "#7fb4ff", "L"],
          [48, 52, "#ff9a3c", "H"],
        ].map(([x, y, c, l], i) => (
          <span key={i} className={`absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#0b0d10] text-[9px] font-bold text-[#0b0d10] ${i === 0 ? "lp-pin-pulse" : ""}`} style={{ left: `${x}%`, top: `${y}%`, background: c as string, color: c as string }}>
            <span className="text-[#0b0d10]">{l}</span>
          </span>
        ))}
        <span className="absolute left-[56%] top-[47%] h-3.5 w-3.5 rounded-full border-[3px] border-white bg-[#1a73e8] shadow-[0_0_0_8px_rgba(26,115,232,.25)]" />
        <div className="relative z-10 flex flex-col overflow-hidden rounded-xl bg-white text-[#16171a]">
          <div className="border-b border-[#e2e2da] px-3 py-2 text-[11px] text-[#63676e]">
            <b className="text-[#16171a]">5</b> open · within 5 km of me
          </div>
          {ROWS.map((r, i) => (
            <div key={i} className={`flex gap-2 border-l-[3px] px-3 py-2 ${i === 1 ? "border-[#16171a] bg-[#f6f6f1]" : "border-transparent"}`}>
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: r.c }} />
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-medium">{r.t}</span>
                <span className="block truncate text-[10.5px] text-[#63676e]">{r.s}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="relative z-10 flex items-end justify-end">
          <div className="w-[min(240px,100%)] rounded-xl bg-white p-3 text-[#16171a] shadow-xl">
            <p className="text-center text-[10px] text-[#63676e]">T-1042 · 12 min ago</p>
            <p className="mt-0.5 text-center text-[13px] font-semibold">Pothole near the school</p>
            <div className="mt-2 flex justify-center gap-1.5">
              <span className="rounded-md bg-[#16171a] px-2.5 py-1 text-[11px] font-medium text-white">Acknowledge</span>
              <span className="rounded-md border border-[#e2e2da] px-2.5 py-1 text-[11px]">Reroute</span>
            </div>
            <p className="mt-2 rounded-md bg-[#f6f6f1] px-2 py-1.5 text-[10.5px] text-[#3a3d42]">Why High: water-filled pothole obstructing a lane near a school.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
