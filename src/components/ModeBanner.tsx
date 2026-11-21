import type { ModeInfo } from "@/lib/mode";

export function ModeBanner({ mode, compact = false }: { mode: ModeInfo; compact?: boolean }) {
  if (mode.demo) {
    return (
      <div role="note" className="bg-ink text-white text-[13px]">
        <div className={`mx-auto flex max-w-6xl items-center gap-2 px-4 ${compact ? "py-1.5" : "py-2"}`}>
          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink">Demo mode</span>
          <span className="text-white/85">
            Reports are triaged by a built-in rule-based classifier, not live AI. Set CIVICFLOW_MODE=production for real officer accounts.
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
