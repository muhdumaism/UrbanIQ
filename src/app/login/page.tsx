import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { googleConfigured, safeCitizenNext } from "@/lib/google-auth";
import { resendConfigured } from "@/lib/email-verification";
import { currentCitizen } from "@/lib/citizen-auth";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const safeNext = safeCitizenNext(next);
  const configured = googleConfigured() && resendConfigured();
  if (await currentCitizen()) redirect(safeNext);
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-md px-4 py-12">
        <p className="eyebrow">Citizen sign in</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in to UrbanIQ</h1>
        <p className="mt-2 text-ink-2">Signing in is optional. It keeps all your reports in one place so you don&apos;t need to save tracking links.</p>
        {error && <p role="alert" className="mt-4 text-crit">We couldn&apos;t complete sign-in or send the verification email. Please try again.</p>}
        {configured ? <a href={`/api/citizen/google?next=${encodeURIComponent(safeNext)}`} className="btn-outline mt-8 w-full">Continue with Google</a> : <p role="status" className="mt-8 text-muted">Google sign-in is not configured yet. You can still report without an account.</p>}
        <p className="mt-3 text-sm text-muted">For your first sign-in, we&apos;ll send an email to verify your account.</p>
        <p className="mt-8 text-sm text-muted">
          Don&apos;t want an account?{" "}
          <Link href="/report" className="underline underline-offset-2">
            Report without signing in
          </Link>
          . City staff:{" "}
          <Link href="/officer/login" className="underline underline-offset-2">
            officer sign in
          </Link>
          .
        </p>
      </main>
    </>
  );
}
