import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ModeBanner } from "@/components/ModeBanner";
import { LoginForm } from "@/components/officer/LoginForm";
import { currentOfficer } from "@/lib/auth";
import { modeInfo } from "@/lib/mode";

export const metadata: Metadata = { title: "Officer sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/officer") && !next.startsWith("//") ? next : "/officer";
  if (await currentOfficer()) redirect(safeNext);
  const mode = modeInfo();
  return (
    <>
      <ModeBanner mode={mode} compact />
      <main id="main" className="mx-auto flex min-h-[80dvh] max-w-md flex-col justify-center px-4 py-12">
        <Logo />
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">Officer sign in</h1>
        <p className="mt-2 text-ink-2">For municipal staff. Citizens don&apos;t need an account.</p>
        <LoginForm next={safeNext} demo={mode.demo} />
      </main>
    </>
  );
}
