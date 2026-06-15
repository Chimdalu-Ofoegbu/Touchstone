import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  LETTERS,
  familyOf,
  FAMILY_LABEL,
  FAMILY_MEANING,
  gradeBand,
  type GradeFamily,
} from "@/lib/grades";
import { DIMENSIONS, MAX_DIMENSION_SCORE, CONFIDENCE } from "@/lib/methodology";
import { EXPLORER, RATING_REGISTRY, shortHash } from "@/lib/touchstone";

export const metadata = {
  title: "Methodology — Touchstone",
  description:
    "How Touchstone grades a real-world asset: the AAA–D scale, four deterministic risk dimensions, the composite score, and how confidence works.",
};

const FAMILY_ORDER: GradeFamily[] = ["prime", "watch", "caution", "distress"];

export default function Methodology() {
  // Group the 10 letters under their family.
  const groups = FAMILY_ORDER.map((fam) => ({
    fam,
    letters: LETTERS.filter((l) => familyOf(LETTERS.indexOf(l)) === fam),
  }));

  return (
    <main className="min-h-screen grid-bg">
      <div className="mx-auto max-w-terminal px-6 md:px-10">
        <SiteHeader crumb={{ href: "/", label: "Board" }} />

        {/* lede */}
        <section className="border-b rule py-10 md:py-14">
          <p className="label mb-3">Methodology · how a grade is made</p>
          <h1 className="max-w-4xl font-serif text-4xl md:text-display text-balance">
            A letter grade, built from four readings of on-chain truth.
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted">
            Every Touchstone rating is computed, not estimated. The engine reads a subject&apos;s
            on-chain state at a fixed block, scores four independent risk dimensions on transparent
            bands, averages them, and maps the result onto a ten-step scale from AAA to D. Claude
            writes the reasoning and cites its evidence — but the grade and confidence are pinned by
            the deterministic engine, never by the model.
          </p>
        </section>

        {/* the scale */}
        <section className="border-b rule py-10">
          <h2 className="label mb-1">The scale · AAA → D</h2>
          <p className="mb-7 max-w-2xl text-xs text-muted">
            Ten grades in four families. The composite score (0–100) lands the asset in exactly one
            band. AAA is the best a real-world asset can earn.
          </p>

          <div className="grid gap-px overflow-hidden border rule">
            {groups.map(({ fam, letters }) => (
              <div key={fam} className="bg-bg p-5 md:p-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: `rgb(var(--ts-${fam}))` }}
                    aria-hidden="true"
                  />
                  <span className="label" style={{ color: `rgb(var(--ts-${fam}))` }}>
                    {FAMILY_LABEL[fam]}
                  </span>
                  <span className="text-xs text-muted">{FAMILY_MEANING[fam]}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-x-8 gap-y-4">
                  {letters.map((l) => (
                    <div key={l} className="flex items-baseline gap-3">
                      <span
                        className="font-serif text-4xl leading-none tabular-nums"
                        style={{ color: `rgb(var(--ts-${fam}))` }}
                      >
                        {l}
                      </span>
                      <span className="font-mono text-xs tnum text-faint">{gradeBand(l)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* the four dimensions */}
        <section className="border-b rule py-10">
          <h2 className="label mb-1">The four dimensions · 25% each</h2>
          <p className="mb-7 max-w-2xl text-xs text-muted">
            Each is a pure function over the subject&apos;s on-chain facts — no model in the loop, no
            hidden weighting. A subject climbs the bands as the evidence gets stronger; the top band
            of every dimension scores {MAX_DIMENSION_SCORE}.
          </p>

          <div className="grid gap-px overflow-hidden border rule md:grid-cols-2">
            {DIMENSIONS.map((d) => (
              <div key={d.key} className="bg-bg p-5 md:p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm">{d.label}</h3>
                  <span className="label">25%</span>
                </div>
                <p className="mt-2 text-sm text-ink/90">{d.question}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{d.summary}</p>

                {/* band ladder, worst → best */}
                <ol className="mt-4 space-y-1.5">
                  {d.bands.map((b) => (
                    <li key={b.score} className="flex items-center gap-3">
                      <span className="w-7 shrink-0 font-mono text-2xs tnum text-faint">{b.score}</span>
                      <span className="h-[3px] shrink-0 rounded-full" style={{ width: `${b.score / 2}px`, background: "rgb(var(--ts-accent))" }} aria-hidden="true" />
                      <span className="text-xs text-muted">{b.label}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        {/* composite */}
        <section className="border-b rule py-10">
          <h2 className="label mb-1">From four scores to one grade</h2>
          <div className="mt-5 grid gap-8 md:grid-cols-[1fr_auto] md:items-center md:gap-16">
            <p className="max-w-2xl text-sm leading-relaxed text-muted">
              The four dimension scores are averaged with equal 25% weight into a single composite,
              then mapped to a letter by a fixed table. Because every dimension caps at{" "}
              {MAX_DIMENSION_SCORE}, the composite caps near it too — so{" "}
              <span className="text-ink">AAA (≥ 90) demands all four dimensions at their best band</span>{" "}
              at once: treasury-grade collateral, a multi-sig timelocked admin, a hardened oracle
              stack, and anchor-level liquidity. That bar is why genuinely strong assets still settle
              into the A and BBB range.
            </p>
            <div className="shrink-0 border rule-strong p-6 font-mono text-sm">
              <div className="text-faint">composite =</div>
              <div className="mt-1 text-ink">
                round( (C + K + O + L) / 4 )
              </div>
              <div className="mt-3 text-faint">grade =</div>
              <div className="mt-1 text-ink">scoreTable( composite )</div>
              <div className="mt-3 text-2xs text-faint">C collateral · K contract · O oracle · L liquidity</div>
            </div>
          </div>
        </section>

        {/* confidence */}
        <section className="border-b rule py-10">
          <h2 className="label mb-1">Confidence · how complete the evidence is</h2>
          <div className="mt-5 grid gap-8 md:grid-cols-[1fr_auto] md:items-center md:gap-16">
            <div className="max-w-2xl">
              <p className="text-sm leading-relaxed text-muted">
                Confidence is <span className="text-ink">not</span> a second opinion on how good the
                asset is — the grade already says that. It measures how much of the on-chain evidence
                the engine could actually read. Every fact it can&apos;t resolve at the ingest block
                costs {CONFIDENCE.penaltyPerMissingFact} points, starting from {CONFIDENCE.base} and
                floored at {CONFIDENCE.floor}.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                So two assets can share a letter — say both BBB — while differing in confidence: the
                grade is the coarse ten-step band, confidence is the finer signal of how much was
                verifiable. A high grade with low confidence means &ldquo;looks strong, but we&apos;re
                reading partial data.&rdquo;
              </p>
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-mono text-2xs uppercase tracking-label">
                <span className="text-prime">≥ 80 · High</span>
                <span className="text-watch">55–79 · Moderate</span>
                <span className="text-distress">&lt; 55 · Low</span>
              </div>
              <p
                className="mt-5 border-l-2 pl-4 text-xs leading-relaxed text-muted"
                style={{ borderColor: "rgb(var(--ts-accent))" }}
              >
                <span className="text-ink">Confidence is not the composite score.</span> Both run
                0–100, but the composite — the number this scale grades into a letter — is the average
                of the four dimensions, while confidence only counts how much evidence was readable. A
                95 confidence is <span className="text-ink">not</span> a 95 composite and does not imply
                AAA: the three live subjects carry 85–95 confidence yet sit at composites of just 64–72
                — grades of A and BBB.
              </p>
            </div>
            <div className="shrink-0 border rule-strong p-6 font-mono text-sm">
              <div className="text-faint">confidence =</div>
              <div className="mt-1 text-ink">
                clamp( {CONFIDENCE.base} − {CONFIDENCE.penaltyPerMissingFact}·missing,
              </div>
              <div className="text-ink">
                &nbsp;&nbsp;&nbsp;&nbsp;{CONFIDENCE.floor}, {CONFIDENCE.ceiling} )
              </div>
            </div>
          </div>
        </section>

        {/* real, not estimated */}
        <section className="border-b rule py-10">
          <h2 className="label mb-4">Real ratings — reproducible by anyone</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                t: "Deterministic",
                b: "The four scorers are pure functions over on-chain facts at a pinned block. Re-run the engine on the same block and you get the same grade — byte for byte.",
              },
              {
                t: "Model-bounded",
                b: "Claude writes the rationale and must cite real facts (fabricated addresses are rejected), but the engine overrides the grade and confidence. The letter is never the model's to move.",
              },
              {
                t: "Verifiable",
                b: "Each rating is canonicalized (RFC 8785) and hashed. The hash is committed on-chain next to the IPFS CID, so the published reasoning can be re-hashed and checked against the chain.",
              },
            ].map((c) => (
              <div key={c.t} className="border rule p-5">
                <h3 className="label mb-2 text-ink">{c.t}</h3>
                <p className="text-xs leading-relaxed text-muted">{c.b}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 font-mono text-xs">
            <a
              href={`${EXPLORER}/address/${RATING_REGISTRY}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-6 items-center text-ink hover:text-accent"
            >
              RatingRegistry {shortHash(RATING_REGISTRY)} ↗
            </a>
            <Link href="/track-record" className="inline-flex min-h-6 items-center text-ink hover:text-accent">
              See it called early on Elixir deUSD →
            </Link>
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
