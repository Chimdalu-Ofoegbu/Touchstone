import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { ConnectWallet } from "./connect-wallet";

/** Shared masthead. `crumb` renders a back link next to the wordmark. */
export function SiteHeader({ crumb }: { crumb?: { href: string; label: string } }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b rule-strong py-5">
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
      <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link
          href="/track-record"
          className="label inline-flex min-h-6 items-center hover:text-ink transition-colors"
        >
          Track record
        </Link>
        <Link
          href="/methodology"
          className="label hidden min-h-6 items-center hover:text-ink transition-colors sm:inline-flex"
        >
          Methodology
        </Link>
        <ConnectWallet />
        <ThemeToggle />
      </nav>
    </header>
  );
}
