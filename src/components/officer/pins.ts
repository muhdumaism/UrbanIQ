import type { SeverityCode } from "@/lib/taxonomy";

export const PIN_STYLE: Record<SeverityCode, { bg: string; letter: string }> = {
  CRITICAL: { bg: "#ff4d4a", letter: "C" },
  HIGH: { bg: "#ff9a3c", letter: "H" },
  MEDIUM: { bg: "#f5d04c", letter: "M" },
  LOW: { bg: "#7fb4ff", letter: "L" },
};

/** Severity pins: colour + letter (never colour alone); dashed outline = approximate location. */
export function pinCss(sev: SeverityCode, precise: boolean, active: boolean, hot: boolean) {
  const size = active ? 34 : hot ? 30 : 24;
  return `width:${size}px;height:${size}px;border-radius:9999px;background:${PIN_STYLE[sev].bg};color:#0d1013;font:700 ${active ? 14 : 12}px/1 system-ui,sans-serif;display:flex;align-items:center;justify-content:center;cursor:pointer;border:2.5px ${precise ? "solid" : "dashed"} #0d1013;box-shadow:${active ? "0 0 0 4px #fff, 0 0 0 9px rgba(205,235,63,.55)" : hot ? "0 0 0 3px #fff" : "0 1px 6px rgba(0,0,0,.6)"};transition:width .12s,height .12s,box-shadow .12s;`;
}
