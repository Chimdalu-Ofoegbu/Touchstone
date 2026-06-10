// agent/src/fixtures/types.ts
// Historical-proof fixture contract (Phase 3, REQ-06 start; D-04).
//
// WHY THIS FILE EXISTS — the SubjectId boundary (03-PATTERNS §SubjectId constraint):
// The live `SubjectId` union is `"USDY" | "cmETH" | "FBTC"` (agent/src/subjects/types.ts).
// The Elixir deUSD historical fixture must NOT pollute that union, or it would leak
// into getAdapter() / the live `pnpm rate` allow-list (agent/src/subjects/registry.ts,
// agent/src/cli.ts) and break the "live ratings aren't curated" boundary (D-04).
//
// `HistoricalFacts` mirrors `SubjectFacts` EXACTLY except `subject.ticker` is a
// dedicated `HistoricalSubjectId` literal rather than the live `SubjectId`. The four
// dimension scorers + synthesize read ONLY the typed buckets (collateral/contract/
// oracle/liquidity) — they never branch on `subject.ticker` (verified: each scorer's
// `get()` closure reads `facts.<bucket>` by label; see agent/src/dimensions/*.ts).
// That is what makes a `HistoricalFacts` structurally consumable by the UNMODIFIED
// engine with ZERO special-casing (D-04, 03-RESEARCH Pitfall 5).

import type { Fact } from "../subjects/types.js";

/** Tickers for historical-proof artifacts. Deliberately disjoint from the live `SubjectId`. */
export type HistoricalSubjectId = "deUSD";

/**
 * Structural twin of `SubjectFacts` for historical reconstructions. Same four
 * dimension buckets the scorers consume; only `subject.ticker` differs so the
 * fixture stays out of the live `SubjectId` union (and thus out of getAdapter()
 * and the live allow-list). NOT reachable via the live rate path.
 */
export type HistoricalFacts = {
  subject: {
    name: string;
    ticker: HistoricalSubjectId;
    /** Source-chain address (deUSD/xUSD are Ethereum, not Mantle — see fixture comment). */
    address: `0x${string}`;
    chainId: number;
  };
  ingestBlock: number;
  collateral: Fact[];
  contract: Fact[];
  oracle: Fact[];
  liquidity: Fact[];
};
