"use client";
import { useState } from "react";
import type { VisionEvidence } from "@/lib/vision";

const STATUS_TEXT: Record<VisionEvidence["status"], string> = {
  detected: "Detected",
  inconclusive: "Inconclusive",
  unavailable: "Unavailable",
  error: "Error",
  not_configured: "Not configured",
  no_photo: "No photo",
};

/** Photo with advisory detector boxes drawn over it. Boxes are normalised (0–1) to the stored image. */
export function PhotoWithDetections({ src, alt, vision }: { src: string; alt: string; vision: VisionEvidence | null }) {
  const [show, setShow] = useState(true);
  const boxes = (vision?.detections ?? []).filter((d) => d.confidence >= Math.min(0.25, vision?.threshold ?? 0.25)).slice(0, 5);
  return (
    <figure>
      <div className="relative overflow-hidden rounded-lg border border-line bg-paper">
        <a href={src} target="_blank" rel="noreferrer" className="block">
          {/* Served by an authenticated route; never public. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="block w-full" loading="lazy" />
        </a>
        {show &&
          boxes.map((d, i) => {
            const isTop = vision?.top && d === vision.detections.find((x) => x.label === vision.top!.label && x.confidence === vision.top!.confidence);
            return (
              <div
                key={i}
                aria-hidden="true"
                className={`pointer-events-none absolute border-2 ${isTop ? "border-accent" : "border-white/80 border-dashed"}`}
                style={{ left: `${d.box.x * 100}%`, top: `${d.box.y * 100}%`, width: `${d.box.w * 100}%`, height: `${d.box.h * 100}%` }}
              >
                <span className={`absolute -top-5 left-0 whitespace-nowrap rounded px-1 text-[10px] font-semibold ${isTop ? "bg-accent text-ink" : "bg-black/75 text-white"}`}>
                  {d.label.replace(/_/g, " ")} {Math.round(d.confidence * 100)}%
                </span>
              </div>
            );
          })}
      </div>
      {boxes.length > 0 && (
        <button type="button" className="mt-1 text-xs text-muted underline underline-offset-2" onClick={() => setShow((s) => !s)}>
          {show ? "Hide detector boxes" : "Show detector boxes"}
        </button>
      )}
    </figure>
  );
}

export function VisionSummary({ vision }: { vision: VisionEvidence | null }) {
  if (!vision || vision.status === "no_photo") return null;
  const tone =
    vision.status === "detected" ? "border-[#ffb98f] bg-accent-soft" : vision.status === "inconclusive" ? "border-line bg-paper" : "border-[#ecd894] bg-med-soft";
  return (
    <section aria-label="Photo detector evidence (advisory)" className={`rounded-lg border p-3 text-sm ${tone}`}>
      <p className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">Photo detector · advisory</span>
        <span className="chip h-5 border-line-strong bg-surface px-1.5 text-[10px]">{STATUS_TEXT[vision.status]}</span>
      </p>
      <p className="mt-1">{vision.message}</p>
      {vision.detections.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {vision.detections.slice(0, 5).map((d, i) => (
            <li key={i} className="flex justify-between gap-3 font-mono text-xs">
              <span>
                {d.label}
                {d.issueType ? ` → ${d.issueType}` : " (unmapped)"}
              </span>
              <span>
                {Math.round(d.confidence * 100)}% · box {Math.round(d.box.x * 100)},{Math.round(d.box.y * 100)} {Math.round(d.box.w * 100)}×{Math.round(d.box.h * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 text-xs text-muted">
        Detector output never sets severity or routing.
        {vision.model && ` Model ${vision.model.name}${vision.model.sha256 ? ` (${vision.model.sha256.slice(0, 12)}…)` : ""}.`} Threshold {Math.round(vision.threshold * 100)}%.
      </p>
    </section>
  );
}
