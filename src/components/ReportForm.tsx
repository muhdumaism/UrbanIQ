"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EMPTY_LOCATION, type PickedLocation } from "./map/location-types";
import { LocationField as LocationPicker } from "./map/LocationField";


const DRAFT_KEY = "civicflow:report-draft:v1";
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

type Errors = Partial<Record<"text" | "photo" | "location" | "form", string>>;

const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);

export function ReportForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [location, setLocation] = useState<PickedLocation>(EMPTY_LOCATION);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [restored, setRestored] = useState(false);
  const keyRef = useRef<string>("");
  const summaryRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Restore draft (text + location + idempotency key). Photos are not stored locally.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (typeof d.text === "string") setText(d.text);
        if (d.location) setLocation({ ...EMPTY_LOCATION, ...d.location });
        if (typeof d.key === "string") keyRef.current = d.key;
        if (d.text || d.location?.text || d.location?.lat) setRestored(true);
      }
    } catch {
      /* ignore */
    }
    if (!keyRef.current) keyRef.current = newKey();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ text, location, key: keyRef.current }));
    } catch {
      /* storage unavailable */
    }
  }, [text, location]);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const choosePhoto = (f: File | null) => {
    setErrors((e) => ({ ...e, photo: undefined }));
    if (!f) return;
    if (!TYPES.includes(f.type)) return setErrors((e) => ({ ...e, photo: "Photos must be JPEG, PNG or WebP." }));
    if (f.size > MAX_BYTES) return setErrors((e) => ({ ...e, photo: "Photos must be 10 MB or smaller." }));
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
  };
  const removePhoto = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (!text.trim() && !photo) e.text = "Describe the issue, add a photo, or both.";
    else if (text.trim() && text.trim().length < 3 && !photo) e.text = "Please add a few more words about the issue.";
    if (location.lat != null && !location.confirmed) e.location = "Confirm the pin on the map, or remove it.";
    return e;
  };

  const showErrors = (e: Errors) => {
    setErrors(e);
    requestAnimationFrame(() => summaryRef.current?.focus());
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (submitting) return;
    const e = validate();
    if (Object.keys(e).length) return showErrors(e);
    setErrors({});
    setSubmitting(true);
    const fd = new FormData();
    fd.set("idempotencyKey", keyRef.current);
    fd.set("text", text);
    if (photo) fd.set("photo", photo);
    fd.set("locationText", location.text);
    fd.set("locationSource", location.source);
    fd.set("locationConfirmed", String(location.confirmed));
    if (location.lat != null && location.lng != null) {
      fd.set("lat", String(location.lat));
      fd.set("lng", String(location.lng));
      if (location.placeId) fd.set("placeId", location.placeId);
    }
    // Network retries reuse the same idempotency key, so a retry can never create a second report.
    let lastErr = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch("/api/reports", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          try {
            localStorage.removeItem(DRAFT_KEY);
          } catch {}
          router.push(`/track/${data.token}?new=1`);
          return;
        }
        if (res.status >= 400 && res.status < 500) {
          setSubmitting(false);
          return showErrors({ form: data.error ?? "Please check the form.", ...(data.fieldErrors ?? {}) });
        }
        lastErr = data.error ?? "Server error";
      } catch {
        lastErr = "Network problem";
      }
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
    setSubmitting(false);
    showErrors({ form: `${lastErr}. Your report hasn't been lost — check your connection and press Submit again.` });
  };

  const errorList = Object.entries(errors).filter(([, v]) => v) as [keyof Errors, string][];
  const anchors: Record<string, string> = { text: "#text", photo: "#photo-input", location: "#loc-text", form: "#text" };

  return (
    <form onSubmit={submit} noValidate className="space-y-8 pb-28 sm:pb-8" aria-describedby="form-intro">
      {restored && (
        <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-2">
          We restored your unsent draft.{" "}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => {
              setText("");
              setLocation(EMPTY_LOCATION);
              keyRef.current = newKey();
              setRestored(false);
            }}
          >
            Start over
          </button>
        </p>
      )}

      {errorList.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-xl border border-[#e7b7b5] bg-crit-soft p-4 text-sm text-crit outline-none">
          <p className="font-semibold">Please check the following</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errorList.map(([k, v]) => (
              <li key={k}>
                <a href={anchors[k]} className="underline underline-offset-2">
                  {v}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section aria-labelledby="h-what">
        <h2 id="h-what" className="text-lg font-semibold tracking-tight">
          What&apos;s the problem?
        </h2>
        <label htmlFor="text" className="sr-only">
          Describe the issue
        </label>
        <textarea
          id="text"
          name="text"
          rows={6}
          maxLength={4000}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (errors.text) setErrors((x) => ({ ...x, text: undefined }));
          }}
          aria-invalid={Boolean(errors.text)}
          aria-describedby={errors.text ? "text-error" : "text-hint"}
          placeholder="What did you see, and is anyone at risk? e.g. “A pothole full of water is blocking a lane outside Alder Primary School.”"
          className="input mt-3 h-auto min-h-40 py-3 text-base leading-relaxed"
        />
        {errors.text ? (
          <p id="text-error" className="mt-1.5 text-sm text-crit">
            {errors.text}
          </p>
        ) : (
          <p id="text-hint" className="mt-1.5 hint">
            Text, a photo, or both. {text.length > 3500 && `${4000 - text.length} characters left.`}
          </p>
        )}
      </section>

      <section aria-labelledby="h-photo">
        <h2 id="h-photo" className="text-lg font-semibold tracking-tight">
          Add a photo <span className="text-base font-normal text-muted">(optional)</span>
        </h2>
        {preview ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Preview of the photo you selected" className="max-h-80 w-full object-cover" />
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="truncate text-muted">
                {photo?.name} · {((photo?.size ?? 0) / 1024 / 1024).toFixed(1)} MB
              </span>
              <button type="button" onClick={removePhoto} className="btn-outline btn-sm">
                Remove photo
              </button>
            </div>
          </div>
        ) : (
          <label
            htmlFor="photo-input"
            className={`mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors hover:border-ink ${errors.photo ? "border-crit" : "border-line-strong"} bg-surface`}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            <span className="font-medium">Take or upload a photo</span>
            <span className="hint">JPEG, PNG or WebP, up to 10 MB. Location data in the file is removed.</span>
          </label>
        )}
        <input
          ref={fileRef}
          id="photo-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="sr-only"
          aria-invalid={Boolean(errors.photo)}
          aria-describedby={errors.photo ? "photo-error" : undefined}
          onChange={(e) => choosePhoto(e.target.files?.[0] ?? null)}
        />
        {errors.photo && (
          <p id="photo-error" className="mt-1.5 text-sm text-crit">
            {errors.photo}
          </p>
        )}
      </section>

      <section aria-labelledby="h-where">
        <h2 id="h-where" className="text-lg font-semibold tracking-tight">
          Where is it?
        </h2>
        <p className="mb-3 hint">Use your location, tap the map, or type a landmark. You can also send without a location — we&apos;ll ask you for it.</p>
        <LocationPicker
          value={location}
          onChange={(v) => {
            setLocation(v);
            if (errors.location) setErrors((x) => ({ ...x, location: undefined }));
          }}
          error={errors.location}
        />
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <button type="submit" className="btn-primary h-12 flex-1 text-base sm:flex-none sm:px-10" disabled={submitting} aria-describedby="submit-hint">
            {submitting ? "Sending…" : "Submit report"}
          </button>
          <p id="submit-hint" className="hidden text-sm text-muted sm:block">
            You&apos;ll get a private tracking link.
          </p>
        </div>
      </div>
    </form>
  );
}
