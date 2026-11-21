import type { Metadata } from "next";
import { ReportForm } from "@/components/ReportForm";
import { SiteHeader } from "@/components/SiteHeader";
import { ModeBanner } from "@/components/ModeBanner";
import { modeInfo } from "@/lib/mode";

export const metadata: Metadata = { title: "Report an issue" };
export const dynamic = "force-dynamic";

export default function ReportPage() {
  const mode = modeInfo();
  return (
    <>
      <ModeBanner mode={mode} compact />
      <SiteHeader />
      <main id="main" className="mx-auto max-w-xl px-4 pt-8 sm:pt-12">
        <p className="eyebrow">New report</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Report an issue</h1>
        <p id="form-intro" className="mt-3 text-ink-2">
          Tell us what you see and where. If someone is in immediate danger, call your local emergency number first.
        </p>
        <div className="mt-8">
          <ReportForm demo={mode.demo} />
        </div>
      </main>
    </>
  );
}
