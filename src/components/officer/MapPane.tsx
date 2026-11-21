"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { QueueRow } from "@/lib/officer";
import { SEVERITY_LABEL, type SeverityCode } from "@/lib/taxonomy";
import { fetchWards, googleMapsEnabled } from "../map/google";
import { PIN_STYLE } from "./pins";

const OfflineMap = dynamic(() => import("./OfficerMap").then((m) => m.OfficerMap), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-night" /> });
const GoogleMap = dynamic(() => import("./GoogleOfficerMap").then((m) => m.GoogleOfficerMap), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-night" /> });

type Props = {
  rows: QueueRow[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  officerPos?: { lat: number; lng: number; accuracy: number } | null;
  heatmap?: boolean;
};

/** Ward map (Google when configured, offline basemap otherwise) + legend + selected-ticket card. */
export function MapPane(props: Props) {
  const [googleFailed, setGoogleFailed] = useState(false);
  const [sampleGeo, setSampleGeo] = useState<boolean | null>(null);
  useEffect(() => {
    fetchWards()
      .then((w) => setSampleGeo(w.mode === "sample"))
      .catch(() => setSampleGeo(false));
  }, []);
  const useGoogle = googleMapsEnabled() && !googleFailed;
  const { officerPos, heatmap = true, ...mapProps } = props;
  const unlocated = props.rows.filter((r) => r.lat == null);
  return (
    <div className="absolute inset-0">
      {useGoogle ? (
        <GoogleMap {...mapProps} officerPos={officerPos ?? null} heatmap={heatmap} onFail={() => setGoogleFailed(true)} />
      ) : sampleGeo ? (
        <OfflineMap {...mapProps} />
      ) : sampleGeo === false ? (
        <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-night-text">
          <p>
            {googleFailed ? "Google Maps couldn't load." : "Add a Google Maps key to show the map."}
            <br />
            The queue, filters and ticket details still work.
          </p>
        </div>
      ) : null}

      {googleFailed && sampleGeo && (
        <p role="status" className="absolute right-3 top-14 max-w-xs rounded-lg bg-white px-3 py-2 text-xs text-ink shadow">
          Google Maps couldn&apos;t load; showing the offline map.
        </p>
      )}



      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-[#0d1013]/85 px-3 py-1.5 text-[12px] text-night-text lg:bottom-[100px] lg:left-[384px]">
        {(Object.keys(PIN_STYLE) as SeverityCode[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIN_STYLE[s].bg }} aria-hidden="true" />
            {SEVERITY_LABEL[s]}
          </span>
        ))}
        {unlocated.length > 0 && <span className="text-[#97a3ae]">· {unlocated.length} without location</span>}
      </div>
    </div>
  );
}
