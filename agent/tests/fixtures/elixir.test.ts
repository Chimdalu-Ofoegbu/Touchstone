// agent/tests/fixtures/elixir.test.ts
// Task 03-05-02 — the historical-downgrade proof (REQ-06 start, D-04).
//
// THE PROOF (03-RESEARCH Pitfall 5): the SAME unmodified Phase-2 engine that rates
// live Mantle subjects grades the Elixir deUSD pre-failure fixture low/deteriorating.
// This test imports the four dimension scorers + synthesize UNCHANGED and calls them
// on ELIXIR_DEUSD. There is NO `if (ticker === "deUSD")` branch — the engine never
// sees the ticker (it reads only the typed buckets). If the engine did NOT grade
// these facts low, that is a FINDING about the scorers (recorded in 03-05-SUMMARY),
// never a fixture patch or an engine special-case.
//
// Recorded result (unmodified engine, deterministic): grade B (uint8=5, overall=44),
// confidence 70. collateral 35 · contract 30 · oracle 30 · liquidity 82. Three of the
// four dimensions land in the WORST band; the lone outlier (liquidity 82) is the
// documented engine finding — the deterministic TVL-band scorer rates raw size only
// and does not penalize the $520M-claimed-vs-$160M-actual gap or the yield anomaly.

import { describe, it, expect } from "vitest";

import { scoreCollateral } from "../../src/dimensions/collateral-quality.js";
import { scoreContractRisk } from "../../src/dimensions/contract-risk.js";
import { scoreOracleIntegrity } from "../../src/dimensions/oracle-integrity.js";
import { scoreLiquidityStability } from "../../src/dimensions/liquidity-stability.js";
import { synthesize } from "../../src/dimensions/synthesize.js";
import { GRADE_LETTER_TO_UINT8 } from "../../src/constants/grade-enum.js";
import type { SubjectFacts } from "../../src/subjects/types.js";
import { ELIXIR_DEUSD } from "../../src/fixtures/elixir-deusd.js";
import { buildArtifact } from "../../src/fixtures/capture-elixir.js";

// The scorers' param is `SubjectFacts`, but they read ONLY the four typed buckets
// (never subject.ticker). `HistoricalFacts` is structurally identical on those
// buckets, so this view satisfies the signature WITHOUT widening the live `SubjectId`
// union and WITHOUT any engine change — that structural compatibility IS the proof.
const facts = ELIXIR_DEUSD as unknown as SubjectFacts;

describe("[03-05] Elixir deUSD — UNMODIFIED engine grades the historical fixture", () => {
  const collateral = scoreCollateral(facts);
  const contract = scoreContractRisk(facts);
  const oracle = scoreOracleIntegrity(facts);
  const liquidity = scoreLiquidityStability(facts);
  const det = synthesize({ collateral, contract, oracle, liquidity });

  it("scorers are imported unchanged — no special-casing on subject.ticker", () => {
    // The fixture's ticker is 'deUSD' (not a live SubjectId). The engine produced a
    // result anyway, which only works because it reads buckets, not the ticker.
    expect(facts.subject.ticker).toBe("deUSD");
  });

  it("synthesized grade is low/deteriorating (speculative-or-worse, uint8 >= BB)", () => {
    // BB = 4 in the on-chain enum; HIGHER uint8 = WORSE grade. 'low/deteriorating'
    // = speculative-or-worse. The unmodified engine returns B (uint8=5).
    expect(det.uint8).toBeGreaterThanOrEqual(GRADE_LETTER_TO_UINT8.BB);
    // Record the exact band the engine produced (B, uint8 5, overall 44).
    expect(det.letter).toBe("B");
    expect(det.uint8).toBe(GRADE_LETTER_TO_UINT8.B);
    expect(det.overall).toBe(44);
  });

  it("oracle dimension scores worst because the $1.00 hardcoded feed is present", () => {
    // 'single trusted feed / no redundancy' triggers the -25 penalty → worst band.
    expect(oracle.score).toBe(30);
    expect(oracle.label).toMatch(/single trusted feed/i);
    const oracleArch = facts.oracle.find(
      (f) => f.label === "oracle architecture",
    );
    expect(oracleArch?.value).toMatch(/hardcoded.*\$1\.00|\$1\.00.*hardcoded/i);
  });

  it("collateral dimension scores worst because of the 65% concentration + circular backing", () => {
    expect(collateral.score).toBe(35); // 'thin collateral disclosure' band
    const issuer = facts.collateral.find(
      (f) => f.label === "issuer + collateral",
    );
    expect(issuer?.value).toMatch(/65%/);
    expect(issuer?.value).toMatch(/circular/i);
  });

  it("contract dimension scores worst because of private markets + 4.1x recursive leverage", () => {
    expect(contract.score).toBe(30); // worst contract-risk band
    const proxy = facts.contract.find((f) => f.label === "proxy pattern");
    expect(proxy?.value).toMatch(/4\.1x/);
    expect(proxy?.value).toMatch(/recursive leverage/i);
    const verified = facts.contract.find((f) => f.label === "source verified");
    expect(verified?.value).toBe("no"); // private, unlisted markets
  });

  it("liquidity dimension carries the $520M-claimed-vs-$160M-actual red flag in evidence (engine finding: TVL-band scorer does not penalize the gap)", () => {
    const parent = facts.liquidity.find((f) => f.label === "parent TVL (USD)");
    // Honest actual deposits encoded (not the inflated $520M claim).
    expect(parent?.value).toBe("160000000");
    // The claimed-vs-actual gap + yield anomaly is documented in the evidence.
    expect(parent?.evidence).toMatch(/\$520M/);
    expect(parent?.evidence).toMatch(/12% yield/);
    // FINDING: the deterministic TVL-band scorer rates raw size only → 'deep liquidity'.
    expect(liquidity.score).toBe(82);
    expect(liquidity.label).toMatch(/deep liquidity/i);
  });

  it("each red flag is cited by its provenance source (CBB0FE 2025-10-28)", () => {
    const allFacts = [
      ...facts.collateral,
      ...facts.contract,
      ...facts.oracle,
      ...facts.liquidity,
    ];
    for (const f of allFacts) {
      expect(f.evidence).toMatch(/CBB0FE/);
      expect(f.evidence).toMatch(/2025-10-28/);
    }
  });
});

describe("[03-05] captured artifact mirrors the unmodified-engine output", () => {
  it("buildArtifact() reflects the same grade + per-dimension red flags", () => {
    const artifact = buildArtifact();
    expect(artifact.grade.letter).toBe("B");
    expect(artifact.grade.uint8).toBe(5);
    expect(artifact.grade.overall).toBe(44);
    expect(artifact.kind).toBe("historical-proof");
    // Each dimension entry names its red flag for Phase 4 rendering.
    expect(artifact.dimensions.oracle_integrity.red_flag).toMatch(/\$1\.00/);
    expect(artifact.dimensions.collateral_quality.red_flag).toMatch(/65%/);
    expect(artifact.dimensions.contract_risk.red_flag).toMatch(/4\.1x/);
    expect(artifact.dimensions.liquidity_stability.red_flag).toMatch(
      /\$520M.*\$160M/,
    );
  });
});
