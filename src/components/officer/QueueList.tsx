"use client";
import type { QueueRow } from "@/lib/officer";
import { SEVERITY_LABEL, STATUS_LABEL, type TicketStatusCode } from "@/lib/taxonomy";
import { timeAgo } from "@/lib/format";
import { PIN_STYLE } from "./pins";

export function QueueList({
  state,
  rows,
  processing,
  failed,
  selectedId,
  onSelect,
  onHover,
  onRetry,
  filtered,
  distances,
  onClear,
}: {
  state: "loading" | "ready" | "error";
  rows: QueueRow[];
  processing: number;
  failed: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onRetry: () => void;
  filtered: boolean;
  distances?: Map<string, number>;
  onClear?: () => void;
}) {
  if (state === "loading")
    return (
      <div className="space-y-2 p-3" aria-busy="true" aria-label="Loading tickets">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-paper" />
        ))}
      </div>
    );
  if (state === "error")
    return (
      <div role="alert" className="m-3 rounded-lg bg-crit-soft p-3 text-[13px] text-crit">
        Couldn&apos;t load tickets.{" "}
        <button className="underline" onClick={onRetry}>
          Retry
        </button>
      </div>
    );

  const urgent = rows.filter((r) => r.urgentReview);
  const rest = rows.filter((r) => !r.urgentReview);

  return (
    <div className="pb-2">
      {(processing > 0 || failed > 0) && (
        <p className="px-3 pt-2 text-[12px] text-muted">
          {processing > 0 && `${processing} report${processing === 1 ? "" : "s"} processing`}
          {processing > 0 && failed > 0 && " · "}
          {failed > 0 && <span className="text-crit">{failed} AI failed</span>}
        </p>
      )}

      {rows.length === 0 && (
        <div className="p-6 text-center text-[13px]">
          <p className="font-medium">{filtered ? "No tickets match." : "No open tickets."}</p>
          {filtered ? (
            onClear && (
              <button className="mt-1 text-muted underline" onClick={onClear}>
                Clear filters
              </button>
            )
          ) : (
            <p className="mt-1 text-muted">New reports appear here automatically.</p>
          )}
        </div>
      )}

      {urgent.length > 0 && (
        <>
          <h2 className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-crit">Urgent review · {urgent.length}</h2>
          <ul>
            {urgent.map((r) => (
              <Row key={r.id} r={r} selected={r.id === selectedId} onSelect={onSelect} onHover={onHover} km={distances?.get(r.id)} />
            ))}
          </ul>
          {rest.length > 0 && <h2 className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">All tickets</h2>}
        </>
      )}
      <ul aria-label="Tickets">
        {rest.map((r) => (
          <Row key={r.id} r={r} selected={r.id === selectedId} onSelect={onSelect} onHover={onHover} km={distances?.get(r.id)} />
        ))}
      </ul>
    </div>
  );
}

function Row({ r, selected, onSelect, onHover, km }: { r: QueueRow; selected: boolean; onSelect: (id: string) => void; onHover: (id: string | null) => void; km?: number }) {
  const where = r.lat == null ? null : (r.locationText ?? r.ward ?? "Pinned location");
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(r.id)}
        onMouseEnter={() => onHover(r.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(r.id)}
        onBlur={() => onHover(null)}
        aria-current={selected ? "true" : undefined}
        className={`flex w-full gap-2.5 border-l-[3px] px-3 py-2.5 text-left transition-colors ${selected ? "border-ink bg-paper" : "border-transparent hover:bg-paper/70"} ${r.status === "RESOLVED" ? "opacity-60" : ""}`}
      >
        <span className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIN_STYLE[r.severity].bg }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[14px] font-medium">{r.title}</span>
            <span className="shrink-0 text-[12px] text-muted" title={new Date(r.createdAt).toLocaleString()}>
              {timeAgo(r.createdAt)}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-muted">
            <span className={r.severity === "CRITICAL" ? "font-medium text-crit" : ""}>{SEVERITY_LABEL[r.severity]}</span>
            <span aria-hidden="true">·</span>
            {where ? <span className="truncate">{where}</span> : <span className="text-med">Location missing</span>}
            {km != null && (
              <>
                <span aria-hidden="true">·</span>
                <span className="shrink-0 text-ink-2">{km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`} away</span>
              </>
            )}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-[12px]">
            <span className="text-ink-2">{STATUS_LABEL[r.status as TicketStatusCode]}</span>
            <span aria-hidden="true" className="text-muted">
              ·
            </span>
            {r.department ? <span className="truncate text-muted">{r.department}</span> : <span className="text-crit">Unassigned</span>}
            {r.reportCount > 1 && <span className="shrink-0 text-muted">· {r.reportCount} reports</span>}
            {r.pendingSuggestions > 0 && <span className="shrink-0 text-muted">· possible duplicate</span>}
            {r.isSample && (
              <span className="shrink-0 text-muted" title="Seeded illustrative data">
                · sample
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}
