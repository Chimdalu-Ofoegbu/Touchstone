"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { GradeChip } from "./grade-chip";
import { Sparkline } from "./sparkline";
import { TriggerRating } from "./trigger-rating";
import { familyOf, type GradeFamily, FAMILY_LABEL, CONFIDENCE_LABEL } from "@/lib/grades";
import { relativeTime, shortHash, RERATE_COOLDOWN_S } from "@/lib/touchstone";
import { usePending } from "@/lib/pending";

function FilterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 4h10l-3.8 4.6v3.2l-2.4 1.2V8.6L3 4Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Grade-family filter as a single dropdown (replaces the row of toggle buttons). */
function FilterDropdown({
  value,
  onChange,
}: {
  value: GradeFamily | "all";
  onChange: (v: GradeFamily | "all") => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = FILTERS.find((f) => f.key === value) ?? FILTERS[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filter by grade family"
        className="inline-flex min-h-6 items-center gap-2 border rule px-2.5 py-1 font-mono text-2xs uppercase tracking-label text-muted transition-colors hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <FilterIcon />
        <span className="text-ink">{current.label}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Filter by grade family"
          className="absolute left-0 top-full z-30 mt-1 min-w-[12rem] border rule-strong bg-surface-2 py-1"
        >
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="option"
              aria-selected={f.key === value}
              onClick={() => {
                onChange(f.key);
                setOpen(false);
              }}
              className={[
                "block w-full whitespace-nowrap px-3 py-1.5 text-left font-mono text-2xs uppercase tracking-label transition-colors",
                f.key === value ? "bg-accent text-bg" : "text-muted hover:bg-surface hover:text-ink",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type BoardEntry = {
  id: string;
  name: string;
  blurb: string;
  address: string;
  rating: {
    grade: number;
    confidence: number;
    composite: number | null;
    reasoningHash: string;
    cid: string;
    timestamp: number;
  } | null;
  series: number[];
};

type SortKey = "grade" | "confidence" | "updated";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "grade", label: "Grade" },
  { key: "confidence", label: "Confidence" },
  { key: "updated", label: "Updated" },
];
const FILTERS: { key: GradeFamily | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "prime", label: FAMILY_LABEL.prime },
  { key: "watch", label: FAMILY_LABEL.watch },
  { key: "caution", label: FAMILY_LABEL.caution },
  { key: "distress", label: FAMILY_LABEL.distress },
];

export function Board({ entries }: { entries: BoardEntry[] }) {
  const [sort, setSort] = useState<SortKey>("grade");
  const [filter, setFilter] = useState<GradeFamily | "all">("all");
  const { isPending } = usePending();
  // re-evaluate re-rate eligibility live; 0 until mounted so SSR and CSR match.
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000));
    const iv = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 15_000);
    return () => clearInterval(iv);
  }, []);

  const rows = useMemo(() => {
    const filtered = entries.filter(
      (e) => filter === "all" || (e.rating && familyOf(e.rating.grade) === filter),
    );
    const rated = filtered.filter((e) => e.rating);
    const unrated = filtered.filter((e) => !e.rating);
    rated.sort((a, b) => {
      const ra = a.rating!, rb = b.rating!;
      if (sort === "grade") return ra.grade - rb.grade; // best (low uint8) first
      if (sort === "confidence") return rb.confidence - ra.confidence;
      return rb.timestamp - ra.timestamp;
    });
    return [...rated, ...unrated];
  }, [entries, sort, filter]);

  return (
    <section className="mb-16 border rule-strong p-6 pb-0 md:p-8 md:pb-0">
      {/* controls */}
      <div className="reveal -mx-6 mb-[15px] flex flex-wrap items-center justify-between gap-4 border-b rule px-6 pb-[15px] md:-mx-8 md:px-8">
        <div className="flex items-center gap-2">
          <FilterDropdown value={filter} onChange={setFilter} />
        </div>
        <div className="flex items-center gap-2">
          <span className="label mr-1">Sort</span>
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              aria-pressed={sort === s.key}
              className={[
                "border px-2.5 py-1 font-mono text-2xs uppercase tracking-label transition-colors",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-accent",
                sort === s.key ? "bg-accent text-bg border-accent" : "text-muted hover:text-ink",
              ].join(" ")}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* column heads */}
      <div
        className="reveal -mx-6 grid grid-cols-12 border-b rule px-6 pb-2 label md:-mx-8 md:px-8"
        style={{ animationDelay: "60ms" }}
      >
        <div className="col-span-4">Subject</div>
        <div className="col-span-3">Grade</div>
        <div className="col-span-2">Confidence</div>
        <div className="col-span-1 text-right">Trend</div>
        <div className="col-span-2 text-right">Updated</div>
      </div>

      {/* rows */}
      {rows.map((e, i) => {
        const rowClass =
          "reveal -mx-6 grid grid-cols-12 items-center border-b rule px-6 py-5 group transition-colors last:border-b-0 md:-mx-8 md:px-8";
        const style = { animationDelay: `${120 + i * 70}ms` };
        const pending = isPending(e.id);

        // Subject cell for interactive rows (id links to detail without nesting in an <a>).
        const subjectCell = (
          <div className="col-span-4 pr-3">
            <Link href={`/rating/${e.id}`} className="font-mono text-sm transition-colors hover:text-accent">
              {e.id}
            </Link>
            <div className="text-xs text-muted">{e.name}</div>
          </div>
        );

        // Unrated: trigger a first rating.
        if (!e.rating) {
          return (
            <div key={e.id} className={rowClass} style={style}>
              {subjectCell}
              <div className="col-span-8 flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                <span className="label text-faint">Not yet rated</span>
                <span className="label text-faint" aria-hidden="true">
                  ·
                </span>
                <TriggerRating subjectId={e.id} subjectAddress={e.address} />
              </div>
            </div>
          );
        }

        // Rated. The row only hosts a control (re-rate, or "scoring") once the rating
        // is past the cooldown or a re-rate is in flight; otherwise it's a full-row link.
        const rerateEligible = now > 0 && now - e.rating.timestamp >= RERATE_COOLDOWN_S;
        const interactive = pending || rerateEligible;

        const ratedCells = (
          <>
            <div className="col-span-3">
              <GradeChip uint8={e.rating.grade} />
              {e.rating.composite !== null && (
                <div className="mt-1 font-mono text-2xs tnum text-faint">
                  {e.rating.composite}<span className="text-faint">/100 score</span>
                </div>
              )}
            </div>
            <div className="col-span-2">
              <div className="font-mono text-sm tnum">{e.rating.confidence}</div>
              <div className="label">{CONFIDENCE_LABEL(e.rating.confidence)} confidence</div>
            </div>
            <div className="col-span-1 flex justify-end">
              <Sparkline series={e.series} />
            </div>
            <div className="col-span-2 text-right">
              <div className="font-mono text-xs tnum text-muted">{relativeTime(e.rating.timestamp)}</div>
              {interactive ? (
                <div className="mt-0.5 flex justify-end">
                  <TriggerRating subjectId={e.id} subjectAddress={e.address} rerate />
                </div>
              ) : (
                <div className="font-mono text-2xs text-faint">{shortHash(e.rating.reasoningHash)}</div>
              )}
            </div>
          </>
        );

        if (interactive) {
          return (
            <div key={e.id} className={rowClass} style={style}>
              {subjectCell}
              {ratedCells}
            </div>
          );
        }

        return (
          <Link
            key={e.id}
            href={`/rating/${e.id}`}
            className={`${rowClass} hover:bg-surface/60 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent`}
            style={style}
          >
            <div className="col-span-4 pr-3">
              <div className="font-mono text-sm group-hover:text-accent transition-colors">{e.id}</div>
              <div className="text-xs text-muted">{e.name}</div>
            </div>
            {ratedCells}
          </Link>
        );
      })}
    </section>
  );
}
