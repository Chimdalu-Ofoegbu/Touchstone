import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Board, type BoardEntry } from "@/components/board";
import {
  getBoard,
  getRatingHistory,
  EXPLORER,
  RATING_REGISTRY,
  IDENTITY_REGISTRY,
  AGENT_TOKEN_ID,
  AGENT_ADDRESS,
  shortHash,
} from "@/lib/touchstone";

// Live on-chain data: read fresh every request so a newly published rating shows.
export const dynamic = "force-dynamic";

export default async function Home() {
  let entries: BoardEntry[] = [];
  let rpcOk = true;
  try {
    const board = await getBoard();
    entries = await Promise.all(
      board.map(async ({ subject, rating }) => {
        const history = rating ? await getRatingHistory(subject.address).catch(() => []) : [];
        return {
          id: subject.id,
          name: subject.name,
          blurb: subject.blurb,
          address: subject.address,
          rating: rating
            ? {
                grade: rating.grade,
                confidence: rating.confidence,
                reasoningHash: rating.reasoningHash,
                cid: rating.cid,
                timestamp: rating.timestamp,
              }
            : null,
          series: history.map((h) => h.grade),
        };
      }),
    );
  } catch {
    rpcOk = false;
  }

  return (
    <main className="min-h-screen grid-bg">
      <div className="mx-auto max-w-terminal px-6 md:px-10">
        {/* masthead + editorial lede */}
        <div>
          {/* masthead */}
          <header className="flex items-center justify-between border-b rule-strong py-5">
            <div className="flex items-baseline gap-3">
              <Link href="/" className="font-serif text-2xl leading-none">
                Touchstone
              </Link>
            </div>
            <nav className="flex items-center gap-5">
              <Link href="/track-record" className="label hover:text-ink transition-colors">
                Track record
              </Link>
              <a
                href={`${EXPLORER}/address/${RATING_REGISTRY}`}
                target="_blank"
                rel="noopener noreferrer"
                className="label hidden md:inline hover:text-ink transition-colors"
              >
                Contract ↗
              </a>
              <ThemeToggle />
            </nav>
          </header>

          {/* editorial lede — vertically centered, center-aligned */}
          <section className="flex flex-col items-start border-b rule pt-28 pb-20 text-left md:pt-[168px]">
            <p className="label mb-3">The agentic rating agency</p>
            <div className="grid w-full gap-x-16 gap-y-8 md:grid-cols-[1fr_auto] md:items-end">
              <h1 className="font-serif text-4xl md:text-display max-w-none text-balance">
                On-chain credit ratings for{" "}
                <br className="hidden md:inline" />
                Mantle real-world assets, with{" "}
                <br className="hidden md:inline" />
                reasoning you can verify.
              </h1>
              <p className="max-w-2xl text-sm text-muted md:max-w-sm">
                An autonomous agent scores four deterministic risk dimensions, has Claude synthesize a
                letter grade with cited rationale, and publishes every rating on-chain under an ERC-8004
                identity — bound to a reasoning hash anyone can re-verify against IPFS.
              </p>
            </div>
          </section>
        </div>

        {/* live board */}
        {rpcOk ? (
          <Board entries={entries} />
        ) : (
          <section className="py-16 text-center">
            <p className="label">Mantle RPC unavailable — retrying on refresh</p>
          </section>
        )}

        {/* footer */}
        <footer className="border-t rule-strong py-10">
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
              <Link
                href="/track-record"
                className="text-sm text-muted transition-colors hover:text-ink"
              >
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
            <span className="label">Built on Mantle · {new Date().getFullYear()}</span>
          </div>
        </footer>

      </div>
    </main>
  );
}
