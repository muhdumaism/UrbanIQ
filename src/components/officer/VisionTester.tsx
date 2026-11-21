"use client";
import { useState } from "react";
import type { VisionEvidence } from "@/lib/vision";
import { PhotoWithDetections, VisionSummary } from "./VisionEvidence";

export function VisionTester() {
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<VisionEvidence | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setResult(null);
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("image", file);
      const res = await fetch("/api/officer/system/vision-test", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Test failed.");
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="vt" className="mt-8 rounded-xl border border-line bg-surface p-5">
      <h2 id="vt" className="font-semibold">
        Test the photo detector
      </h2>
      <p className="mt-1 text-sm text-muted">Upload any photo to see exactly what YOLO detects. Nothing is saved.</p>
      <label className="btn-outline btn-sm mt-4 cursor-pointer">
        {busy ? "Analysing…" : "Choose a photo"}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => run(e.target.files?.[0])} disabled={busy} />
      </label>
      {error && (
        <p role="alert" className="mt-3 text-sm text-crit">
          {error}
        </p>
      )}
      {result && preview && (
        <div className="mt-4 space-y-3">
          <PhotoWithDetections src={preview} alt="Test photo" vision={result} />
          <VisionSummary vision={result} />
        </div>
      )}
    </section>
  );
}
