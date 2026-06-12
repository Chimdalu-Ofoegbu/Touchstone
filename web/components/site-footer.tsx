import Link from "next/link";
import {
  EXPLORER,
  RATING_REGISTRY,
  IDENTITY_REGISTRY,
  AGENT_TOKEN_ID,
  AGENT_ADDRESS,
  shortHash,
} from "@/lib/touchstone";

/**
 * Shared site footer (used on every page for consistency). The inner content
 * drifts up as the footer scrolls into view via a CSS scroll-driven animation
 * (`.footer-parallax`) — no JS, graceful no-op where unsupported / reduced-motion.
 * `mt-32` sits it well below the content above.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="reveal mt-32 border-t rule-strong py-10" style={{ animationDelay: "120ms" }}>
      <div className="footer-parallax will-change-transform">
        <div className="grid gap-8 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="font-serif text-xl leading-none">
              Touchstone
            </Link>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-muted">
              An autonomous credit-ratings agency for on-chain real-world assets — every grade
              published on-chain under an ERC-8004 identity, bound to a reasoning hash anyone can
              re-verify against IPFS.
            </p>
          </div>

          <nav className="flex flex-col items-start gap-2">
            <span className="label mb-1">Explore</span>
            <Link href="/" className="text-sm text-muted transition-colors hover:text-ink">
              Ratings board
            </Link>
            <Link href="/track-record" className="text-sm text-muted transition-colors hover:text-ink">
              Track record
            </Link>
          </nav>

          <nav className="flex flex-col items-start gap-2">
            <span className="label mb-1">On-chain</span>
            <a
              href={`${EXPLORER}/address/${RATING_REGISTRY}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted transition-colors hover:text-ink"
            >
              Rating registry ↗
            </a>
            <a
              href={`${EXPLORER}/token/${IDENTITY_REGISTRY}?a=${AGENT_TOKEN_ID.toString()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted transition-colors hover:text-ink"
            >
              ERC-8004 identity #{AGENT_TOKEN_ID.toString()} ↗
            </a>
            <a
              href={`${EXPLORER}/address/${AGENT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-muted transition-colors hover:text-ink"
            >
              Agent {shortHash(AGENT_ADDRESS)} ↗
            </a>
          </nav>

          <div className="flex flex-col items-start gap-2">
            <span className="label mb-1">Network</span>
            <span className="text-sm text-muted">Mantle Mainnet</span>
            <span className="text-sm text-muted">Chain ID 5000</span>
            <span className="font-mono text-2xs text-faint">Reasoning pinned to IPFS</span>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t rule pt-6 md:flex-row md:items-center md:justify-between">
          <span className="label">Touchstone · the agentic rating agency</span>
          <span className="label">Built on Mantle · {year}</span>
        </div>
      </div>
    </footer>
  );
}
