"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import type { QueueRow } from "@/lib/officer";
import { SEVERITY_LABEL, STATUS_LABEL, type SeverityCode } from "@/lib/taxonomy";
import { googleMapsEnabled } from "../map/google";
import { PIN_STYLE } from "./pins";

const OfflineMap = dynamic(() => import("./OfficerMap").then((m) => m.OfficerMap), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-night" /> });
const GoogleMap = dynamic(() => import("./GoogleOfficerMap").then((m) => m.GoogleOfficerMap), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-night" /> });

type Props = { rows: QueueRow[]; selectedId: string | null; hoveredId: string | null; onSelect: (id: string) => void };

/** Ward map (Google when configured, offline basemap otherwise) + legend + selected-ticket card. */
export function MapPane(props: Props) {
  const [googleFailed, setGoogleFailed] = useState(false);
  const useGoogle = googleMapsEnabled() && !googleFailed;
  const selected = props.rows.find((r) => r.id === props.selectedId);
  const unlocated = props.rows.filter((r) => r.lat == null);
  return (
    <div className="absolute inset-0">
      {useGoogle ? <GoogleMap {...props} onFail={() => setGoogleFailed(true)} /> : <OfflineMap {...props} />}

      {googleFailed && (
        <p role="status" className="absolute right-3 top-14 max-w-xs rounded-lg bg-white px-3 py-2 text-xs text-ink shadow">
          Google Maps couldn&apos;t load; showing the offline map.
        </p>
      )}

      {selected && (
        <div aria-live="polite" className="absolute left-3 top-3 max-w-[min(360px,calc(100%-90px))] rounded-xl bg-white/95 px-3.5 py-2.5 text-sm text-ink shadow-lg ring-1 ring-black/5">
          <p className="flex items-center gap-2 font-medium">
            <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: PIN_STYLE[selected.severity].bg }} aria-hidden="true">
              {PIN_STYLE[selected.severity].letter}
            </span>
            {selected.reference} · {SEVERITY_LABEL[selected.severity]}
          </p>
          <p className="mt-0.5 truncate">{selected.title}</p>
          <p className="text-xs text-muted">
            {selected.lat == null ? "No map location" : (selected.ward ?? "Outside configured wards")} · {STATUS_LABEL[selected.status]}
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-2">
        <div className="pointer-events-auto rounded-xl bg-[#0d1013]/90 px-3 py-2.5 text-xs text-night-text ring-1 ring-night-line">
          <p className="mb-1.5 font-medium text-white">Severity</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
            {(Object.keys(PIN_STYLE) as SeverityCode[]).map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-[#0d1013]" style={{ background: PIN_STYLE[s].bg }} aria-hidden="true">
                  {PIN_STYLE[s].letter}
                </span>
                {SEVERITY_LABEL[s]}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-[#97a3ae]">Dashed outline = approximate location</p>
        </div>
        {unlocated.length > 0 && (
          <p className="pointer-events-auto rounded-xl bg-white px-3 py-2 text-xs font-medium text-ink shadow">
            {unlocated.length} ticket{unlocated.length === 1 ? "" : "s"} without a map location — listed in the queue
          </p>
        )}
      </div>
    </div>
  );
}
