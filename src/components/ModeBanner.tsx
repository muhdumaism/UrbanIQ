import type { ModeInfo } from "@/lib/mode";

export function ModeBanner({ mode, compact = false }: { mode: ModeInfo; compact?: boolean }) {
  if (mode.demo) {
    return (
      <div role="note" className="border-b border-zinc-200 bg-zinc-100 text-[13px] text-zinc-600">
        <div className={`mx-auto flex max-w-6xl items-center gap-2 px-4 ${compact ? "py-1.5" : "py-2"}`}>
          <span className="rounded-full bg-[#fff4ed] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#c2410c]">Demo mode</span>
          <span>
            This is a demonstration setup. Reports are sorted by built-in rules, not live AI.
          </span>
        </div>
      </div>
    );
  }
  if (!mode.liveAi) {
    return (
      <div role="note" className="bg-high-soft text-high text-[13px] border-b border-[#f3d2b5]">
        <div className="mx-auto max-w-6xl px-4 py-2">
          <strong>AI triage is required (AI_PROVIDER=anthropic) but no ANTHROPIC_API_KEY is set.</strong> New reports are saved and sent to manual review.
        </div>
      </div>
    );
  }
  return null;
}
