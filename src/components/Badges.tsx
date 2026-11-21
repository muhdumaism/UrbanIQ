import { SEVERITY_LABEL, STATUS_LABEL, type SeverityCode, type TicketStatusCode } from "@/lib/taxonomy";

const SEV_STYLE: Record<SeverityCode, string> = {
  CRITICAL: "bg-crit text-white border-crit",
  HIGH: "bg-high-soft text-high border-[#f1c9a5]",
  MEDIUM: "bg-med-soft text-med border-[#ecd894]",
  LOW: "bg-low-soft text-low border-[#c9d6e5]",
};
const SEV_ICON: Record<SeverityCode, string> = { CRITICAL: "▲", HIGH: "◆", MEDIUM: "●", LOW: "○" };

/** Severity always shows a text label + shape, never colour alone. */
export function SeverityBadge({ severity, size = "md" }: { severity: SeverityCode; size?: "sm" | "md" }) {
  return (
    <span className={`chip ${SEV_STYLE[severity]} ${size === "sm" ? "h-5 px-2 text-[11px]" : ""}`}>
      <span aria-hidden="true" className="text-[9px] leading-none">
        {SEV_ICON[severity]}
      </span>
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

const STATUS_STYLE: Record<TicketStatusCode, string> = {
  NEW: "border-line-strong bg-surface text-ink",
  NEEDS_REVIEW: "border-[#e7b7b5] bg-crit-soft text-crit",
  WAITING_FOR_DETAILS: "border-[#ecd894] bg-med-soft text-med",
  ACKNOWLEDGED: "border-[#c9d6e5] bg-low-soft text-low",
  IN_PROGRESS: "border-[#b9d36a] bg-accent-soft text-accent-ink",
  RESOLVED: "border-line bg-paper text-muted",
};

export function StatusBadge({ status, label }: { status: TicketStatusCode; label?: string }) {
  return <span className={`chip ${STATUS_STYLE[status]}`}>{label ?? STATUS_LABEL[status]}</span>;
}

export function SampleTag() {
  return (
    <span className="chip h-5 border-dashed border-line-strong bg-transparent px-1.5 text-[10px] uppercase tracking-wide text-muted" title="Seeded illustrative data">
      Sample
    </span>
  );
}
