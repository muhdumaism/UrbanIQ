import { Camera, MapPin, ArrowRight } from "lucide-react";

const PINS = [
  { x: 22, y: 30, c: "#ff4d4a", l: "C" },
  { x: 64, y: 22, c: "#ff9a3c", l: "H" },
  { x: 78, y: 58, c: "#f5d04c", l: "M" },
  { x: 40, y: 66, c: "#ff9a3c", l: "H" },
  { x: 55, y: 44, c: "#7fb4ff", l: "L" },
  { x: 86, y: 30, c: "#f5d04c", l: "M" },
];

/** Decorative, animated product scene. Purely illustrative (aria-hidden). */
export function HeroVisual() {
  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-[600px]" aria-hidden="true">
      <div className="lp-glow absolute -inset-10 opacity-70" />
      {/* Map canvas */}
      <div className="absolute inset-0 overflow-hidden rounded-[28px] border border-zinc-200 bg-[#f4f4f5] shadow-[0_40px_100px_-40px_rgba(24,24,27,.35)]">
        <svg viewBox="0 0 100 80" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <path d="M-5 50 C 20 44, 35 58, 60 48 S 90 30, 110 36" stroke="#dbe7f3" strokeWidth="5" fill="none" />
          {[
            "M0 18 L100 24",
            "M0 62 L100 70",
            "M18 0 L24 80",
            "M48 0 L44 80",
            "M74 0 L80 80",
            "M0 38 L100 32",
          ].map((d) => (
            <path key={d} d={d} stroke="#ffffff" strokeWidth="1.6" fill="none" />
          ))}
          {["M0 8 L100 12", "M0 76 L100 78", "M8 0 L10 80", "M33 0 L30 80", "M62 0 L60 80", "M90 0 L92 80"].map((d) => (
            <path key={d} d={d} stroke="#e4e4e7" strokeWidth="0.6" fill="none" />
          ))}
        </svg>
        {/* heat */}
        <div className="lp-heat absolute left-[12%] top-[18%] h-40 w-40 rounded-full bg-[radial-gradient(closest-side,rgba(255,77,74,.28),rgba(255,154,60,.12),transparent)]" />
        <div className="lp-heat absolute left-[52%] top-[10%] h-36 w-36 rounded-full bg-[radial-gradient(closest-side,rgba(255,154,60,.25),rgba(245,208,76,.1),transparent)] [animation-delay:1.5s]" />
        <div className="lp-heat absolute left-[60%] top-[45%] h-44 w-44 rounded-full bg-[radial-gradient(closest-side,rgba(245,208,76,.25),rgba(127,180,255,.08),transparent)] [animation-delay:3s]" />
        {/* pins */}
        {PINS.map((p, i) => (
          <span
            key={i}
            className="lp-pin-pulse absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-sm"
            style={{ left: `${p.x}%`, top: `${p.y}%`, background: p.c, color: p.c }}
          >
            <span className="text-white">{p.l}</span>
          </span>
        ))}
        {/* officer location */}
        <span className="absolute left-[46%] top-[56%] h-4 w-4 rounded-full border-[3px] border-white bg-[#1a73e8] shadow-[0_0_0_10px_rgba(26,115,232,.22)]" />
        <svg viewBox="0 0 100 80" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <path className="lp-route" d="M30 78 C 34 60, 42 50, 64 22" stroke="#a1a1aa" strokeWidth="0.5" fill="none" />
        </svg>
      </div>

      {/* Citizen report card */}
      <div className="lp-float absolute -left-3 bottom-[8%] w-[56%] rounded-2xl border border-zinc-200 bg-white p-4 text-zinc-900 shadow-xl sm:-left-8">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#63676e]">
          <Camera size={14} /> New report
        </div>
        <p className="lp-typing mt-2 text-[13.5px] leading-snug">Big pothole full of water outside the school gate, cars swerving</p>
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-[12px] text-[#3a3d42]">
          <MapPin size={13} className="text-[#ff6b1a]" /> Pin confirmed · MG Road
        </div>
      </div>

      {/* Ticket card */}
      <div className="lp-float-slow absolute -right-2 top-[6%] w-[52%] sm:-right-6">
        <div className="lp-ticket rounded-2xl border border-zinc-200 bg-white p-4 text-zinc-900 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#63676e]">Ticket created</span>
            <span className="rounded-full bg-[#fdf0e3] px-2 py-0.5 text-[11px] font-semibold text-[#c2570c]">◆ High</span>
          </div>
          <p className="mt-2 text-[14px] font-semibold">Roads · Pothole</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-[#3a3d42]">Water-filled pothole is obstructing a lane outside a school.</p>
          <p className="mt-2.5 flex items-center gap-1 text-[12px] text-[#63676e]">
            <ArrowRight size={13} className="text-[#ff6b1a]" /> Roads Maintenance
          </p>
        </div>
      </div>
    </div>
  );
}
