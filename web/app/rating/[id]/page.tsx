import { notFound } from "next/navigation";
import Link from "next/link";
import type { Hex } from "viem";
import { SiteHeader } from "@/components/site-header";
import { GradeChip } from "@/components/grade-chip";
import { DimensionBar } from "@/components/dimension-bar";
import { VerifyControl } from "@/components/verify-control";
import { SiteFooter } from "@/components/site-footer";
import { TriggerRating } from "@/components/trigger-rating";
import {
  subjectById,
  getLatestRating,
  EXPLORER,
  RATING_REGISTRY,
  IDENTITY_REGISTRY,
  AGENT_TOKEN_ID,
  shortHash,
  relativeTime,
} from "@/lib/touchstone";
import { fetchReasoningDoc, compositeOf, DIMENSION_ORDER, type Dimension } from "@/lib/reasoning";
import { familyOf, FAMILY_LABEL, FAMILY_MEANING, CONFIDENCE_LABEL, letterOf, gradeBand } from "@/lib/grades";

export const dynamic = "force-dynamic";

export default async function RatingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const subject = subjectById(id);
  if (!subject) notFound();

  const rating = await getLatestRating(subject.address).catch(() => null);
  const doc = rating ? await fetchReasoningDoc(rating.cid) : null;
  const dims: Dimension[] = doc
    ? (DIMENSION_ORDER.map((k) => doc.dimensions.find((d) => d.key === k)).filter(Boolean) as Dimension[])
    : [];
  // The composite (0–100) is the number the grade ladder maps to a letter —
  // distinct from confidence. Surfaced so "composite 66 → BBB" is visible.
  const composite = doc ? compositeOf(doc.dimensions) : null;

  const fam = rating ? familyOf(rating.grade) : "prime";

  return (
    <main id="main-content" className="min-h-screen grid-bg">
      <div className="mx-auto max-w-terminal px-6 md:px-10">
        <SiteHeader />

        {/* subject + grade hero */}
        <section className="grid gap-8 border-b rule py-10 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <Link
              href="/"
              className="label relative -top-3 mb-3 inline-flex min-h-6 items-center hover:text-ink transition-colors"
            >
              ← Back to home
            </Link>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-mono text-lg">{subject.id}</span>
              <a
                href={`${EXPLORER}/address/${subject.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="label inline-flex min-h-6 items-center hover:text-ink transition-colors"
              >
                {shortHash(subject.address)} ↗
              </a>
            </div>
            <h1 className="mt-1 font-serif text-4xl">{subject.name}</h1>
            <p className="mt-3 max-w-xl text-sm text-muted">{subject.blurb}</p>
          </div>

          {rating ? (
            <div className="md:text-right">
              <GradeChip uint8={rating.grade} size="hero" showLabel={false} />
              <p className="mt-2 text-sm" style={{ color: `rgb(var(--ts-${fam}))` }}>
                {FAMILY_LABEL[fam]}
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted md:ml-auto">{FAMILY_MEANING[fam]}</p>
              <div className="mt-4 flex gap-6 md:justify-end">
                {composite !== null && (
                  <div>
                    <div className="font-mono text-sm tnum text-left">
                      {composite}<span className="text-faint">/100</span>
                    </div>
                    <div className="label">Composite · {letterOf(rating.grade)}</div>
                  </div>
                )}
                <div>
                  <div className="font-mono text-sm tnum text-left">{rating.confidence}</div>
                  <div className="label">Confidence · {CONFIDENCE_LABEL(rating.confidence)}</div>
                </div>
                <div>
                  <div className="font-mono text-sm tnum">{relativeTime(rating.timestamp)}</div>
                  <div className="label">Published</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="md:text-right">
              <p className="font-serif text-4xl text-faint">—</p>
              <p className="label mt-2">Not yet rated</p>
            </div>
          )}
        </section>

        {!rating ? (
          <section className="py-16">
            <p className="max-w-lg text-sm text-muted">
              No rating has been published for {subject.id} yet. Anyone can trigger one on-chain via{" "}
              <code className="font-mono text-ink">requestRating({shortHash(subject.address)})</code>;
              the agent listens, runs the engine, and publishes the grade here.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <TriggerRating
                subjectId={subject.id}
                subjectAddress={subject.address}
                className="inline-flex min-h-6 items-center gap-1 border border-accent bg-accent px-4 py-2 font-mono text-2xs uppercase tracking-label text-accent-ink transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-60"
              />
              <Link href="/" className="label inline-flex min-h-6 items-center hover:text-ink">
                ← Back to board
              </Link>
            </div>
          </section>
        ) : (
          <>
            {/* dimensions */}
            <section className="py-8">
              <h2 className="label mb-1">Risk dimensions</h2>
              <p className="mb-4 max-w-xl text-xs text-muted">
                Four deterministic scores (0–100). Expand any dimension for the cited rationale —
                every claim links to its on-chain source.
              </p>
              {dims.length > 0 ? (
                dims.map((d) => <DimensionBar key={d.key} dim={d} />)
              ) : (
                <p className="border-y rule py-8 text-sm text-muted">
                  Reasoning JSON is still loading from IPFS (or the gateway is slow). The grade,
                  hash, and verification below are read directly from chain.
                </p>
              )}
              {dims.length > 0 && composite !== null && (
                <p className="mt-4 border-t rule pt-4 text-xs text-muted">
                  Averaged with equal 25% weight, the four scores give a composite of{" "}
                  <span className="font-mono text-ink">{composite}/100</span>, which the grade ladder
                  maps to{" "}
                  <span className="font-mono" style={{ color: `rgb(var(--ts-${fam}))` }}>
                    {letterOf(rating.grade)}
                  </span>{" "}
                  <span className="text-faint">(band {gradeBand(letterOf(rating.grade))})</span>.
                  Confidence ({rating.confidence}) is a separate measure of how much evidence was
                  readable — not a second score.
                </p>
              )}
            </section>

            {/* overall rationale */}
            {doc?.overall_rationale && (
              <section className="border-t rule py-8">
                <h2 className="label mb-3">Overall</h2>
                <div className="max-w-none space-y-4 font-sans text-lg leading-relaxed">
                  {toParagraphs(doc.overall_rationale).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </section>
            )}

            {/* verify */}
            <section className="py-8">
              <VerifyControl cid={rating.cid} reasoningHash={rating.reasoningHash as Hex} />
            </section>

            {/* on-chain record */}
            <section className="border-t rule py-8">
              <h2 className="label mb-4">On-chain record</h2>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 font-mono text-xs sm:grid-cols-2">
                <Row label="Grade (uint8)">
                  {letterOf(rating.grade)} · {rating.grade}
                </Row>
                <Row label="Reasoning hash">{shortHash(rating.reasoningHash, 10, 8)}</Row>
                <Row label="IPFS cid">
                  <a
                    href={`https://ipfs.io/ipfs/${rating.cid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-6 items-center text-ink hover:text-accent"
                  >
                    {shortHash(rating.cid, 8, 6)} ↗
                  </a>
                </Row>
                <Row label="Agent identity">
                  <a
                    href={`${EXPLORER}/token/${IDENTITY_REGISTRY}?a=${AGENT_TOKEN_ID}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-6 items-center text-ink hover:text-accent"
                  >
                    ERC-8004 #{AGENT_TOKEN_ID.toString()} ↗
                  </a>
                </Row>
                {doc && (
                  <>
                    <Row label="Ingest block">{doc.ingest_block.toLocaleString()}</Row>
                    <Row label="Model">{doc.claude_model}</Row>
                  </>
                )}
                <Row label="Contract">
                  <a
                    href={`${EXPLORER}/address/${RATING_REGISTRY}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-6 items-center text-ink hover:text-accent"
                  >
                    {shortHash(RATING_REGISTRY)} ↗
                  </a>
                </Row>
              </dl>
            </section>
          </>
        )}
        <SiteFooter />
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b rule pb-2">
      <dt className="label">{label}</dt>
      <dd className="tnum text-right text-ink">{children}</dd>
    </div>
  );
}

/** Split a free-text rationale into display paragraphs: honor explicit blank-line
 *  breaks if the source has them, otherwise group ~2 sentences per paragraph. */
function toParagraphs(text: string): string[] {
  const byBreaks = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  if (byBreaks.length > 1) return byBreaks;
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    out.push(sentences.slice(i, i + 2).join(" "));
  }
  return out;
}
