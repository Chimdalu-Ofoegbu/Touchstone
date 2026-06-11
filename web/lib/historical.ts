// web/lib/historical.ts
// The Elixir deUSD historical-downgrade proof (REQ-06). This artifact was produced
// by the UNMODIFIED Phase-2 engine on pre-failure on-chain state — no special-casing
// — then the asset collapsed days later. It is a reconstruction, NOT a live on-chain
// rating (so it is presented honestly as such).

import elixirRaw from "@/data/elixir-deusd.json";

export type HistoricalDimensionKey =
  | "collateral_quality"
  | "contract_risk"
  | "oracle_integrity"
  | "liquidity_stability";

export type HistoricalDimension = {
  score: number;
  band: string;
  raw_value: number;
  missing_facts: string[];
  red_flag: string;
};

export type HistoricalProof = {
  subject: { name: string; ticker: string; address: string; chainId: number };
  kind: string;
  note: string;
  provenance: {
    fixtureVersion: string;
    analysisDate: string;
    collapseWindow: string;
    ingestBlock: number;
  };
  grade: { letter: string; uint8: number; overall: number; confidence: number; totalMissingFacts: number };
  dimensions: Record<HistoricalDimensionKey, HistoricalDimension>;
};

export const ELIXIR = elixirRaw as HistoricalProof;

export const HISTORICAL_DIMENSION_ORDER: HistoricalDimensionKey[] = [
  "oracle_integrity",
  "collateral_quality",
  "contract_risk",
  "liquidity_stability",
];

export const HISTORICAL_DIMENSION_LABEL: Record<HistoricalDimensionKey, string> = {
  collateral_quality: "Collateral quality",
  contract_risk: "Contract risk",
  oracle_integrity: "Oracle integrity",
  liquidity_stability: "Liquidity & stability",
};
