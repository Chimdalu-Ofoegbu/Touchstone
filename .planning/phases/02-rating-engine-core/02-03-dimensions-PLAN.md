---
phase: 02
plan: 03
plan_id: 02-03-dimensions
type: execute
wave: 2
depends_on: [02-01-scaffold, 02-02-subjects]
files_modified:
  - agent/src/dimensions/collateral-quality.ts
  - agent/src/dimensions/contract-risk.ts
  - agent/src/dimensions/oracle-integrity.ts
  - agent/src/dimensions/liquidity-stability.ts
  - agent/src/dimensions/synthesize.ts
  - agent/tests/dimensions/collateral-quality.test.ts
  - agent/tests/dimensions/contract-risk.test.ts
  - agent/tests/dimensions/oracle-integrity.test.ts
  - agent/tests/dimensions/liquidity-stability.test.ts
  - agent/tests/dimensions/synthesize.test.ts
autonomous: true
requirements:
  - REQ-01
objective: |
  Four deterministic threshold-banded scorers (D-06) over SubjectFacts:
  collateral_quality, contract_risk, oracle_integrity, liquidity_stability.
  Each declares a top-of-file BANDS constant (D-06: bands as data). When a
  required fact is missing (Fact.value == null), dimension defaults to 50 and
  reports the missing fact label (D-07). A synthesize() helper applies uniform
  25% weighting (D-08), maps the overall 0..100 score to a letter grade, and
  enforces the confidence floor (max(30, 100 - 5*totalMissing)).

must_haves:
  truths:
    - "Each dimension scorer returns BandResult { max, score, label, missing_facts[], raw_value }"
    - "When all relevant facts are missing, every dimension returns score == 50 with raw_value == null"
    - "synthesize({4 BandResults, totalMissing}) returns { overall: 0..100, letter, uint8, confidence: 30..100 }"
    - "Confidence floor is 30; ceiling is 100; both inclusive"
    - "Grade letter is the boundary value mapping at fixed score cuts (locked here, mirrored to schema)"
    - "On-chain bounds NEVER violated: synthesize never emits grade.uint8 > 9 or confidence > 100 (T-2-02 defense-in-depth)"
  artifacts:
    - path: "agent/src/dimensions/collateral-quality.ts"
      provides: "COLLATERAL_BANDS + scoreCollateral(facts): BandResult"
      contains: "export const COLLATERAL_BANDS"
    - path: "agent/src/dimensions/contract-risk.ts"
      provides: "CONTRACT_RISK_BANDS + scoreContractRisk(facts)"
      contains: "export const CONTRACT_RISK_BANDS"
    - path: "agent/src/dimensions/oracle-integrity.ts"
      provides: "ORACLE_BANDS + scoreOracleIntegrity(facts)"
      contains: "export const ORACLE_BANDS"
    - path: "agent/src/dimensions/liquidity-stability.ts"
      provides: "LIQUIDITY_BANDS + scoreLiquidityStability(facts)"
      contains: "export const LIQUIDITY_BANDS"
    - path: "agent/src/dimensions/synthesize.ts"
      provides: "synthesize() — uniform 25%, overall → letter mapping, confidence floor"
      exports: ["synthesize", "scoreToGrade", "GRADE_SCORE_TABLE"]
  key_links:
    - from: "agent/src/dimensions/*.ts"
      to: "agent/src/subjects/types.ts"
      via: "SubjectFacts buckets (collateral/contract/oracle/liquidity)"
      pattern: "import type \\{ SubjectFacts.*\\} from"
    - from: "agent/src/dimensions/synthesize.ts"
      to: "agent/src/constants/grade-enum.ts"
      via: "GRADE_LETTER_TO_UINT8 mapping"
      pattern: "GRADE_LETTER_TO_UINT8"
---

<objective>
Four deterministic scorers + a combiner. Each dimension is a pure function of SubjectFacts → BandResult. Bands are top-of-file data (D-06). Missing fact handling defaults the dimension to 50 and surfaces the missing fact label so Claude can hedge honestly (D-07). The synthesize() helper applies uniform 25% weighting (D-08) and produces the final grade letter + confidence with the locked floors and ceilings.

Purpose: this is the deterministic, judge-inspectable boundary REQ-01 + CON-deterministic-vs-llm-separation demands. Every score traces back to a labeled band; no continuous formulas; no LLM in this layer.

Output: 4 scorer files (each with BANDS + scoring fn) + 1 synthesize file + 5 test files exercising boundary values, missing-fact paths, and on-chain bounds.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/02-rating-engine-core/02-CONTEXT.md (D-06 bands, D-07 missing-fact, D-08 uniform weighting)
@.planning/phases/02-rating-engine-core/02-RESEARCH.md (§7.1-§7.4 initial bands, §10 threat-model T-2-04 missing-fact, T-2-02 bounds)
@.planning/phases/02-rating-engine-core/02-PATTERNS.md (§2 bounds analog, §"Testing Divergence" carry-forward)
@.planning/phases/02-rating-engine-core/02-01-SUMMARY.md
@.planning/phases/02-rating-engine-core/02-02-SUMMARY.md
@agent/src/subjects/types.ts
@agent/src/dimensions/types.ts
@agent/src/constants/grade-enum.ts

<interfaces>
<!-- Already produced -->

From agent/src/dimensions/types.ts:
```ts
export type Band = { max: number | null; score: number; label: string };
export type BandResult = Band & { missing_facts: string[]; raw_value: number | null };
```

From agent/src/subjects/types.ts:
```ts
export type Fact = { label: string; value: string | null; evidence: string; source: ... };
export type SubjectFacts = {
  subject: { name: string; ticker: SubjectId; address: `0x${string}`; chainId: 5000 };
  ingestBlock: number;
  collateral: Fact[]; contract: Fact[]; oracle: Fact[]; liquidity: Fact[];
};
```

From agent/src/constants/grade-enum.ts:
```ts
export const GRADE_LETTER_TO_UINT8 = { AAA: 0, ..., D: 9 } as const;
export type GradeLetter = keyof typeof GRADE_LETTER_TO_UINT8;
export const GRADE_MAX = 9;
```

<!-- This wave PRODUCES -->

agent/src/dimensions/*.ts each export:
```ts
export const COLLATERAL_BANDS: Band[]; // (and analogous for others)
export function scoreCollateral(facts: SubjectFacts): BandResult; // (and analogous)
```

agent/src/dimensions/synthesize.ts:
```ts
export type SynthesizeInput = {
  collateral: BandResult; contract: BandResult; oracle: BandResult; liquidity: BandResult;
};
export type SynthesizeOutput = {
  overall: number;             // 0..100
  letter: GradeLetter;
  uint8: number;               // 0..9 — mirrors GradeEnum.MAX bound
  confidence: number;          // 30..100
  totalMissingFacts: number;
};
export function synthesize(input: SynthesizeInput): SynthesizeOutput;
export function scoreToGrade(overall: number): { letter: GradeLetter; uint8: number };
export const GRADE_SCORE_TABLE: ReadonlyArray<{ min: number; letter: GradeLetter }>;
```
</interfaces>

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 2-03-01: Collateral quality + contract risk scorers (BANDS + scoring fn + boundary tests)</name>
  <files>agent/src/dimensions/collateral-quality.ts, agent/src/dimensions/contract-risk.ts, agent/tests/dimensions/collateral-quality.test.ts, agent/tests/dimensions/contract-risk.test.ts</files>
  <read_first>
    - .planning/phases/02-rating-engine-core/02-RESEARCH.md (§7.1 COLLATERAL_BANDS proposal, §7.2 CONTRACT_RISK_BANDS, §10 T-2-04 missing-fact handling)
    - .planning/phases/02-rating-engine-core/02-CONTEXT.md (D-06 bands-as-data, D-07 missing-fact policy)
    - .planning/phases/02-rating-engine-core/02-PATTERNS.md (Testing divergence — boundary-value triplet discipline carried from Phase 1)
    - agent/src/subjects/types.ts (SubjectFacts → collateral/contract buckets)
    - agent/src/dimensions/types.ts (Band, BandResult)
  </read_first>
  <behavior>
    - collateral_quality test 1 (typical): facts contain non-null `issuer`, `audits`, `reserve attestation` → quality_index lands in band ≥ 50, score ≥ 55
    - collateral_quality test 2 (boundary triplet): for each band boundary `max` value, assert score returned for `idx = max - 1`, `idx = max`, and `idx = max + 1` (just-below, at-bound, just-above)
    - collateral_quality test 3 (missing): all collateral facts have `value == null` → BandResult.score === 50, raw_value === null, missing_facts includes all the labels
    - contract_risk test 1 (typical): source verified + recent audit + non-EOA owner → score ≥ 55
    - contract_risk test 2 (boundary triplet): same pattern
    - contract_risk test 3 (missing): score === 50, raw_value === null
    - on-chain bounds test: for both scorers, score returned is `int` in [0, 100]
  </behavior>
  <action>
    Create `agent/src/dimensions/collateral-quality.ts` (RESEARCH §7.1):
    ```ts
    import type { Band, BandResult } from "./types";
    import type { SubjectFacts } from "../subjects/types";

    /**
     * Bands sorted ascending by `max` (exclusive upper bound on quality_index).
     * Top band uses `max: null` as the catch-all. Lookup: first band whose
     * `max == null || index < max` wins.
     *
     * quality_index 0..100 is derived from the collateral facts (see scorer below).
     * Source rationale: RESEARCH §7.1.
     */
    export const COLLATERAL_BANDS: Band[] = [
      { max: 30,   score: 35, label: "thin collateral disclosure" },
      { max: 50,   score: 55, label: "moderate collateral, single custodian or sparse audit" },
      { max: 70,   score: 72, label: "strong collateral, recent audit, multi-attestation" },
      { max: 85,   score: 85, label: "institutional collateral with regular proof-of-reserves" },
      { max: null, score: 92, label: "tokenized treasury-grade collateral" },
    ];

    /**
     * Quality index recipe (documented per CON-llm-prompt-evidence-citation — every
     * point added/subtracted maps to a named fact label):
     *   +25 if collateral is "tokenized US treasuries" or similar treasury-grade
     *   +20 if audit list non-empty
     *   +20 if reserve attestation non-empty
     *   +15 if custodian named
     *   -15 if no reserve attestation (single point of failure)
     *   -10 if no audit list
     */
    function qualityIndex(facts: SubjectFacts): { index: number | null; missing: string[] } {
      const missing: string[] = [];
      const get = (label: string) => {
        const f = facts.collateral.find(x => x.label === label);
        if (!f || f.value === null) { missing.push(label); return null; }
        return f.value;
      };
      const issuer = get("issuer + collateral");
      const audits = get("audits");
      const reserve = get("reserve attestation");
      const custodian = get("custodian");

      // If ALL inputs are missing, return null → dimension defaults to 50.
      if (missing.length === 4) return { index: null, missing };

      let idx = 0;
      if (issuer && /treasur(y|ies)|treasury bills/i.test(issuer)) idx += 25;
      if (audits) idx += 20; else idx -= 10;
      if (reserve) idx += 20; else idx -= 15;
      if (custodian) idx += 15;
      // Clamp to [0, 100].
      idx = Math.max(0, Math.min(100, idx));
      return { index: idx, missing };
    }

    export function scoreCollateral(facts: SubjectFacts): BandResult {
      const { index, missing } = qualityIndex(facts);
      if (index === null) {
        // D-07: dimension defaults to 50 when all required facts are missing.
        return { max: null, score: 50, label: "missing data — default neutral", missing_facts: missing, raw_value: null };
      }
      const band = COLLATERAL_BANDS.find(b => b.max === null || index < b.max)!;
      return { ...band, missing_facts: missing, raw_value: index };
    }
    ```

    Create `agent/src/dimensions/contract-risk.ts` (RESEARCH §7.2) with the analogous structure:
    ```ts
    export const CONTRACT_RISK_BANDS: Band[] = [
      { max: 30,   score: 30, label: "unverified or pausable-by-EOA with no timelock" },
      { max: 50,   score: 55, label: "verified source, owner concentrated, partial mitigation" },
      { max: 70,   score: 72, label: "verified, audited, proxy admin documented" },
      { max: 85,   score: 85, label: "timelocked admin, distributed holders, multiple audits" },
      { max: null, score: 92, label: "battle-tested with multi-sig timelocked admin and no central pause" },
    ];
    ```
    Recipe (RESEARCH §7.2): `+25 if source_verified`, `+15 if audits non-empty`, `+10 if proxy pattern documented`, `+15 if timelock present`, `-15 if pausable and no timelock`, `-10 if owner is null/EOA-shaped` (heuristic). All input facts come from the `contract` bucket of SubjectFacts.

    Create `agent/tests/dimensions/collateral-quality.test.ts` (test pattern below; same for contract-risk):
    ```ts
    import { describe, it, expect } from "vitest";
    import { scoreCollateral, COLLATERAL_BANDS } from "../../src/dimensions/collateral-quality";
    import type { SubjectFacts, Fact } from "../../src/subjects/types";

    function fact(label: string, value: string | null): Fact {
      return { label, value, evidence: ".", source: { kind: "static", file: "test", version: "1.0.0" } };
    }
    function facts(collateral: Fact[]): SubjectFacts {
      return {
        subject: { name: "Test", ticker: "USDY", address: "0x0000000000000000000000000000000000000001", chainId: 5000 },
        ingestBlock: 0,
        collateral, contract: [], oracle: [], liquidity: [],
      };
    }

    describe("[2-03-01a] scoreCollateral — typical inputs", () => {
      it("treasury + audit + reserve + custodian → band 5 (treasury-grade)", () => {
        const f = facts([
          fact("issuer + collateral", "short-term US Treasuries + bank deposits"),
          fact("audits", "Code4rena 2023, Halborn 2024"),
          fact("reserve attestation", "monthly"),
          fact("custodian", "Ankura Trust"),
        ]);
        const r = scoreCollateral(f);
        expect(r.score).toBeGreaterThanOrEqual(85);
        expect(r.missing_facts).toEqual([]);
      });

      it("score is always an integer in [0,100] for typical inputs", () => {
        const f = facts([
          fact("issuer + collateral", "short-term US Treasuries"),
          fact("audits", "audit"),
          fact("reserve attestation", "monthly"),
          fact("custodian", "X"),
        ]);
        const r = scoreCollateral(f);
        expect(Number.isInteger(r.score)).toBe(true);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
      });
    });

    describe("[2-03-01b] scoreCollateral — missing-fact (D-07)", () => {
      it("all collateral facts null → score 50, raw_value null, missing_facts has 4 labels", () => {
        const f = facts([
          fact("issuer + collateral", null),
          fact("audits", null),
          fact("reserve attestation", null),
          fact("custodian", null),
        ]);
        const r = scoreCollateral(f);
        expect(r.score).toBe(50);
        expect(r.raw_value).toBeNull();
        expect(r.missing_facts.length).toBe(4);
      });
    });

    describe("[2-03-01c] scoreCollateral — boundary-value triplets", () => {
      // For each band's `max`, force the index to {max-1, max, max+1} via a synthetic
      // call path that bypasses the recipe (cast as any so we can drive raw band lookup).
      // The library version of the band-lookup is the for-loop inside scoreCollateral;
      // here we verify the BANDS table itself does the right thing under the lookup rule.
      it("BANDS lookup: first band where index < max wins (top band catches null)", () => {
        const find = (idx: number) =>
          COLLATERAL_BANDS.find(b => b.max === null || idx < b.max)!;
        expect(find(29).score).toBe(35);   // band 0: max 30
        expect(find(30).score).toBe(55);   // boundary: 30 is NOT < 30 → falls into band 1
        expect(find(49).score).toBe(55);
        expect(find(50).score).toBe(72);
        expect(find(69).score).toBe(72);
        expect(find(70).score).toBe(85);
        expect(find(84).score).toBe(85);
        expect(find(85).score).toBe(92);
        expect(find(100).score).toBe(92);
      });
    });
    ```

    Create the matching `agent/tests/dimensions/contract-risk.test.ts` with the same three-section structure (typical, missing-fact, boundary triplet over CONTRACT_RISK_BANDS).
  </action>
  <verify>
    <automated>cd agent && pnpm test -- tests/dimensions/collateral-quality.test.ts tests/dimensions/contract-risk.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `test -f agent/src/dimensions/collateral-quality.ts` returns 0
    - `test -f agent/src/dimensions/contract-risk.ts` returns 0
    - `grep -c 'export const COLLATERAL_BANDS' agent/src/dimensions/collateral-quality.ts` returns 1
    - `grep -c 'export const CONTRACT_RISK_BANDS' agent/src/dimensions/contract-risk.ts` returns 1
    - `grep -c 'export function scoreCollateral' agent/src/dimensions/collateral-quality.ts` returns 1
    - `grep -c 'export function scoreContractRisk' agent/src/dimensions/contract-risk.ts` returns 1
    - `cd agent && pnpm test -- tests/dimensions/collateral-quality.test.ts` exits 0
    - `cd agent && pnpm test -- tests/dimensions/contract-risk.test.ts` exits 0
    - Both test files contain `[2-03-01` traceability markers
  </acceptance_criteria>
  <done>Two scorers with documented band recipes; missing-fact path defaults to 50 with `raw_value: null`; boundary-value triplets enforced; integer score in [0,100].</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2-03-02: Oracle integrity + liquidity stability scorers + synthesize() combiner</name>
  <files>agent/src/dimensions/oracle-integrity.ts, agent/src/dimensions/liquidity-stability.ts, agent/src/dimensions/synthesize.ts, agent/tests/dimensions/oracle-integrity.test.ts, agent/tests/dimensions/liquidity-stability.test.ts, agent/tests/dimensions/synthesize.test.ts</files>
  <read_first>
    - .planning/phases/02-rating-engine-core/02-RESEARCH.md (§7.3 ORACLE_BANDS, §7.4 LIQUIDITY_BANDS — Open Q2 recommendation: use parent_tvl_USD; §4.2 prompt block referencing grade encoding)
    - .planning/phases/02-rating-engine-core/02-CONTEXT.md (D-06 bands, D-07 missing facts, D-08 uniform 25%, D-12 schema constraints)
    - .planning/phases/02-rating-engine-core/02-PATTERNS.md (§2 bounds-analog — synthesize MUST never emit grade>9 or confidence>100)
    - agent/src/constants/grade-enum.ts (GRADE_LETTER_TO_UINT8 mapping)
  </read_first>
  <behavior>
    - oracle test 1 (typical): facts have oracle architecture + staleness tolerance → score in upper band
    - oracle test 2 (missing): all facts null → score 50
    - liquidity test 1 (USDY): parent_tvl_USD = 680_000_000 → lands in "deep" band (score ≥ 82)
    - liquidity test 2 (USDY): mantle_tvl_USD ONLY = 8_000_000 with no parent → lands in "limited" band — confirms RESEARCH Open Q2 choice to prefer parent_tvl when available
    - liquidity test 3 (missing): all facts null → score 50
    - synthesize test 1: 4 typical scores (each ~80) + 0 missing → overall ≈ 80 → letter A or BBB, confidence === 100
    - synthesize test 2: 4 scores at default 50 + 10 missing facts → overall === 50, confidence === max(30, 100 - 5*10) === 50 (NOT 30)
    - synthesize test 3: 4 scores at 50 + 30 missing facts → confidence === 30 (floor)
    - synthesize test 4 (on-chain bounds T-2-02): for the degenerate "all dims = 100, 0 missing" case AND the "all dims = 0, 100 missing" case, output has `confidence ∈ [30, 100]` and `uint8 ∈ [0, 9]`
    - synthesize test 5 (uniform weighting D-08): synthesize({a, b, c, d}) returns overall === Math.round((a+b+c+d)/4)
    - synthesize test 6 (grade mapping): overall=95 → AAA, overall=85 → AA, overall=75 → A, overall=65 → BBB, overall=55 → BB, overall=45 → B, overall=35 → CCC, overall=25 → CC, overall=15 → C, overall=5 → D
  </behavior>
  <action>
    Create `agent/src/dimensions/oracle-integrity.ts` (RESEARCH §7.3):
    ```ts
    export const ORACLE_BANDS: Band[] = [
      { max: 30,   score: 30, label: "single trusted feed or no on-chain settlement" },
      { max: 50,   score: 55, label: "single oracle with documented staleness guard" },
      { max: 70,   score: 72, label: "redundant feeds with aggregation" },
      { max: 85,   score: 85, label: "multi-source aggregator with fresh data and manipulation resistance" },
      { max: null, score: 92, label: "battle-tested oracle stack with hardened deviation thresholds" },
    ];
    ```
    Recipe: `+20 if oracle architecture string non-empty`, `+20 if staleness tolerance <= 24h or "monthly" for attestation-backed`, `+15 if redundant feeds`, `+15 if manipulation-resistant aggregator`, `-25 if single-point-of-failure indicator`. Source from `facts.oracle` bucket.

    Create `agent/src/dimensions/liquidity-stability.ts` (RESEARCH §7.4 + Open Q2 recommendation — use parent_tvl_USD as band input when present):
    ```ts
    export const LIQUIDITY_BANDS: Band[] = [
      { max: 1_000_000,    score: 25, label: "very thin liquidity" },
      { max: 10_000_000,   score: 50, label: "limited liquidity" },
      { max: 100_000_000,  score: 70, label: "healthy liquidity" },
      { max: 500_000_000,  score: 82, label: "deep liquidity" },
      { max: null,         score: 92, label: "anchor-level liquidity" },
    ];
    ```
    Recipe (file-header comment must document): if `parent TVL (USD)` fact is non-null, use it as the band input; else fall back to `mantle TVL (USD)`; else fall back to on-chain `totalSupply` × price (priced from prices.ts via the citation chain — but we don't compute here; we expect the adapter to have already given a USD-denominated fact). If both `parent TVL (USD)` and `mantle TVL (USD)` are null → dimension defaults to 50. Use `Number(value)` to convert.

    Create `agent/src/dimensions/synthesize.ts`:
    ```ts
    import type { BandResult } from "./types";
    import { GRADE_LETTER_TO_UINT8, GRADE_MAX, type GradeLetter } from "../constants/grade-enum";

    /**
     * Letter grade boundaries — locked. overall ∈ [0,100] → letter mapping.
     * AAA  >= 90    (best)
     * AA   >= 80
     * A    >= 70
     * BBB  >= 60
     * BB   >= 50
     * B    >= 40
     * CCC  >= 30
     * CC   >= 20
     * C    >= 10
     * D    >= 0
     */
    export const GRADE_SCORE_TABLE: ReadonlyArray<{ min: number; letter: GradeLetter }> = [
      { min: 90, letter: "AAA" },
      { min: 80, letter: "AA" },
      { min: 70, letter: "A" },
      { min: 60, letter: "BBB" },
      { min: 50, letter: "BB" },
      { min: 40, letter: "B" },
      { min: 30, letter: "CCC" },
      { min: 20, letter: "CC" },
      { min: 10, letter: "C" },
      { min: 0,  letter: "D" },
    ];

    export function scoreToGrade(overall: number): { letter: GradeLetter; uint8: number } {
      const clamped = Math.max(0, Math.min(100, overall));
      const entry = GRADE_SCORE_TABLE.find(e => clamped >= e.min)!;
      return { letter: entry.letter, uint8: GRADE_LETTER_TO_UINT8[entry.letter] };
    }

    export type SynthesizeInput = {
      collateral: BandResult;
      contract: BandResult;
      oracle: BandResult;
      liquidity: BandResult;
    };

    export type SynthesizeOutput = {
      overall: number;
      letter: GradeLetter;
      uint8: number;
      confidence: number;
      totalMissingFacts: number;
    };

    /**
     * Uniform 25% weighting (D-08). Confidence floor 30 (D-07). Ceiling 100.
     * On-chain bounds: never emits uint8 > GRADE_MAX (9). Defense-in-depth for
     * T-2-02 — RatingRegistry would revert; we don't let it get that far.
     */
    export function synthesize(input: SynthesizeInput): SynthesizeOutput {
      const { collateral, contract, oracle, liquidity } = input;
      const overall = Math.round((collateral.score + contract.score + oracle.score + liquidity.score) / 4);
      const grade = scoreToGrade(overall);
      const totalMissingFacts =
        collateral.missing_facts.length +
        contract.missing_facts.length +
        oracle.missing_facts.length +
        liquidity.missing_facts.length;
      const confidenceRaw = 100 - 5 * totalMissingFacts;
      const confidence = Math.max(30, Math.min(100, confidenceRaw));

      // Sanity invariant — these MUST hold, else we'd cause RatingRegistry to revert.
      if (grade.uint8 < 0 || grade.uint8 > GRADE_MAX) {
        throw new Error("synthesize produced out-of-bounds grade.uint8: " + String(grade.uint8));
      }
      if (confidence < 30 || confidence > 100) {
        throw new Error("synthesize produced out-of-bounds confidence: " + String(confidence));
      }
      return { overall, letter: grade.letter, uint8: grade.uint8, confidence, totalMissingFacts };
    }
    ```

    Create test files (oracle-integrity.test.ts, liquidity-stability.test.ts — both follow the same 3-section structure as collateral-quality.test.ts).

    Create `agent/tests/dimensions/synthesize.test.ts`:
    ```ts
    import { describe, it, expect } from "vitest";
    import { synthesize, scoreToGrade, GRADE_SCORE_TABLE } from "../../src/dimensions/synthesize";
    import type { BandResult } from "../../src/dimensions/types";

    function band(score: number, missing: string[] = []): BandResult {
      return { max: null, score, label: "test", missing_facts: missing, raw_value: score };
    }

    describe("[2-03-02] synthesize() — uniform 25% (D-08)", () => {
      it("overall == round((a+b+c+d)/4)", () => {
        const out = synthesize({ collateral: band(80), contract: band(80), oracle: band(80), liquidity: band(80) });
        expect(out.overall).toBe(80);
      });
      it("uneven mix averages correctly with rounding", () => {
        const out = synthesize({ collateral: band(85), contract: band(72), oracle: band(55), liquidity: band(50) });
        expect(out.overall).toBe(Math.round((85+72+55+50)/4)); // 65 or 66
      });
    });

    describe("[2-03-02] synthesize() — confidence (D-07 floor 30)", () => {
      it("0 missing → confidence 100", () => {
        const out = synthesize({ collateral: band(70), contract: band(70), oracle: band(70), liquidity: band(70) });
        expect(out.confidence).toBe(100);
      });
      it("10 missing → confidence 50", () => {
        const out = synthesize({
          collateral: band(50, ["a","b","c"]),
          contract:   band(50, ["d","e","f"]),
          oracle:     band(50, ["g","h"]),
          liquidity:  band(50, ["i","j"]),
        });
        expect(out.totalMissingFacts).toBe(10);
        expect(out.confidence).toBe(50);
      });
      it("30 missing → confidence floor 30 (NOT lower)", () => {
        const labels = Array.from({length: 30}, (_, i) => "fact" + i);
        const out = synthesize({
          collateral: band(50, labels.slice(0, 8)),
          contract:   band(50, labels.slice(8, 16)),
          oracle:     band(50, labels.slice(16, 23)),
          liquidity:  band(50, labels.slice(23, 30)),
        });
        expect(out.totalMissingFacts).toBe(30);
        expect(out.confidence).toBe(30);
      });
    });

    describe("[2-03-02] synthesize() — on-chain bounds (T-2-02)", () => {
      it("all scores 100, 0 missing → uint8 in [0,9] and confidence 100", () => {
        const out = synthesize({ collateral: band(100), contract: band(100), oracle: band(100), liquidity: band(100) });
        expect(out.uint8).toBeGreaterThanOrEqual(0);
        expect(out.uint8).toBeLessThanOrEqual(9);
        expect(out.confidence).toBe(100);
        expect(out.letter).toBe("AAA");
      });
      it("all scores 0, 100 missing facts → uint8 in [0,9] and confidence 30", () => {
        const labels = Array.from({length: 100}, (_, i) => "f" + i);
        const out = synthesize({
          collateral: band(0, labels.slice(0, 25)),
          contract:   band(0, labels.slice(25, 50)),
          oracle:     band(0, labels.slice(50, 75)),
          liquidity:  band(0, labels.slice(75, 100)),
        });
        expect(out.uint8).toBeGreaterThanOrEqual(0);
        expect(out.uint8).toBeLessThanOrEqual(9);
        expect(out.confidence).toBe(30);
        expect(out.letter).toBe("D");
      });
    });

    describe("[2-03-02] scoreToGrade — letter boundaries", () => {
      it.each([
        [95, "AAA", 0], [90, "AAA", 0],
        [89, "AA", 1],  [80, "AA", 1],
        [79, "A", 2],   [70, "A", 2],
        [69, "BBB", 3], [60, "BBB", 3],
        [59, "BB", 4],  [50, "BB", 4],
        [49, "B", 5],   [40, "B", 5],
        [39, "CCC", 6], [30, "CCC", 6],
        [29, "CC", 7],  [20, "CC", 7],
        [19, "C", 8],   [10, "C", 8],
        [9,  "D", 9],   [0,  "D", 9],
      ])("scoreToGrade(%i) === { letter: %s, uint8: %i }", (overall, letter, u8) => {
        const r = scoreToGrade(overall);
        expect(r.letter).toBe(letter);
        expect(r.uint8).toBe(u8);
      });
    });
    ```
  </action>
  <verify>
    <automated>cd agent && pnpm test -- tests/dimensions/</automated>
  </verify>
  <acceptance_criteria>
    - `test -f agent/src/dimensions/oracle-integrity.ts` returns 0
    - `test -f agent/src/dimensions/liquidity-stability.ts` returns 0
    - `test -f agent/src/dimensions/synthesize.ts` returns 0
    - `grep -c 'export const ORACLE_BANDS' agent/src/dimensions/oracle-integrity.ts` returns 1
    - `grep -c 'export const LIQUIDITY_BANDS' agent/src/dimensions/liquidity-stability.ts` returns 1
    - `grep -c 'export const GRADE_SCORE_TABLE' agent/src/dimensions/synthesize.ts` returns 1
    - `grep -c 'export function synthesize' agent/src/dimensions/synthesize.ts` returns 1
    - `grep -cE 'Math\.max\(30' agent/src/dimensions/synthesize.ts` returns ≥ 1 (confidence floor)
    - `grep -c 'GRADE_MAX' agent/src/dimensions/synthesize.ts` returns ≥ 1 (bound check)
    - `cd agent && pnpm test -- tests/dimensions/` exits 0 (runs all 5 dimension test files)
    - `cd agent && pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>4 dimension scorers + 1 synthesize combiner; uniform 25% weighting and confidence floor enforced; on-chain bounds invariants tested at the degenerate edges; letter grade boundaries fixed at every 10 points.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries (Wave 2 scope)

| Boundary | Description |
|----------|-------------|
| SubjectFacts → dimension scorer | Untrusted: a Fact.value of null must default the dimension, not silently produce 0 |
| dimension BandResults → synthesize → schema | Synthesize is the last line of defense before the schema. If it ever emits grade.uint8 > 9 or confidence > 100, Phase 3 will revert on-chain. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-2-02 | Tampering (Integrity, Phase 3 break) | `synthesize.ts` invariants | mitigate | synthesize throws if `uint8 > GRADE_MAX (9)` or `confidence ∉ [30,100]`. Two boundary tests (all-100 / all-0) prove no path emits out-of-bound values. |
| T-2-04 | Tampering (missing-fact silent fall-through) | each dimension's `quality_index` recipe | mitigate | Every dimension's scoring fn checks `if (index === null) return { score: 50, raw_value: null, missing_facts }`. Tests assert this explicitly per dimension. Combined with adapter `Fact.value === null` surfacing in Wave 1, the policy is end-to-end. |
</threat_model>

<verification>
- `cd agent && pnpm test -- tests/dimensions/` exits 0 (5 test files)
- `cd agent && pnpm typecheck` exits 0
- Every dimension has 3+ tests (typical / missing / boundary)
- synthesize has on-chain-bounds tests proving the degenerate cases respect the RatingRegistry contract bounds
</verification>

<success_criteria>
- 4 scorers exported with documented BANDS arrays + scoring functions
- Missing-fact handling consistent: dimension defaults to 50, missing_facts populated, raw_value null
- synthesize applies uniform 25% weighting, confidence floor 30, and maps overall → letter via the locked GRADE_SCORE_TABLE
- On-chain bounds (T-2-02) tested at the degenerate edges
- Per-task atomic commits
</success_criteria>

<output>
After completion, create `.planning/phases/02-rating-engine-core/02-03-SUMMARY.md` documenting:
- 4 BANDS tables (with their final brackets) + the GRADE_SCORE_TABLE
- Any deviation from RESEARCH §7 proposals (e.g., recipe details, custom thresholds)
- Test results
- Confirmation that synthesize cannot produce out-of-bound output for any input
</output>
