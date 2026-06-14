// web/lib/reasoning.ts
// Shape of the pinned reasoning JSON (mirrors agent/src/schema.ts ReasoningDocument)
// plus per-dimension UI metadata. The detail screen fetches this by the on-chain
// cid and renders the cited rationale; the verify control independently re-hashes it.

export type Citation = {
  id: number;
  label: string;
  value: string;
  source: { address: string; function: string; block_number: number };
  evidence: string;
};

export type DimensionKey =
  | "collateral_quality"
  | "contract_risk"
  | "oracle_integrity"
  | "liquidity_stability";

export type Dimension = {
  key: DimensionKey;
  score: number;
  band_hit: { max: number | null; score: number; label: string };
  missing_facts: string[];
  rationale: string;
  citations: Citation[];
};

export type ReasoningDocument = {
  schema_version: string;
  subject: { name: string; ticker: string; address: string; chain_id: number };
  grade: { letter: string; uint8: number };
  confidence: number;
  dimensions: Dimension[];
  overall_rationale: string;
  generated_at: string;
  claude_model: string;
  ingest_block: number;
};

export const DIMENSION_ORDER: DimensionKey[] = [
  "collateral_quality",
  "contract_risk",
  "oracle_integrity",
  "liquidity_stability",
];

/**
 * Composite score (0–100) = the rounded mean of the dimension scores, mirroring
 * the agent's synthesize.ts (uniform 25% weight). This is the number the grade
 * ladder maps to a letter (GRADE_MIN_SCORE) — distinct from confidence, which
 * measures data completeness. Returns null when no dimensions are available
 * (e.g. the reasoning JSON has not loaded from IPFS yet).
 */
export function compositeOf(dims: { score: number }[]): number | null {
  if (!dims.length) return null;
  return Math.round(dims.reduce((sum, d) => sum + d.score, 0) / dims.length);
}

export const DIMENSION_META: Record<DimensionKey, { label: string; blurb: string }> = {
  collateral_quality: {
    label: "Collateral quality",
    blurb: "What backs the token — how transparent, audited and concentrated the backing is.",
  },
  contract_risk: {
    label: "Contract risk",
    blurb: "Audit status, upgradeability, admin powers and timelocks on the contracts.",
  },
  oracle_integrity: {
    label: "Oracle integrity",
    blurb: "How the price or peg is sourced and settled on-chain — a single trusted feed is fragile.",
  },
  liquidity_stability: {
    label: "Liquidity & stability",
    blurb: "Depth of on-chain liquidity and how stable the peg or value has held.",
  },
};

const GATEWAYS = [
  process.env.NEXT_PUBLIC_IPFS_GATEWAY,
  "https://ipfs.io",
  "https://gateway.pinata.cloud",
  "https://dweb.link",
].filter(Boolean) as string[];

/** Server-side fetch + parse of the reasoning JSON by bare CID (first responsive gateway). */
export async function fetchReasoningDoc(cid: string): Promise<ReasoningDocument | null> {
  for (const g of GATEWAYS) {
    try {
      const res = await fetch(`${g.replace(/\/$/, "")}/ipfs/${cid}`, {
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (res.ok) return (await res.json()) as ReasoningDocument;
    } catch {}
  }
  return null;
}
