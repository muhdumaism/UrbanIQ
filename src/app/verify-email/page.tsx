import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify your email", referrer: "no-referrer", robots: { index: false, follow: false } };
export default async function VerifyEmail({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  const valid = token && /^[A-Za-z0-9_-]{43}$/.test(token);
  return <><SiteHeader /><main id="main" className="mx-auto max-w-md px-4 py-12">
    <h1 className="text-3xl font-semibold">Verify your email</h1>
    {valid ? <form action="/api/citizen/email/verify" method="post" className="mt-6 space-y-4">
      <p>Confirm your email to finish creating your UrbanIQ account.</p>
      <input type="hidden" name="token" value={token} />
      <button className="btn-primary w-full">Verify email and sign in</button>
    </form> : <p className="mt-6" role="status">{error ? "This verification link is invalid, expired, or already used. Sign in with Google to request another email." : "Check your Google account’s inbox for a verification email. The link expires in 15 minutes. Check spam too, or sign in again to request another link."}</p>}
    <Link href="/login" className="mt-6 inline-block underline">Back to sign in</Link>
  </main></>;
}
