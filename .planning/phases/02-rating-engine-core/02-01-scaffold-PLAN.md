---
phase: 02
plan: 01
plan_id: 02-01-scaffold
type: execute
wave: 0
depends_on: []
files_modified:
  - agent/package.json
  - agent/tsconfig.json
  - agent/vitest.config.ts
  - agent/.env.example
  - agent/src/index.ts
  - agent/src/constants/grade-enum.ts
  - agent/src/subjects/types.ts
  - agent/src/dimensions/types.ts
  - agent/src/schema.ts
  - agent/tests/constants/grade-enum.test.ts
  - agent/tests/schema.test.ts
  - agent/tests/_setup.ts
  - agent/.gitignore
autonomous: true
requirements:
  - REQ-01
objective: |
  Lay down the agent/ TypeScript workspace, the locked GradeEnum TS mirror,
  the locked ReasoningDocument zod schema with on-chain bounds enforcement,
  and the shared SubjectFacts/Band type contracts that all downstream waves
  consume. Establishes deterministic-vs-LLM separation (CON-deterministic-vs-llm-separation)
  at the file-layout level (agent/src/dimensions/* separate from agent/src/claude/*).

must_haves:
  truths:
    - "pnpm --filter agent build exits 0 (tsc --strict --noEmit passes)"
    - "pnpm --filter agent test exits 0 (vitest runs grade-enum + schema parity tests)"
    - "GradeEnum TS mirror equals Solidity GradeEnum byte-for-byte (AAA=0..D=9, MAX=9)"
    - "ReasoningDocument zod schema rejects grade.uint8 > 9 and confidence > 100"
    - "ReasoningDocument zod schema enforces chain_id literal 5000 (D-05 lock)"
    - "agent/.env.example references ANTHROPIC_API_KEY, MANTLE_RPC_URL, CLAUDE_MODEL — and NO other secrets"
  artifacts:
    - path: "agent/package.json"
      provides: "Workspace deps + pnpm rate script (per D-11, D-13)"
      contains: '"@anthropic-ai/sdk", "viem", "canonicalize", "zod", "zod-to-json-schema", "vitest", "tsx"'
    - path: "agent/tsconfig.json"
      provides: "ES2022 + NodeNext + strict TS config"
    - path: "agent/vitest.config.ts"
      provides: "Vitest config picking up tests/**/*.test.ts"
    - path: "agent/.env.example"
      provides: "Documented env keys — ANTHROPIC_API_KEY, MANTLE_RPC_URL, CLAUDE_MODEL=claude-sonnet-4-5"
    - path: "agent/src/constants/grade-enum.ts"
      provides: "uint8 mirror of src/constants/GradeEnum.sol (per D-12 schema)"
      contains: "export const GRADE_LETTER_TO_UINT8"
    - path: "agent/src/subjects/types.ts"
      provides: "SubjectId, Fact, SubjectFacts types (per D-01, D-12)"
      contains: "export type SubjectFacts"
    - path: "agent/src/dimensions/types.ts"
      provides: "Band, BandResult types (per D-06)"
      contains: "export type Band"
    - path: "agent/src/schema.ts"
      provides: "zod ReasoningDocument schema (per D-12) — enforces on-chain bounds (T-2-02 mitigation)"
      exports: ["ReasoningDoc", "ReasoningDocument", "parseReasoningDocument"]
    - path: "agent/tests/constants/grade-enum.test.ts"
      provides: "Mirror parity test — all 10 pairs literal + MAX=9"
    - path: "agent/tests/schema.test.ts"
      provides: "Bounds test — grade>9 and confidence>100 fail parse"
  key_links:
    - from: "agent/src/constants/grade-enum.ts"
      to: "src/constants/GradeEnum.sol"
      via: "byte-for-byte uint8 mapping"
      pattern: "AAA = 0|D = 9|MAX = 9"
    - from: "agent/src/schema.ts"
      to: "src/RatingRegistry.sol"
      via: "zod schema mirrors publishRating bounds"
      pattern: "z.literal\\(5000\\)|min\\(0\\)\\.max\\(9\\)|min\\(30\\)\\.max\\(100\\)"
---

<objective>
Establish the agent/ TypeScript workspace with strict TS config, vitest, the GradeEnum TS mirror, and the locked ReasoningDocument zod schema. All downstream waves (subjects, dimensions, claude, hash, cli) depend on these contracts.

Purpose: deterministic-vs-LLM separation lives at the directory layout. The on-chain bounds (grade ≤ 9, confidence ≤ 100) live in the zod schema as defense-in-depth so RatingRegistry never reverts on engine output.

Output: agent/ tree with package.json, tsconfig, vitest config, .env.example, GradeEnum mirror, locked ReasoningDocument zod schema + parity tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/02-rating-engine-core/02-CONTEXT.md
@.planning/phases/02-rating-engine-core/02-RESEARCH.md
@.planning/phases/02-rating-engine-core/02-PATTERNS.md
@.planning/phases/02-rating-engine-core/02-VALIDATION.md
@src/RatingRegistry.sol
@src/constants/GradeEnum.sol

<interfaces>
<!-- Contracts this wave PRODUCES that downstream waves consume -->

agent/src/constants/grade-enum.ts (Wave 0 — created here):
```ts
export const GRADE_LETTER_TO_UINT8 = {
  AAA: 0, AA: 1, A: 2, BBB: 3, BB: 4,
  B: 5, CCC: 6, CC: 7, C: 8, D: 9,
} as const;
export type GradeLetter = keyof typeof GRADE_LETTER_TO_UINT8;
export const GRADE_UINT8_TO_LETTER: Record<number, GradeLetter>;
export const GRADE_MAX = 9;
```

agent/src/subjects/types.ts (Wave 0 — created here):
```ts
export type SubjectId = "USDY" | "cmETH" | "FBTC";
export type Fact = {
  label: string;
  value: string | null;
  evidence: string;
  source:
    | { kind: "onchain"; address: `0x${string}`; function: string; blockNumber: number }
    | { kind: "static"; file: string; version: string };
};
export type SubjectFacts = {
  subject: { name: string; ticker: SubjectId; address: `0x${string}`; chainId: 5000 };
  ingestBlock: number;
  collateral: Fact[];
  contract: Fact[];
  oracle: Fact[];
  liquidity: Fact[];
};
```

agent/src/dimensions/types.ts (Wave 0 — created here):
```ts
export type Band = { max: number | null; score: number; label: string };
export type BandResult = Band & { missing_facts: string[]; raw_value: number | null };
```

agent/src/schema.ts (Wave 0 — created here, zod source of truth for ReasoningDocument):
```ts
export const ReasoningDoc: z.ZodType<ReasoningDocument>;
export type ReasoningDocument = z.infer<typeof ReasoningDoc>;
export function parseReasoningDocument(input: unknown): ReasoningDocument;
```
</interfaces>

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 2-01-01: Scaffold agent package (package.json, tsconfig, vitest, .env.example, .gitignore)</name>
  <files>agent/package.json, agent/tsconfig.json, agent/vitest.config.ts, agent/.env.example, agent/.gitignore</files>
  <read_first>
    - .planning/phases/02-rating-engine-core/02-RESEARCH.md (§6 scaffold, §11 export contract, §9 vitest config, §10 secrets-handling)
    - .planning/phases/02-rating-engine-core/02-PATTERNS.md (Secrets handling section)
    - .planning/phases/02-rating-engine-core/02-CONTEXT.md (D-02 viem, D-11 model, D-13 canonicalize, Claude's Discretion section)
    - .gitignore (root — already covers .env.*)
    - .env (do not commit; confirm MANTLE_RPC_URL pattern already exists)
  </read_first>
  <behavior>
    - Test 1: `pnpm --filter agent build` exits 0 (verifies tsconfig + package.json + tsc compile path)
    - Test 2: `agent/package.json` declares `viem@^2.52.2`, `@anthropic-ai/sdk@^0.102.0`, `canonicalize@^3.0.0`, `zod@^4.4.3`, `zod-to-json-schema@^3.24.0`, `vitest@^4.1.8`, `tsx@^4.22.4`, `typescript@^5.6.0`, `@types/node@^22.0.0`
    - Test 3: `agent/package.json` `scripts.rate === "tsx src/cli.ts"`, `scripts.test === "vitest run"`, `scripts.typecheck === "tsc --noEmit"`, `scripts.build === "tsc --noEmit"`
    - Test 4: `agent/.env.example` contains the lines `ANTHROPIC_API_KEY=`, `MANTLE_RPC_URL=https://rpc.mantle.xyz`, `CLAUDE_MODEL=claude-sonnet-4-5` and does NOT contain `PRIVATE_KEY` (T-2-01 mitigation: engine never signs in Phase 2)
    - Test 5: `agent/.gitignore` (or root .gitignore confirmed) covers `agent/.env`, `agent/.env.*`, `agent/out/`, `agent/node_modules/`, `agent/dist/`
  </behavior>
  <action>
    Create `agent/package.json` exactly:
    ```json
    {
      "name": "@touchstone/agent",
      "version": "0.0.1",
      "private": true,
      "type": "module",
      "exports": {
        ".": "./src/index.ts",
        "./hash": "./src/hash.ts",
        "./schema": "./src/schema.ts",
        "./constants/grade-enum": "./src/constants/grade-enum.ts"
      },
      "scripts": {
        "rate": "tsx src/cli.ts",
        "test": "vitest run",
        "test:watch": "vitest",
        "test:live": "RUN_LIVE=1 vitest run --reporter=verbose",
        "typecheck": "tsc --noEmit",
        "build": "tsc --noEmit"
      },
      "dependencies": {
        "@anthropic-ai/sdk": "^0.102.0",
        "canonicalize": "^3.0.0",
        "viem": "^2.52.2",
        "zod": "^4.4.3",
        "zod-to-json-schema": "^3.24.0"
      },
      "devDependencies": {
        "@types/node": "^22.0.0",
        "tsx": "^4.22.4",
        "typescript": "^5.6.0",
        "vitest": "^4.1.8"
      }
    }
    ```

    Create `agent/tsconfig.json`:
    ```json
    {
      "compilerOptions": {
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "resolveJsonModule": true,
        "isolatedModules": true,
        "noEmit": true,
        "forceConsistentCasingInFileNames": true,
        "types": ["node", "vitest/globals"]
      },
      "include": ["src/**/*.ts", "tests/**/*.ts"],
      "exclude": ["node_modules", "dist", "out"]
    }
    ```

    Create `agent/vitest.config.ts`:
    ```ts
    import { defineConfig } from "vitest/config";
    export default defineConfig({
      test: {
        globals: true,
        environment: "node",
        include: ["tests/**/*.test.ts"],
        exclude: ["tests/**/*.live.test.ts", "node_modules", "dist"],
        testTimeout: 15_000,
      },
    });
    ```

    Create `agent/.env.example`:
    ```
    # Anthropic — required for Claude synthesis (D-11)
    ANTHROPIC_API_KEY=
    # Mantle Mainnet RPC — used by viem publicClient (D-02, D-05)
    MANTLE_RPC_URL=https://rpc.mantle.xyz
    # Claude model — default per D-11; swap to claude-opus-4-7 or claude-sonnet-4-6 here
    CLAUDE_MODEL=claude-sonnet-4-5
    ```
    Do NOT include `PRIVATE_KEY` — engine never signs in Phase 2 (T-2-01 mitigation per RESEARCH §10).

    Create `agent/.gitignore`:
    ```
    node_modules/
    dist/
    out/
    .env
    .env.*
    !.env.example
    ```

    Install deps: from inside `agent/`, run `pnpm install` (or `npm install` if pnpm is unavailable — Claude's discretion per CONTEXT). Confirm package-lock or pnpm-lock is created. Commit lockfile.

    Per D-11: default model alias `claude-sonnet-4-5` (NOT `claude-opus-4-7` or `claude-sonnet-4-6`) — user lock. RESEARCH Open Q3 explicitly recommends keeping 4.5.
  </action>
  <verify>
    <automated>cd agent && pnpm install --frozen-lockfile && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `test -f agent/package.json` returns 0
    - `grep -c '"viem": "\^2.52' agent/package.json` returns 1
    - `grep -c '"@anthropic-ai/sdk": "\^0.102' agent/package.json` returns 1
    - `grep -c '"canonicalize": "\^3.0' agent/package.json` returns 1
    - `grep -c '"zod": "\^4.4' agent/package.json` returns 1
    - `grep -c '"rate": "tsx src/cli.ts"' agent/package.json` returns 1
    - `grep -c 'ANTHROPIC_API_KEY=' agent/.env.example` returns 1
    - `grep -c 'MANTLE_RPC_URL=https://rpc.mantle.xyz' agent/.env.example` returns 1
    - `grep -c 'CLAUDE_MODEL=claude-sonnet-4-5' agent/.env.example` returns 1
    - `grep -c 'PRIVATE_KEY' agent/.env.example` returns 0 (T-2-01 mitigation)
    - `grep -c '\.env\.\*' agent/.gitignore` returns 1 OR root .gitignore already covers it
    - `cd agent && pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>agent/ workspace compiles with strict TS; deps installed; .env.example documents the 3 env keys and contains no PRIVATE_KEY reference; lockfile committed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2-01-02: Mirror GradeEnum to TS with byte-for-byte parity test</name>
  <files>agent/src/constants/grade-enum.ts, agent/tests/constants/grade-enum.test.ts</files>
  <read_first>
    - src/constants/GradeEnum.sol (source of truth — uint8 0..9 mapping + MAX=9)
    - .planning/phases/02-rating-engine-core/02-PATTERNS.md (§1 constant-mirror — EXACT analog block, lines 70-128)
    - .planning/phases/02-rating-engine-core/02-CONTEXT.md (D-12 schema — grade letter enum + uint8)
    - src/RatingRegistry.sol (lines 85-86: `if (grade > GradeEnum.MAX) revert InvalidGrade();`)
  </read_first>
  <behavior>
    - Test 1: For each letter in {AAA, AA, A, BBB, BB, B, CCC, CC, C, D}, `GRADE_LETTER_TO_UINT8[letter]` returns expected uint8 (literal hard-asserts: AAA=0, AA=1, A=2, BBB=3, BB=4, B=5, CCC=6, CC=7, C=8, D=9)
    - Test 2: For each uint8 0..9, `GRADE_UINT8_TO_LETTER[n]` returns the expected letter
    - Test 3: Round-trip: `GRADE_UINT8_TO_LETTER[GRADE_LETTER_TO_UINT8[letter]] === letter` for all 10 letters
    - Test 4: `GRADE_MAX === 9` (literal assertion — mirrors `GradeEnum.MAX = 9` in Solidity)
    - Test 5: `Object.keys(GRADE_LETTER_TO_UINT8).length === 10`
  </behavior>
  <action>
    Create `agent/src/constants/grade-enum.ts` (per PATTERNS §1, byte-for-byte mirror of `src/constants/GradeEnum.sol` lines 7-21):
    ```ts
    // agent/src/constants/grade-enum.ts
    // MIRROR of src/constants/GradeEnum.sol — byte-for-byte. Any change requires
    // updating the Solidity file AND this file together. Verified by
    // agent/tests/constants/grade-enum.test.ts which round-trips each pair.

    export const GRADE_LETTER_TO_UINT8 = {
      AAA: 0,
      AA: 1,
      A: 2,
      BBB: 3,
      BB: 4,
      B: 5,
      CCC: 6,
      CC: 7,
      C: 8,
      D: 9,
    } as const;

    export type GradeLetter = keyof typeof GRADE_LETTER_TO_UINT8;

    export const GRADE_UINT8_TO_LETTER: Record<number, GradeLetter> = {
      0: "AAA", 1: "AA", 2: "A", 3: "BBB", 4: "BB",
      5: "B",   6: "CCC", 7: "CC", 8: "C",  9: "D",
    };

    /** Maximum valid grade value (inclusive). Mirrors GradeEnum.MAX in Solidity. */
    export const GRADE_MAX = 9;
    ```

    Create `agent/tests/constants/grade-enum.test.ts`:
    ```ts
    import { describe, it, expect } from "vitest";
    import {
      GRADE_LETTER_TO_UINT8,
      GRADE_UINT8_TO_LETTER,
      GRADE_MAX,
      type GradeLetter,
    } from "../../src/constants/grade-enum";

    describe("[2-01-02] GradeEnum TS mirror of src/constants/GradeEnum.sol", () => {
      // Hard-assert each pair literally — if anyone renumbers without thinking,
      // this test fails noisily. Mirrors PATTERNS §1 discipline.
      it("AAA=0", () => expect(GRADE_LETTER_TO_UINT8.AAA).toBe(0));
      it("AA=1",  () => expect(GRADE_LETTER_TO_UINT8.AA).toBe(1));
      it("A=2",   () => expect(GRADE_LETTER_TO_UINT8.A).toBe(2));
      it("BBB=3", () => expect(GRADE_LETTER_TO_UINT8.BBB).toBe(3));
      it("BB=4",  () => expect(GRADE_LETTER_TO_UINT8.BB).toBe(4));
      it("B=5",   () => expect(GRADE_LETTER_TO_UINT8.B).toBe(5));
      it("CCC=6", () => expect(GRADE_LETTER_TO_UINT8.CCC).toBe(6));
      it("CC=7",  () => expect(GRADE_LETTER_TO_UINT8.CC).toBe(7));
      it("C=8",   () => expect(GRADE_LETTER_TO_UINT8.C).toBe(8));
      it("D=9",   () => expect(GRADE_LETTER_TO_UINT8.D).toBe(9));

      it("MAX is 9 — mirrors GradeEnum.MAX in Solidity (RatingRegistry reverts InvalidGrade if > MAX)", () => {
        expect(GRADE_MAX).toBe(9);
      });

      it("contains exactly 10 letters", () => {
        expect(Object.keys(GRADE_LETTER_TO_UINT8)).toHaveLength(10);
      });

      it("round-trips letter → uint8 → letter for every entry", () => {
        for (const [letter, u8] of Object.entries(GRADE_LETTER_TO_UINT8)) {
          expect(GRADE_UINT8_TO_LETTER[u8]).toBe(letter as GradeLetter);
        }
      });
    });
    ```

    Note: this file is the constant-mirror tripwire. The Solidity values are the truth; the TS copy must be edited in the same commit if the Solidity changes.
  </action>
  <verify>
    <automated>cd agent && pnpm test -- tests/constants/grade-enum.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `test -f agent/src/constants/grade-enum.ts` returns 0
    - `grep -c 'AAA: 0' agent/src/constants/grade-enum.ts` returns 1
    - `grep -c 'D: 9' agent/src/constants/grade-enum.ts` returns 1
    - `grep -c 'GRADE_MAX = 9' agent/src/constants/grade-enum.ts` returns 1
    - `cd agent && pnpm test -- tests/constants/grade-enum.test.ts` exits 0
    - All 10 literal-pair assertions present in test file (`grep -c 'expect(GRADE_LETTER_TO_UINT8' agent/tests/constants/grade-enum.test.ts` returns ≥ 10)
  </acceptance_criteria>
  <done>GradeEnum TS mirror exists, byte-for-byte matches src/constants/GradeEnum.sol, parity test passes with all 10 pairs literally asserted plus MAX=9 + round-trip.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2-01-03: Lock ReasoningDocument zod schema with on-chain bounds (T-2-02 mitigation) + SubjectFacts and Band type contracts</name>
  <files>agent/src/subjects/types.ts, agent/src/dimensions/types.ts, agent/src/schema.ts, agent/tests/schema.test.ts, agent/src/index.ts, agent/tests/_setup.ts</files>
  <read_first>
    - .planning/phases/02-rating-engine-core/02-CONTEXT.md (D-12 ReasoningDocument shape — fields LOCKED)
    - .planning/phases/02-rating-engine-core/02-RESEARCH.md (§4 zod schema lines 279-321, §8 hash-determinism landmines, §11 export contract)
    - .planning/phases/02-rating-engine-core/02-PATTERNS.md (§2 bounds analog — zod schema bound discipline)
    - src/RatingRegistry.sol (lines 79-97: publishRating signature + bounds enforcement)
    - .planning/phases/02-rating-engine-core/02-VALIDATION.md (task 2-01-03 row)
  </read_first>
  <behavior>
    - Test 1: `parseReasoningDocument(validDoc)` returns parsed doc with same shape
    - Test 2: `parseReasoningDocument({...validDoc, grade: { letter: "AAA", uint8: 10 }})` throws (T-2-02: bound mirrors RatingRegistry InvalidGrade)
    - Test 3: `parseReasoningDocument({...validDoc, confidence: 101})` throws (T-2-02: bound mirrors RatingRegistry InvalidConfidence)
    - Test 4: `parseReasoningDocument({...validDoc, confidence: 29})` throws (D-07: confidence floor 30)
    - Test 5: `parseReasoningDocument({...validDoc, subject: {...subject, chain_id: 5003}})` throws (D-05 lock: only chain 5000)
    - Test 6: `parseReasoningDocument({...validDoc, dimensions: [...3 of them]})` throws (length(4) — 4 dimensions per D-08)
    - Test 7: confidence has no fractional component allowed — `.int()` enforced
    - Test 8: `parseReasoningDocument({...validDoc, grade: { letter: "AAA", uint8: -1 }})` throws (lower bound)
    - Test 9: A citation with `source.address = "static_config"` is accepted (D-12: static-config fallback per RESEARCH §3 note)
    - Test 10: A citation with `source.address = "not_a_hex"` is rejected (must be 0x... or "static_config")
  </behavior>
  <action>
    Create `agent/src/subjects/types.ts` exactly per RESEARCH §3.4 / PATTERNS interfaces block:
    ```ts
    export type SubjectId = "USDY" | "cmETH" | "FBTC";

    export type Fact = {
      label: string;
      value: string | null;
      evidence: string;
      source:
        | { kind: "onchain"; address: `0x${string}`; function: string; blockNumber: number }
        | { kind: "static"; file: string; version: string };
    };

    export type SubjectFacts = {
      subject: { name: string; ticker: SubjectId; address: `0x${string}`; chainId: 5000 };
      ingestBlock: number;
      /** Facts grouped by dimension consumer. Dimensions read from these buckets — NEVER the raw RPC client. */
      collateral: Fact[];
      contract: Fact[];
      oracle: Fact[];
      liquidity: Fact[];
    };
    ```

    Create `agent/src/dimensions/types.ts`:
    ```ts
    export type Band = {
      /** Upper bound (exclusive) on the dimension's quality index. `null` is the catch-all top band. */
      max: number | null;
      score: number;
      label: string;
    };

    export type BandResult = Band & {
      /** Labels of facts that were unreadable; drives D-07 confidence drop. */
      missing_facts: string[];
      /** The quality index that landed in this band (or null if dimension defaulted to 50 per D-07). */
      raw_value: number | null;
    };
    ```

    Create `agent/src/schema.ts` (locked D-12 ReasoningDocument, mirroring RESEARCH §4):
    ```ts
    import { z } from "zod";

    // Citation — every cite must point to either an on-chain address OR the
    // versioned static config sentinel "static_config" (RESEARCH §3 note,
    // PATTERNS "Static-fact citation source convention").
    const Citation = z.object({
      id: z.number().int().min(1),
      label: z.string().min(1),
      value: z.string(),
      source: z.object({
        address: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$|^static_config$/, "must be a 0x address or the literal string 'static_config'"),
        function: z.string().min(1),
        block_number: z.number().int().nonnegative(),
      }),
      evidence: z.string().min(1),
    });

    const Dimension = z.object({
      key: z.enum([
        "collateral_quality",
        "contract_risk",
        "oracle_integrity",
        "liquidity_stability",
      ]),
      score: z.number().int().min(0).max(100),
      band_hit: z.object({
        max: z.number().nullable(),
        score: z.number().int(),
        label: z.string().min(1),
      }),
      missing_facts: z.array(z.string()),
      rationale: z.string().min(1),
      citations: z.array(Citation),
    });

    /**
     * Locked ReasoningDocument shape per D-12. Phase 3 hashes this; Phase 4 verifies it.
     * Any change is a breaking change for downstream phases.
     *
     * On-chain bound mirrors (T-2-02 mitigation):
     *   grade.uint8: 0..9      mirrors GradeEnum.MAX and RatingRegistry.InvalidGrade
     *   confidence:  30..100   100 ceiling mirrors RatingRegistry.InvalidConfidence;
     *                          30 floor is D-07 (engine-internal missing-fact handling)
     *   subject.chain_id: literal 5000  D-05 lock: engine reads from Mantle Mainnet
     *   dimensions: length 4   D-08 lock: uniform 25% over 4 dimensions
     */
    export const ReasoningDoc = z.object({
      schema_version: z.literal("1.0.0"), // defensive default per CONTEXT specifics
      subject: z.object({
        name: z.string().min(1),
        ticker: z.enum(["USDY", "cmETH", "FBTC"]),
        address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        chain_id: z.literal(5000),
      }),
      grade: z.object({
        letter: z.enum(["AAA","AA","A","BBB","BB","B","CCC","CC","C","D"]),
        uint8: z.number().int().min(0).max(9),
      }),
      confidence: z.number().int().min(30).max(100),
      dimensions: z.array(Dimension).length(4),
      overall_rationale: z.string().min(1),
      generated_at: z.string().min(1), // ISO 8601; engine sets, NOT Claude
      claude_model: z.string().min(1),
      ingest_block: z.number().int().nonnegative(),
    });

    export type ReasoningDocument = z.infer<typeof ReasoningDoc>;

    /** Strict parse helper used by claude/synthesize.ts and tests. */
    export function parseReasoningDocument(input: unknown): ReasoningDocument {
      return ReasoningDoc.parse(input);
    }
    ```

    Create `agent/src/index.ts` (barrel — Wave 0 minimal version; later waves extend it):
    ```ts
    export { GRADE_LETTER_TO_UINT8, GRADE_UINT8_TO_LETTER, GRADE_MAX } from "./constants/grade-enum";
    export type { GradeLetter } from "./constants/grade-enum";
    export { ReasoningDoc, parseReasoningDocument } from "./schema";
    export type { ReasoningDocument } from "./schema";
    export type { SubjectId, Fact, SubjectFacts } from "./subjects/types";
    export type { Band, BandResult } from "./dimensions/types";
    ```

    Create `agent/tests/_setup.ts` (empty/minimal — Wave 2/3 will extend with mock fixtures):
    ```ts
    // Shared test setup. Wave 0: empty. Wave 2/3 add mock Anthropic + RPC fixtures.
    export {};
    ```

    Create `agent/tests/schema.test.ts`:
    ```ts
    import { describe, it, expect } from "vitest";
    import { parseReasoningDocument, ReasoningDoc } from "../src/schema";

    const validDoc = {
      schema_version: "1.0.0",
      subject: {
        name: "Ondo U.S. Dollar Yield",
        ticker: "USDY",
        address: "0x5be26527e817998A7206475496fDE1E68957c5A6",
        chain_id: 5000,
      },
      grade: { letter: "A", uint8: 2 },
      confidence: 85,
      dimensions: [
        {
          key: "collateral_quality",
          score: 72,
          band_hit: { max: 70, score: 72, label: "strong collateral" },
          missing_facts: [],
          rationale: "Tokenized treasuries with monthly attestation [1].",
          citations: [{
            id: 1,
            label: "issuer",
            value: "Ondo Finance",
            // W4 fix: seed uses a real 0x address so the static_config test below is a meaningful mutation.
            source: { address: "0x5be26527e817998A7206475496fDE1E68957c5A6", function: "issuer()", block_number: 75000000 },
            evidence: "Ondo Finance is the issuer (on-chain reference).",
          }],
        },
        {
          key: "contract_risk",
          score: 72,
          band_hit: { max: 70, score: 72, label: "verified, audited" },
          missing_facts: [],
          rationale: "Verified source on Mantlescan [1].",
          citations: [{
            id: 1,
            label: "implementation",
            value: "0x3b355A7A25E75A320f631F9736afB3Dcc9F3Ef66",
            source: { address: "0x5be26527e817998A7206475496fDE1E68957c5A6", function: "implementation()", block_number: 75000000 },
            evidence: "EIP-1967 implementation slot points to a verified contract.",
          }],
        },
        {
          key: "oracle_integrity",
          score: 55,
          band_hit: { max: 50, score: 55, label: "single oracle with documented staleness guard" },
          missing_facts: [],
          rationale: "Internal accrual model [1].",
          citations: [{
            id: 1,
            label: "oracle architecture",
            value: "internal-accrual, daily settler",
            source: { address: "static_config", function: "static.ts@1.0.0", block_number: 0 },
            evidence: "USDY accrues price internally.",
          }],
        },
        {
          key: "liquidity_stability",
          score: 82,
          band_hit: { max: 500_000_000, score: 82, label: "deep parent liquidity" },
          missing_facts: [],
          rationale: "Parent supply $680M [1].",
          citations: [{
            id: 1,
            label: "parent TVL",
            value: "$680,000,000",
            source: { address: "static_config", function: "static.ts@1.0.0", block_number: 0 },
            evidence: "Parent TVL recorded in static config.",
          }],
        },
      ],
      overall_rationale: "USDY presents low risk across all four dimensions.",
      generated_at: "2026-06-09T00:00:00Z",
      claude_model: "claude-sonnet-4-5",
      ingest_block: 75000000,
    };

    describe("[2-01-03] ReasoningDocument zod schema", () => {
      it("accepts a valid document", () => {
        expect(() => parseReasoningDocument(validDoc)).not.toThrow();
      });

      it("rejects grade.uint8 > 9 (T-2-02: mirrors GradeEnum.MAX = 9)", () => {
        expect(() => parseReasoningDocument({ ...validDoc, grade: { letter: "AAA", uint8: 10 } })).toThrow();
      });

      it("rejects grade.uint8 < 0 (lower bound)", () => {
        expect(() => parseReasoningDocument({ ...validDoc, grade: { letter: "AAA", uint8: -1 } })).toThrow();
      });

      it("rejects confidence > 100 (T-2-02: mirrors RatingRegistry.InvalidConfidence)", () => {
        expect(() => parseReasoningDocument({ ...validDoc, confidence: 101 })).toThrow();
      });

      it("rejects confidence < 30 (D-07: floor)", () => {
        expect(() => parseReasoningDocument({ ...validDoc, confidence: 29 })).toThrow();
      });

      it("rejects fractional confidence (.int() enforced)", () => {
        expect(() => parseReasoningDocument({ ...validDoc, confidence: 85.5 })).toThrow();
      });

      it("rejects subject.chain_id != 5000 (D-05 lock)", () => {
        expect(() => parseReasoningDocument({
          ...validDoc,
          subject: { ...validDoc.subject, chain_id: 5003 },
        })).toThrow();
      });

      it("rejects dimensions.length != 4 (D-08 uniform 25% requires exactly 4)", () => {
        expect(() => parseReasoningDocument({
          ...validDoc,
          dimensions: validDoc.dimensions.slice(0, 3),
        })).toThrow();
      });

      it("accepts citation with source.address == 'static_config'", () => {
        // W4 fix: deep-clone via JSON.parse(JSON.stringify(...)) to avoid mutating validDoc.
        const doc = JSON.parse(JSON.stringify(validDoc));
        doc.dimensions[0].citations[0].source.address = "static_config";
        expect(() => parseReasoningDocument(doc)).not.toThrow();
      });

      it("rejects citation with malformed source.address", () => {
        const doc = JSON.parse(JSON.stringify(validDoc));
        doc.dimensions[0].citations[0].source.address = "not_a_hex";
        expect(() => parseReasoningDocument(doc)).toThrow();
      });

      it("schema_version is locked to '1.0.0'", () => {
        expect(() => parseReasoningDocument({ ...validDoc, schema_version: "2.0.0" })).toThrow();
      });
    });
    ```

    Note on RESEARCH Open Q4 — `schema_version` field: planner ADDED `schema_version: "1.0.0"` as locked literal per RESEARCH's recommendation. Easy revert if user objects.
  </action>
  <verify>
    <automated>cd agent && pnpm test -- tests/schema.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `test -f agent/src/subjects/types.ts` returns 0
    - `test -f agent/src/dimensions/types.ts` returns 0
    - `test -f agent/src/schema.ts` returns 0
    - `test -f agent/src/index.ts` returns 0
    - `grep -c 'export type SubjectFacts' agent/src/subjects/types.ts` returns 1
    - `grep -c 'export type Band' agent/src/dimensions/types.ts` returns 1
    - `grep -c 'z.literal(5000)' agent/src/schema.ts` returns 1
    - `grep -c '\.min(0)\.max(9)' agent/src/schema.ts` returns 1
    - `grep -c '\.min(30)\.max(100)' agent/src/schema.ts` returns 1
    - `grep -c '\.length(4)' agent/src/schema.ts` returns 1
    - `grep -c 'schema_version.*1\.0\.0' agent/src/schema.ts` returns 1
    - `cd agent && pnpm test -- tests/schema.test.ts` exits 0
    - `cd agent && pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>ReasoningDocument zod schema locked per D-12, on-chain bounds enforced as defense-in-depth, 11+ schema-bound tests pass, SubjectFacts/Band types exported for downstream waves.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries (Wave 0 scope)

| Boundary | Description |
|----------|-------------|
| filesystem → engine | `.env` secrets read from disk; never serialized back into JSON or stdout |
| engine → on-chain contract (cross-phase) | Phase 3 publishes the engine's grade + confidence; engine must respect contract bounds (`grade ≤ 9`, `confidence ≤ 100`) at the schema level |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-2-01 | Information Disclosure | `agent/.env.example`, `agent/.gitignore` | mitigate | `agent/.env.example` lists ONLY `ANTHROPIC_API_KEY` / `MANTLE_RPC_URL` / `CLAUDE_MODEL` — NO `PRIVATE_KEY`. `agent/.gitignore` covers `.env`, `.env.*`, `out/`. Acceptance criterion `grep -c 'PRIVATE_KEY' agent/.env.example == 0` enforces. |
| T-2-02 | Tampering (Integrity, Phase 3 break) | `agent/src/schema.ts` | mitigate | zod schema caps `grade.uint8 ∈ [0,9]`, `confidence ∈ [30,100]`, `chain_id == 5000`, `dimensions.length == 4`, plus `schema_version == "1.0.0"`. Mirrors RatingRegistry's `InvalidGrade` and `InvalidConfidence` reverts. Tests 2-3-4-5-6-8 in Task 2-01-03 enforce. |
</threat_model>

<verification>
- `cd agent && pnpm install --frozen-lockfile` exits 0
- `cd agent && pnpm typecheck` exits 0
- `cd agent && pnpm test` exits 0 (runs grade-enum + schema tests)
- Per-task acceptance criteria all pass
- No `PRIVATE_KEY` reference in any agent/ file (T-2-01)
- Schema rejects every out-of-bound value enumerated in T-2-02
</verification>

<success_criteria>
- agent/ workspace compiles strictly
- GradeEnum TS mirror matches Solidity byte-for-byte; parity test green
- ReasoningDocument zod schema locked per D-12; bounds test green
- Downstream waves can import `ReasoningDocument`, `SubjectFacts`, `Band`, `GRADE_*` from this wave without modification
- Per-task atomic commits in the `feat(02): ...` / `test(02): ...` style carried over from Phase 1
</success_criteria>

<output>
After completion, create `.planning/phases/02-rating-engine-core/02-01-SUMMARY.md` documenting:
- Files created (with paths)
- Lockfile manager chosen (pnpm vs npm) and rationale
- Any deviation from RESEARCH/CONTEXT (none expected; note if found)
- Test results: `pnpm test` output summary
</output>
