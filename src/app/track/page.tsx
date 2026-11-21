import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { TrackLookup } from "@/components/TrackLookup";

export const metadata: Metadata = { title: "Track a report" };

export default function TrackIndex() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-xl px-4 pt-12">
        <p className="eyebrow">Track</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Track a report</h1>
        <p className="mt-3 text-ink-2">
          Paste the private tracking link you got after reporting. For your privacy, the report reference alone (CF-…) can&apos;t open a report.
        </p>
        <TrackLookup />
      </main>
    </>
  );
}
