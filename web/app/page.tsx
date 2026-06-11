import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Board, type BoardEntry } from "@/components/board";
import {
  getBoard,
  getRatingHistory,
  AGENT_TOKEN_ID,
  AGENT_ADDRESS,
  EXPLORER,
  RATING_REGISTRY,
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
        {/* masthead */}
        <header className="flex items-center justify-between border-b rule-strong py-5">
          <div className="flex items-baseline gap-3">
            <Link href="/" className="font-serif text-2xl leading-none">
              Touchstone
            </Link>
            <span className="label hidden sm:inline">Credit ratings · Mantle RWA</span>
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

        {/* editorial lede */}
        <section className="border-b rule py-10 md:py-14">
          <p className="label mb-3">The agentic rating agency</p>
          <h1 className="font-serif text-4xl md:text-display max-w-4xl text-balance">
            On-chain credit ratings for Mantle real-world assets, with reasoning you can verify.
          </h1>
          <p className="mt-5 max-w-2xl text-sm text-muted">
            An autonomous agent scores four deterministic risk dimensions, has Claude synthesize a
            letter grade with cited rationale, and publishes every rating on-chain under an ERC-8004
            identity — bound to a reasoning hash anyone can re-verify against IPFS.
          </p>
        </section>

        {/* live board */}
        {rpcOk ? (
          <Board entries={entries} />
        ) : (
          <section className="py-16 text-center">
            <p className="label">Mantle RPC unavailable — retrying on refresh</p>
          </section>
        )}

        {/* footer */}
        <footer className="border-t rule py-6 flex flex-col gap-2 md:flex-row md:justify-between">
          <span className="label">Touchstone · the Moody&apos;s of the agentic economy</span>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <a
              href={`${EXPLORER}/token/${"0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"}?a=${AGENT_TOKEN_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="label hover:text-ink transition-colors"
            >
              ERC-8004 identity #{AGENT_TOKEN_ID.toString()}
            </a>
            <a
              href={`${EXPLORER}/address/${AGENT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="label hover:text-ink transition-colors"
            >
              Agent {shortHash(AGENT_ADDRESS)}
            </a>
            <span className="label">Mantle Mainnet · chain 5000</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
