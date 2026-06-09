// agent/src/constants/prices.ts
// Static USD prices keyed by block range. Hash-determinism mechanism:
// the engine NEVER hits a live price API at rating time; instead this
// file is versioned and looked up by ingest_block. Phase 3 historical
// replay (Elixir deUSD) uses block-range entries; Phase 2 live runs use
// the default entry (recordedAtBlock 0).

export type PriceEntry = {
  recordedAtBlock: number;
  BTC_USD: number;
  ETH_USD: number;
  MNT_USD: number;
};

/**
 * Ordered from oldest to newest. priceAtBlock picks the highest entry
 * whose recordedAtBlock <= block.
 */
export const PRICES: PriceEntry[] = [
  // Phase 2 default — pinned at planning time (2026-06-09).
  { recordedAtBlock: 0, BTC_USD: 95_000, ETH_USD: 3_800, MNT_USD: 0.6 },
];

export function priceAtBlock(block: number): PriceEntry {
  let chosen = PRICES[0];
  for (const p of PRICES) {
    if (p.recordedAtBlock <= block) chosen = p;
  }
  return chosen;
}
