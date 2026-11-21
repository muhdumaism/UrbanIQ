import Link from "next/link";
import { Logo } from "./Logo";

export function SiteHeader() {
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
        </nav>
      </div>
    </header>
  );
}
