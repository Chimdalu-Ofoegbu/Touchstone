// agent/src/fixtures/capture-elixir.ts
//
// One-shot: grade the Elixir deUSD historical fixture with the UNMODIFIED Phase-2
// engine and write the deterministic graded artifact to
// agent/out/historical/elixir-deusd.json (the fixed artifact Phase 4 renders, so the
// demo does not compute live). Run via:  pnpm capture-elixir
//
// D-04 / 03-RESEARCH Pitfall 5: imports the four dimension scorers + synthesize
// UNCHANGED and calls them as-is. NO engine special-casing. Pure given the fixture
// (no live RPC, no Claude) — fully deterministic.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { scoreCollateral } from "../dimensions/collateral-quality.js";
import { scoreContractRisk } from "../dimensions/contract-risk.js";
import { scoreOracleIntegrity } from "../dimensions/oracle-integrity.js";
import { scoreLiquidityStability } from "../dimensions/liquidity-stability.js";
import { synthesize } from "../dimensions/synthesize.js";
import type { SubjectFacts } from "../subjects/types.js";
import {
  ELIXIR_DEUSD,
  ELIXIR_VERSION,
  ELIXIR_ANALYSIS_DATE,
  ELIXIR_COLLAPSE_WINDOW,
} from "./elixir-deusd.js";

/**
 * The dimension scorers' parameter type is `SubjectFacts`, but every scorer reads
 * ONLY the four typed buckets (facts.collateral/contract/oracle/liquidity) and never
 * branches on subject.ticker (verified in agent/src/dimensions/*.ts). `HistoricalFacts`
 * is structurally identical on those buckets; this view satisfies the scorer signature
 * WITHOUT widening the live `SubjectId` union and WITHOUT any engine change.
 */
export function asScorerInput(): SubjectFacts {
  return ELIXIR_DEUSD as unknown as SubjectFacts;
}

/** Grade the fixture with the unmodified engine. Pure + deterministic. */
export function gradeElixir() {
  const facts = asScorerInput();
  const collateral = scoreCollateral(facts);
  const contract = scoreContractRisk(facts);
  const oracle = scoreOracleIntegrity(facts);
  const liquidity = scoreLiquidityStability(facts);
  const det = synthesize({ collateral, contract, oracle, liquidity });
  return { collateral, contract, oracle, liquidity, det };
}

/** Build the captured artifact object (per-dimension band + rationale citing each flag). */
export function buildArtifact() {
  const { collateral, contract, oracle, liquidity, det } = gradeElixir();
  return {
    subject: {
      name: ELIXIR_DEUSD.subject.name,
      ticker: ELIXIR_DEUSD.subject.ticker,
      address: ELIXIR_DEUSD.subject.address,
      chainId: ELIXIR_DEUSD.subject.chainId,
    },
    kind: "historical-proof",
    note: "Captured by the UNMODIFIED Phase-2 engine (no special-casing). NOT a live rating.",
    provenance: {
      fixtureVersion: ELIXIR_VERSION,
      analysisDate: ELIXIR_ANALYSIS_DATE,
      collapseWindow: ELIXIR_COLLAPSE_WINDOW,
      ingestBlock: ELIXIR_DEUSD.ingestBlock,
    },
    grade: {
      letter: det.letter,
      uint8: det.uint8,
      overall: det.overall,
      confidence: det.confidence,
      totalMissingFacts: det.totalMissingFacts,
    },
    dimensions: {
      collateral_quality: {
        score: collateral.score,
        band: collateral.label,
        raw_value: collateral.raw_value,
        missing_facts: collateral.missing_facts,
        red_flag:
          "65% xUSD concentration + circular collateralization (xUSD ↔ deUSD)",
      },
      contract_risk: {
        score: contract.score,
        band: contract.label,
        raw_value: contract.raw_value,
        missing_facts: contract.missing_facts,
        red_flag:
          "private unlisted Morpho markets, 4.1x recursive leverage",
      },
      oracle_integrity: {
        score: oracle.score,
        band: oracle.label,
        raw_value: oracle.raw_value,
        missing_facts: oracle.missing_facts,
        red_flag:
          "xUSD oracle hardcoded $1.00 across Morpho/Euler/Elixir lending markets",
      },
      liquidity_stability: {
        score: liquidity.score,
        band: liquidity.label,
        raw_value: liquidity.raw_value,
        missing_facts: liquidity.missing_facts,
        red_flag:
          "$520M claimed vs $160M actual TVL; 12% yield premium over Aave baseline",
      },
    },
  };
}

function main() {
  const artifact = buildArtifact();
  const dir = resolve(process.cwd(), "out", "historical");
  mkdirSync(dir, { recursive: true });
  const outPath = resolve(dir, "elixir-deusd.json");
  writeFileSync(outPath, JSON.stringify(artifact, null, 2) + "\n", {
    encoding: "utf8",
  });
  // eslint-disable-next-line no-console
  console.log(
    `captured Elixir historical grade ${artifact.grade.letter} (uint8=${artifact.grade.uint8}, overall=${artifact.grade.overall}) → ${outPath}`,
  );
}

// Run when invoked directly (pnpm capture-elixir), not when imported by the test.
const invokedDirectly =
  process.argv[1] !== undefined &&
  process.argv[1].replace(/\\/g, "/").endsWith("fixtures/capture-elixir.ts");
if (invokedDirectly) {
  main();
}
