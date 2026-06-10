// agent/src/fixtures/elixir-deusd.ts
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │ HISTORICAL-PROOF ARTIFACT — NOT A LIVE SUBJECT.                           │
// │                                                                          │
// │ This is the Elixir deUSD pre-failure state, reconstructed as a static    │
// │ `HistoricalFacts` snapshot for the historical-downgrade proof (REQ-06,   │
// │ D-04). It is deliberately kept OUT of the live `SubjectId` union and is   │
// │ NOT registered in agent/src/subjects/registry.ts or the agent/src/cli.ts │
// │ allow-list — it is unreachable via getAdapter() / `pnpm rate`. Keeping it │
// │ separate is what preserves the "live Mantle ratings are NOT curated"      │
// │ boundary (D-04). Phase 4 renders the downgrade→failure timeline from the  │
// │ captured graded artifact (agent/out/historical/elixir-deusd.json).        │
// └──────────────────────────────────────────────────────────────────────────┘
//
// THE PROOF (D-04, 03-RESEARCH Pitfall 5): this file supplies FACTS ONLY. The
// UNMODIFIED Phase-2 engine (the four dimension scorers + synthesize) grades it.
// There is NO `if (ticker === "deUSD")` branch anywhere in agent/src/dimensions/.
// If the engine did not grade these facts low, that would be a FINDING about the
// scorers to surface — never a fixture patch or an engine special-case.
//
// TIMELINE (DEC-historical-proof-case; 01-lock-skeleton/RESEARCH.md §Track A Stream 3):
//   2025-10-28  Analyst CBB0FE publishes the xUSD 4.1x leverage analysis (public
//               on-chain math) — 6 days pre-failure. THIS is the pre-failure block
//               the snapshot represents: the red flags were all on-chain and
//               readable here.
//   2025-11-04  Stream Finance discloses a $93M operational loss.
//   2025-11-03..06  Elixir deUSD collapses ~98% ($1.00 → ~$0.015) within 48h as the
//               65%-xUSD backing depegs; ~$285M aggregate bad debt across Euler,
//               Morpho, Silo, Gearbox.
//
// THE FOUR RED FLAGS (verbatim per DEC-historical-proof-case), mapped to dimensions:
//   oracle      — xUSD oracle hardcoded $1.00 across Morpho/Euler/Elixir lending markets
//   collateral  — 65% xUSD concentration + circular collateralization (xUSD ↔ deUSD)
//   contract    — private unlisted Morpho markets, 4.1x recursive leverage
//   liquidity   — TVL discrepancy $520M claimed vs $160M actual; 12% yield vs ~4.8% Aave
//
// SOURCES (01-lock-skeleton/RESEARCH.md §Track A Stream 3):
//   - Analyst CBB0FE leverage analysis, 2025-10-28 (xUSD 4.1x recursive leverage).
//   - BlockEden "anatomy of the Stream Finance contagion", 2025-11-08
//     https://blockeden.xyz/blog/2025/11/08/m-defi-contagion/
//   - The Block, "$285M exposure map", 2025-11.
//   - DeFiLlama disputed-methodology note on the $520M-claimed vs $160M-actual gap.
//   - xUSD primary contract 0xe2fc85bfb48c4cf147921fbe110cf92ef9f26f94 (Ethereum).

import type { Fact } from "../subjects/types.js";
import type { HistoricalFacts } from "./types.js";

/** Provenance version for this historical snapshot. */
export const ELIXIR_VERSION = "1.0.0";

/** Documented analyst-analysis date (6 days pre-failure) — the snapshot's reference point. */
export const ELIXIR_ANALYSIS_DATE = "2025-10-28";

/** Collapse window. */
export const ELIXIR_COLLAPSE_WINDOW = "2025-11-03..06";

/** Shared source citation appended to every red-flag fact's evidence. */
const SRC = `per analyst CBB0FE leverage analysis ${ELIXIR_ANALYSIS_DATE} (6 days pre-failure) + BlockEden Stream-contagion anatomy 2025-11-08`;

/** deUSD/xUSD live on Ethereum, not Mantle. This is the xUSD primary contract. */
const XUSD_ETHEREUM: `0x${string}` =
  "0xe2fc85bfb48c4cf147921fbe110cf92ef9f26f94";

/**
 * Static-kind Fact builder for this historical snapshot. Mirrors
 * agent/src/subjects/static.ts staticFact() but stamps THIS file + version as
 * the provenance, and folds the documented public source into the evidence.
 */
function elixirFact(opts: {
  label: string;
  value: string | null;
  evidence: string;
}): Fact {
  return {
    label: opts.label,
    value: opts.value,
    evidence: opts.evidence,
    source: {
      kind: "static",
      file: "agent/src/fixtures/elixir-deusd.ts",
      version: ELIXIR_VERSION,
    },
  };
}

// ── COLLATERAL QUALITY ──────────────────────────────────────────────────────
// Red flag: 65% xUSD concentration + circular collateralization. The scorer
// (collateral-quality.ts) reads "issuer + collateral", "audits", "reserve
// attestation", "custodian". deUSD's backing was NOT treasury-grade (no +25),
// had no real audit trail (-10), no proof-of-reserves (DeFiLlama disputed it,
// -15), and no qualifying custodian — exactly the thin, circular structure that
// drives the worst collateral band.
const collateral: Fact[] = [
  elixirFact({
    label: "issuer + collateral",
    value:
      "deUSD issued by Elixir; ~65% backed by Stream-lent xUSD with circular collateralization (xUSD held deUSD in its own mix)",
    evidence: `deUSD collateral was 65% concentrated in a single private-market counterparty (xUSD) with a circular xUSD↔deUSD loop — not treasury-grade backing — ${SRC}.`,
  }),
  elixirFact({
    label: "audits",
    value: null,
    evidence: `No credible independent audit of the deUSD/xUSD collateral structure was available at the pre-failure block — ${SRC}.`,
  }),
  elixirFact({
    label: "reserve attestation",
    value: null,
    evidence: `No verifiable proof-of-reserves; DeFiLlama publicly disputed the reserve methodology behind the $520M claim — ${SRC}.`,
  }),
  elixirFact({
    label: "custodian",
    value: null,
    evidence: `No qualifying custodian; reserves sat inside private, unlisted Morpho markets rather than a custodian network — ${SRC}.`,
  }),
];

// ── CONTRACT RISK ───────────────────────────────────────────────────────────
// Red flag: private unlisted Morpho markets + 4.1x recursive leverage. The
// scorer (contract-risk.ts) reads "source verified", "audits", "proxy pattern",
// "timelock", "owner", "pausable". Opaque private markets => not source-verified;
// recursive looping with no timelock and concentrated/opaque admin => worst band.
const contract: Fact[] = [
  elixirFact({
    label: "source verified",
    value: "no",
    evidence: `Stream operated "private, unlisted markets on Morpho" — an opacity flag; the leveraged positions were not openly source-verified — ${SRC}.`,
  }),
  elixirFact({
    label: "audits",
    value: null,
    evidence: `No audit covering the recursive-leverage construction — ${SRC}.`,
  }),
  elixirFact({
    label: "proxy pattern",
    value:
      "private unlisted Morpho markets with 4.1x recursive leverage (xUSD looped)",
    evidence: `xUSD was 4.1x recursively leveraged through private, unlisted Morpho markets — recursive looping amplified systemic exposure beyond what surface metrics showed — ${SRC}.`,
  }),
  elixirFact({
    label: "timelock",
    value: null,
    evidence: `No timelock on the leveraged positions / admin — changes could land without delay — ${SRC}.`,
  }),
  elixirFact({
    label: "owner",
    value: null,
    evidence: `Admin/owner of the private markets was opaque and concentrated — treated as an EOA-shaped (no distributed admin) risk — ${SRC}.`,
  }),
  elixirFact({
    label: "pausable",
    value: "true",
    evidence: `Private-market admin retained concentrated kill-switch capability with no timelock — ${SRC}.`,
  }),
];

// ── ORACLE INTEGRITY ────────────────────────────────────────────────────────
// Red flag: $1.00 hardcoded xUSD oracle across Morpho/Euler/Elixir. The SINGLE
// most damning warning sign. The scorer (oracle-integrity.ts) reads "oracle
// architecture" + "staleness tolerance"; a "single trusted feed / no redundancy"
// architecture triggers the -25 penalty and the worst oracle band.
const oracle: Fact[] = [
  elixirFact({
    label: "oracle architecture",
    value:
      "xUSD price hardcoded to $1.00 across Morpho/Euler/Elixir lending markets — a single trusted feed with no redundancy and no on-chain price discovery",
    evidence: `Multiple lending protocols (Morpho, Euler, Elixir) hardcoded the xUSD oracle price to $1.00 — a single trusted feed with no redundancy; a textbook oracle-integrity failure readable directly from each market's oracle source — ${SRC}.`,
  }),
  elixirFact({
    label: "staleness tolerance",
    value: "none — price was a hardcoded constant, never refreshed",
    evidence: `The hardcoded $1.00 feed had no staleness guard at all — it was a constant, not a refreshed price — ${SRC}.`,
  }),
];

// ── LIQUIDITY & STABILITY ───────────────────────────────────────────────────
// Red flag: $520M claimed vs $160M actual TVL; 12% yield vs ~4.8% Aave baseline.
// The scorer (liquidity-stability.ts) bands on the LARGER of parent/mantle TVL in
// USD. deUSD is NOT on Mantle (mantle TVL = 0); the honest parent figure is the
// $160M actual user deposits — NOT the disputed $520M claim. We encode the honest
// $160M (banding it as "deep liquidity"), and document the claimed/actual gap +
// the anomalous yield premium in the evidence. NOTE: the deterministic TVL-band
// scorer rates raw size only — it does NOT penalize the claimed-vs-actual gap or
// the yield anomaly. That asymmetry is recorded as an engine FINDING in the
// 03-05 SUMMARY (it is NOT papered over by inflating or special-casing the fact).
const liquidity: Fact[] = [
  elixirFact({
    label: "mantle TVL (USD)",
    value: "0",
    evidence: `deUSD/xUSD were deployed on Ethereum (xUSD ${XUSD_ETHEREUM}), not Mantle — zero Mantle-side liquidity — ${SRC}.`,
  }),
  elixirFact({
    label: "parent TVL (USD)",
    value: "160000000",
    evidence: `Actual user deposits were ~$160M against a $520M claimed-assets headline (DeFiLlama disputed the methodology); deUSD also paid a ~12% yield vs an Aave ~4.8% baseline — an anomalous premium with no stated source — ${SRC}.`,
  }),
];

/**
 * Elixir deUSD pre-failure snapshot (the historical-downgrade proof).
 *
 * `ingestBlock` is a representative Ethereum pre-failure block (~2025-10-28, the
 * CBB0FE analysis date / 6 days pre-failure) — the curated snapshot at which all
 * four red flags were on-chain and readable. It is a documented reference point,
 * not a live read.
 */
export const ELIXIR_DEUSD: HistoricalFacts = {
  subject: {
    name: "Elixir deUSD (pre-failure, historical proof)",
    ticker: "deUSD",
    // xUSD primary contract on Ethereum — the source of the 65% concentration.
    address: XUSD_ETHEREUM,
    // Ethereum mainnet (1), NOT Mantle (5000) — this is deliberately a non-Mantle
    // historical artifact, kept off the live Mantle rate path.
    chainId: 1,
  },
  // Representative Ethereum pre-failure block (~2025-10-28). Documented snapshot,
  // not a live RPC read (01-lock-skeleton/RESEARCH.md notes the ~21,400,000 area).
  ingestBlock: 21_400_000,
  collateral,
  contract,
  oracle,
  liquidity,
};
