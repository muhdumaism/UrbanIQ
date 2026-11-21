import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { CitizenLogin } from "@/components/CitizenLogin";
import { currentCitizen } from "@/lib/citizen-auth";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/officer") ? next : "/me";
  if (await currentCitizen()) redirect(safeNext);
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-md px-4 py-12">
        <p className="eyebrow">Citizen sign in</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in with your mobile</h1>
        <p className="mt-2 text-ink-2">Signing in is optional. It keeps all your reports in one place so you don&apos;t need to save tracking links.</p>
        <CitizenLogin next={safeNext} />
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
