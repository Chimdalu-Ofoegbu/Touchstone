import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

/** Shared masthead. `crumb` renders a back link next to the wordmark. */
export function SiteHeader({ crumb }: { crumb?: { href: string; label: string } }) {
  return (
    <header className="flex items-center justify-between border-b rule-strong py-5">
      <div className="flex items-baseline gap-3">
        <Link href="/" className="font-serif text-2xl leading-none">
          Touchstone
        </Link>
        {crumb && (
          <Link
            href={crumb.href}
            className="label inline-flex min-h-6 items-center hover:text-ink transition-colors"
          >
            ← {crumb.label}
          </Link>
        )}
      </div>
      <nav className="flex items-center gap-5">
        <Link
          href="/track-record"
          className="label inline-flex min-h-6 items-center hover:text-ink transition-colors"
        >
          Track record
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}
