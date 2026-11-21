import Link from "next/link";
import { Logo } from "./Logo";
import { currentCitizen } from "@/lib/citizen-auth";

export async function SiteHeader() {
  const citizen = await currentCitizen();
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1">
          <Link href="/report" className="btn-ghost btn-sm">
            Report
          </Link>
          <Link href="/track" className="btn-ghost btn-sm">
            Track
          </Link>
          <Link href={citizen ? "/me" : "/login"} className="btn-outline btn-sm">
            {citizen ? "My reports" : "Sign in"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
