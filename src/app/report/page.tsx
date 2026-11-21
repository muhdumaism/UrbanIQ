import type { Metadata } from "next";
import { ReportForm } from "@/components/ReportForm";
import { SiteHeader } from "@/components/SiteHeader";
import { ModeBanner } from "@/components/ModeBanner";
import { modeInfo } from "@/lib/mode";
import { currentCitizen, maskPhone } from "@/lib/citizen-auth";
import Link from "next/link";

export const metadata: Metadata = { title: "Report an issue" };
export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const mode = modeInfo();
  const citizen = await currentCitizen();
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
        <p className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-2">
          {citizen ? (
            <>
              Signed in as <strong className="text-ink">{maskPhone(citizen.phone)}</strong> — this report will appear in{" "}
              <Link href="/me" className="underline underline-offset-2">
                My reports
              </Link>
              .
            </>
          ) : (
            <>
              No account needed.{" "}
              <Link href="/login?next=/report" className="underline underline-offset-2">
                Sign in with your mobile
              </Link>{" "}
              to keep all your reports in one place (optional).
            </>
          )}
        </p>
        <div className="mt-8">
          <ReportForm />
        </div>
      </main>
    </>
  );
}
