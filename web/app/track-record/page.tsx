import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { GradeChip } from "@/components/grade-chip";
import {
  ELIXIR,
  HISTORICAL_DIMENSION_ORDER,
  HISTORICAL_DIMENSION_LABEL,
  type HistoricalDimensionKey,
} from "@/lib/historical";
import { AGENT_ADDRESS, AGENT_TOKEN_ID, IDENTITY_REGISTRY, EXPLORER, shortHash } from "@/lib/touchstone";

export const metadata = {
  title: "Track record — Touchstone",
};

function tierColor(score: number) {
  const t = score >= 67 ? "prime" : score >= 50 ? "watch" : score >= 34 ? "caution" : "distress";
  return `rgb(var(--ts-${t}))`;
}

export default function TrackRecord() {
  const e = ELIXIR;

  return (
    <main id="main-content" className="min-h-screen grid-bg">
      <div className="mx-auto max-w-terminal px-6 md:px-10">
        <SiteHeader crumb={{ href: "/", label: "Board" }} />

        {/* lede */}
        <section className="border-b rule py-10 md:py-14">
          <p className="label mb-3">Track record · historical proof</p>
          <h1 className="max-w-4xl font-serif text-4xl md:text-display text-balance">
            The agent graded Elixir deUSD a B — days before it collapsed.
          </h1>
          <p className="mt-5 max-w-2xl text-sm text-muted">
            The same unmodified engine that rates the live board was run on Elixir deUSD&apos;s
            on-chain state at block {e.provenance.ingestBlock.toLocaleString()} — no special-casing,
            no hindsight. It returned a low, deteriorating grade and named the exact weakness that
            broke. This is a reconstruction for the record, not a live on-chain rating.
          </p>
        </section>

        {/* the call + the break */}
        <section className="grid gap-10 py-10 md:grid-cols-[auto_1fr] md:gap-16">
          {/* grade */}
          <div>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-lg">{e.subject.ticker}</span>
              <span className="label">Ethereum · {shortHash(e.subject.address)}</span>
            </div>
            <div className="mt-3">
              <GradeChip uint8={e.grade.uint8} size="hero" showLabel={false} />
            </div>
            <div className="mt-3 flex gap-6">
              <div>
                <div className="font-mono text-sm tnum">{e.grade.overall}/100</div>
                <div className="label">Composite</div>
              </div>
              <div>
                <div className="font-mono text-sm tnum">{e.grade.confidence}</div>
                <div className="label">Confidence</div>
              </div>
            </div>
          </div>

          {/* timeline */}
          <ol className="relative border-l rule-strong pl-6">
            <li className="relative pb-10">
              <span
                className="absolute -left-[31px] top-1 h-3 w-3 rounded-full"
                style={{ background: "rgb(var(--ts-accent))" }}
                aria-hidden="true"
              />
              <div className="label">{e.provenance.analysisDate} · the call</div>
              <p className="mt-2 max-w-xl text-sm leading-relaxed">
                Touchstone scores deUSD a{" "}
                <span className="font-serif text-xl" style={{ color: tierColor(e.grade.overall) }}>
                  B
                </span>{" "}
                ({e.grade.overall}/100). The hardcoded oracle, circular collateral and overstated TVL
                all flag — the engine cannot see a safe asset here.
              </p>
            </li>
            <li className="relative">
              <span
                className="absolute -left-[31px] top-1 h-3 w-3 rounded-full"
                style={{ background: "rgb(var(--ts-distress))" }}
                aria-hidden="true"
              />
              <div className="label" style={{ color: "rgb(var(--ts-distress))" }}>
                {e.provenance.collapseWindow} · the break
              </div>
              <p className="mt-2 max-w-xl text-sm leading-relaxed">
                deUSD depegs and collapses. The xUSD oracle — hard-coded to $1.00 across its lending
                markets — never reprices, so the recursive leverage unwinds into bad debt. Exactly the
                fault line the rating named.
              </p>
            </li>
          </ol>
        </section>

        {/* what the engine saw */}
        <section className="border-t rule py-10">
          <h2 className="label mb-1">What the engine saw</h2>
          <p className="mb-6 max-w-xl text-xs text-muted">
            Four deterministic scores and the specific red flag each surfaced. Oracle integrity is the
            one that later broke.
          </p>
          <div className="grid gap-px overflow-hidden border rule sm:grid-cols-2">
            {HISTORICAL_DIMENSION_ORDER.map((key: HistoricalDimensionKey) => {
              const d = e.dimensions[key];
              return (
                <div key={key} className="bg-bg p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm">{HISTORICAL_DIMENSION_LABEL[key]}</span>
                    <span className="font-mono text-base tnum" style={{ color: tierColor(d.score) }}>
                      {d.score}
                      <span className="text-faint">/100</span>
                    </span>
                  </div>
                  <div className="mt-2.5 h-[6px] w-full overflow-hidden bg-surface-2">
                    <div className="h-full" style={{ width: `${d.score}%`, background: tierColor(d.score) }} />
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    <span className="label mr-1 align-middle" style={{ color: "rgb(var(--ts-distress))" }}>
                      flag
                    </span>
                    {d.red_flag}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* permanent identity record */}
        <section className="border-t rule py-10">
          <h2 className="label mb-4">A permanent record</h2>
          <p className="mb-5 max-w-2xl text-sm text-muted">
            Every live grade is signed and published under the agent&apos;s on-chain ERC-8004 identity
            — an append-only history no rating agency has ever had. Today&apos;s calls become
            tomorrow&apos;s track record.
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-3 font-mono text-xs">
            <a
              href={`${EXPLORER}/token/${IDENTITY_REGISTRY}?a=${AGENT_TOKEN_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-6 items-center text-ink hover:text-accent"
            >
              ERC-8004 identity #{AGENT_TOKEN_ID.toString()} ↗
            </a>
            <a
              href={`${EXPLORER}/address/${AGENT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-6 items-center text-ink hover:text-accent"
            >
              Agent {shortHash(AGENT_ADDRESS)} ↗
            </a>
          </div>
          <Link href="/" className="label mt-8 inline-flex min-h-6 items-center hover:text-ink">
            ← Back to the live board
          </Link>
        </section>
        <SiteFooter />
      </div>
    </main>
  );
}
