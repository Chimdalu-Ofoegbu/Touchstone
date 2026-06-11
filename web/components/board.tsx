"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GradeChip } from "./grade-chip";
import { Sparkline } from "./sparkline";
import { Tooltip } from "./tooltip";
import { familyOf, type GradeFamily, FAMILY_LABEL, CONFIDENCE_LABEL } from "@/lib/grades";
import { relativeTime, shortHash } from "@/lib/touchstone";

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

export type BoardEntry = {
  id: string;
  name: string;
  blurb: string;
  address: string;
  rating: {
    grade: number;
    confidence: number;
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
    <section className="py-8">
      {/* controls */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Tooltip label="Filter" side="top">
            <button
              type="button"
              aria-label="Filter"
              tabIndex={0}
              className="mr-1 inline-flex min-h-6 min-w-6 items-center justify-center p-1 text-muted transition-colors hover:text-ink"
            >
              <FilterIcon />
            </button>
          </Tooltip>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={[
                "inline-flex min-h-6 items-center border px-2.5 py-1 font-mono text-2xs uppercase tracking-label transition-colors",
                filter === f.key ? "bg-accent-lo text-white border-accent-lo" : "text-muted hover:text-ink",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="label mr-1">Sort</span>
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              aria-pressed={sort === s.key}
              className={[
                "inline-flex min-h-6 items-center border px-2.5 py-1 font-mono text-2xs uppercase tracking-label transition-colors",
                sort === s.key ? "bg-accent-lo text-white border-accent-lo" : "text-muted hover:text-ink",
              ].join(" ")}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* column heads */}
      <div className="grid grid-cols-12 label border-b rule-strong pb-2">
        <div className="col-span-4">Subject</div>
        <div className="col-span-3">Grade</div>
        <div className="col-span-2 text-right">Confidence</div>
        <div className="col-span-1 text-right">Trend</div>
        <div className="col-span-2 text-right">Updated</div>
      </div>

      {/* rows */}
      {rows.map((e, i) => (
        <Link
          key={e.id}
          href={`/rating/${e.id}`}
          className="reveal grid grid-cols-12 items-center border-b rule py-5 group transition-colors hover:bg-surface/60 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <div className="col-span-4 pr-3">
            <div className="font-mono text-sm group-hover:text-accent transition-colors">{e.id}</div>
            <div className="text-xs text-muted">{e.name}</div>
          </div>
          {e.rating ? (
            <>
              <div className="col-span-3">
                <GradeChip uint8={e.rating.grade} />
              </div>
              <div className="col-span-2 text-right">
                <div className="font-mono text-sm tnum">{e.rating.confidence}</div>
                <div className="label">{CONFIDENCE_LABEL(e.rating.confidence)}</div>
              </div>
              <div className="col-span-1 flex justify-end">
                <Sparkline series={e.series} />
              </div>
              <div className="col-span-2 text-right">
                <div className="font-mono text-xs tnum text-muted">{relativeTime(e.rating.timestamp)}</div>
                <div className="font-mono text-2xs text-faint">{shortHash(e.rating.reasoningHash)}</div>
              </div>
            </>
          ) : (
            <div className="col-span-8 text-right">
              <span className="label">Not yet rated · trigger a rating</span>
            </div>
          )}
        </Link>
      ))}
    </section>
  );
}
