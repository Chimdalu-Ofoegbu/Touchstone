---
phase: 02
plan: 02
plan_id: 02-02-subjects
type: execute
wave: 1
depends_on: [02-01-scaffold]
files_modified:
  - agent/src/rpc.ts
  - agent/src/multicall.ts
  - agent/src/constants/prices.ts
  - agent/src/subjects/static.ts
  - agent/src/subjects/usdy.ts
  - agent/src/subjects/cmeth.ts
  - agent/src/subjects/fbtc.ts
  - agent/src/subjects/registry.ts
  - agent/tests/subjects/usdy.test.ts
  - agent/tests/subjects/cmeth.test.ts
  - agent/tests/subjects/fbtc.test.ts
  - agent/tests/subjects/static.test.ts
  - agent/tests/subjects/no-latest-leak.test.ts
  - agent/tests/fixtures/usdy.fixture.ts
  - agent/tests/fixtures/cmeth.fixture.ts
  - agent/tests/fixtures/fbtc.fixture.ts
autonomous: true
requirements:
  - REQ-05
objective: |
  Per-subject adapters for USDY, cmETH, FBTC. Each calls viem + Multicall3 from
  Mantle Mainnet (chain 5000), accepts optional blockNumber for Phase 3 historical
  replay, batches reads (≤3 multicall round-trips), reports missing facts, and
  returns SubjectFacts grouped by dimension. Static off-chain facts file is
  versioned (STATIC_VERSION = "1.0.0") so citations are reproducible.

must_haves:
  truths:
    - "USDY adapter returns SubjectFacts with subject.chainId == 5000 and address 0x5be...c5A6"
    - "cmETH adapter returns SubjectFacts with subject.chainId == 5000 and address 0xE68...e8fA"
    - "FBTC adapter returns SubjectFacts with subject.chainId == 5000 and address 0xC96...C364"
    - "All adapter source files thread blockNumber through every multicall/readContract call (no `latest` leak)"
    - "Static facts file exports STATIC_VERSION = '1.0.0'"
    - "When a read fails (allowFailure path), the corresponding Fact has value: null and label appears in missing_facts"
    - "Multicall3 address used is 0xcA11bde05977b3631167028862bE2a173976CA11 (per D-03 — same as viem chain mantle definition)"
  artifacts:
    - path: "agent/src/rpc.ts"
      provides: "viem publicClient bound to Mantle Mainnet (chain 5000) with redact helper"
      exports: ["publicClient", "redactRpcUrl"]
    - path: "agent/src/multicall.ts"
      provides: "multiread() helper — allowFailure path drives missing_facts (D-07)"
      exports: ["multiread", "Read", "ReadResult"]
    - path: "agent/src/constants/prices.ts"
      provides: "Static USD prices keyed by block range — hash determinism mechanism"
      exports: ["priceAtBlock", "PRICES"]
    - path: "agent/src/subjects/static.ts"
      provides: "Versioned off-chain facts per subject + STATIC_VERSION"
      contains: 'STATIC_VERSION = "1.0.0"'
    - path: "agent/src/subjects/usdy.ts"
      provides: "USDY adapter — fetch(blockNumber?): Promise<SubjectFacts>"
      exports: ["fetchUsdy"]
    - path: "agent/src/subjects/cmeth.ts"
      provides: "cmETH adapter"
      exports: ["fetchCmeth"]
    - path: "agent/src/subjects/fbtc.ts"
      provides: "FBTC adapter"
      exports: ["fetchFbtc"]
    - path: "agent/src/subjects/registry.ts"
      provides: "SubjectId → adapter dispatch"
      exports: ["ADAPTERS", "getAdapter"]
    - path: "agent/tests/subjects/no-latest-leak.test.ts"
      provides: "Grep-style tripwire — confirms blockNumber threads through every multicall call site in adapters"
  key_links:
    - from: "agent/src/subjects/{usdy,cmeth,fbtc}.ts"
      to: "agent/src/multicall.ts"
      via: "multiread(reads, blockNumber)"
      pattern: "multiread\\([^)]*blockNumber"
    - from: "agent/src/multicall.ts"
      to: "viem publicClient"
      via: "client.multicall({ contracts, blockNumber, allowFailure: true })"
      pattern: "allowFailure: true"
    - from: "agent/src/subjects/static.ts"
      to: "Fact.source.version"
      via: "STATIC_VERSION constant"
      pattern: "STATIC_VERSION = \"1\\.0\\.0\""
---

<objective>
Implement the per-subject ingest layer (D-01 per-subject adapters; D-02 viem; D-03 Multicall3; D-04 block-pinning; D-05 chain 5000) so dimensions consume normalized SubjectFacts and never the raw RPC client. Establishes the CON-deterministic-vs-llm-separation boundary at runtime.

Purpose: deterministic data ingest is the input edge of REQ-01 and the engine-side guarantee of REQ-05 (3 subjects). Per-subject organization is judged easier to inspect than dimension-first.

Output: 3 adapters + 1 dispatch registry + viem/multicall/prices/static utility files + per-adapter unit tests using recorded fixtures (no live RPC required in CI).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md (DEC-subject-set-locked — 3 addresses on Mantle Mainnet)
@.planning/phases/02-rating-engine-core/02-CONTEXT.md (D-01..D-05 — ingest contract)
@.planning/phases/02-rating-engine-core/02-RESEARCH.md (§1 viem, §2 multicall, §3 per-subject reads, §3.4 SubjectFacts shape, §10 threat model RPC redaction)
@.planning/phases/02-rating-engine-core/02-PATTERNS.md (Block-pinning thread-through, Secrets handling, Static-fact citation source)
@.planning/phases/02-rating-engine-core/02-01-SUMMARY.md
@agent/src/subjects/types.ts
@agent/src/index.ts

<interfaces>
<!-- Already produced in Wave 0 (02-01-scaffold) -->

From agent/src/subjects/types.ts:
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

<!-- This wave PRODUCES -->

agent/src/rpc.ts:
```ts
export const publicClient: PublicClient; // chain mantle, transport http(MANTLE_RPC_URL)
export function redactRpcUrl(message: string): string;
```

agent/src/multicall.ts:
```ts
export type Read = { address: Address; abi: Abi; functionName: string; args?: readonly unknown[]; label: string };
export type ReadResult<T = unknown> =
  | { ok: true; value: T; label: string }
  | { ok: false; error: string; label: string };
export function multiread(reads: Read[], blockNumber?: bigint): Promise<ReadResult[]>;
```

agent/src/subjects/registry.ts:
```ts
export const ADAPTERS: Record<SubjectId, (block?: bigint) => Promise<SubjectFacts>>;
export function getAdapter(id: SubjectId): (block?: bigint) => Promise<SubjectFacts>;
```
</interfaces>

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 2-02-01: viem publicClient, Multicall3 helper, static prices + static facts module</name>
  <files>agent/src/rpc.ts, agent/src/multicall.ts, agent/src/constants/prices.ts, agent/src/subjects/static.ts, agent/tests/subjects/static.test.ts</files>
  <read_first>
    - .planning/phases/02-rating-engine-core/02-RESEARCH.md (§1 viem setup, §2 multicall wrapper, §3 footnote on static prices, §3.1-§3.3 per-subject static fields, §10 threat-model rows on RPC URL leakage)
    - .planning/phases/02-rating-engine-core/02-PATTERNS.md (Secrets handling section — redact rule, Static-fact citation source convention)
    - .planning/phases/02-rating-engine-core/02-CONTEXT.md (D-02 viem, D-03 Multicall3 0xcA11..CA11, D-04 blockNumber threading)
    - agent/src/subjects/types.ts (Fact.source shape)
  </read_first>
  <behavior>
    - Test 1: `STATIC_VERSION === "1.0.0"` (literal lock — used in Fact.source.version)
    - Test 2: Static facts file exports USDY/cmETH/FBTC objects each with non-empty `collateral`, `audit`, and `oracleArchitecture` keys
    - Test 3: `priceAtBlock(75000000)` returns a price entry containing `BTC_USD`, `ETH_USD`, `MNT_USD` keys with positive numeric values
    - Test 4: `redactRpcUrl("error fetching from https://abc.alchemy.com/v2/SECRETKEY/...")` does NOT contain `SECRETKEY` when `MANTLE_RPC_URL` is set to that URL (T-2-03 mitigation)
    - Test 5: `multiread([], undefined)` returns `[]` without throwing (empty-list edge)
  </behavior>
  <action>
    Create `agent/src/rpc.ts` (RESEARCH §1):
    ```ts
    import { createPublicClient, http, type PublicClient } from "viem";
    import { mantle } from "viem/chains";

    const MANTLE_RPC_URL = process.env.MANTLE_RPC_URL ?? "https://rpc.mantle.xyz";

    export const publicClient: PublicClient = createPublicClient({
      chain: mantle,
      transport: http(MANTLE_RPC_URL, {
        retryCount: 2,
        timeout: 15_000,
      }),
      batch: { multicall: true },
    });

    /**
     * Redact MANTLE_RPC_URL (which may contain an Alchemy/Infura API key) from
     * any error message before it is logged or written to JSON. T-2-03 mitigation
     * per RESEARCH §10.
     */
    export function redactRpcUrl(message: string): string {
      if (!message || !MANTLE_RPC_URL) return message;
      return message.split(MANTLE_RPC_URL).join("[redacted]");
    }

    /** Test-only export — for use by redaction tests; not part of public API. */
    export const __test = { MANTLE_RPC_URL };
    ```

    Create `agent/src/multicall.ts` (RESEARCH §2):
    ```ts
    import type { Abi, Address } from "viem";
    import { publicClient } from "./rpc";

    export type Read = {
      address: Address;
      abi: Abi;
      functionName: string;
      args?: readonly unknown[];
      /** Human-readable label — drives missing_facts and citations. */
      label: string;
    };

    export type ReadResult<T = unknown> =
      | { ok: true; value: T; label: string }
      | { ok: false; error: string; label: string };

    /**
     * Batched read via Multicall3 0xcA11bde05977b3631167028862bE2a173976CA11
     * (canonical on every EVM chain; pre-wired in viem's mantle chain definition).
     *
     * D-03: ≤3 multiread calls per subject.
     * D-04: blockNumber MUST be threaded from the adapter's argument.
     * D-07: allowFailure → failed reads become ReadResult{ok:false} entries; adapters
     *       transform these into missing_facts on the SubjectFacts.
     */
    export async function multiread(
      reads: Read[],
      blockNumber?: bigint
    ): Promise<ReadResult[]> {
      if (reads.length === 0) return [];
      const results = await publicClient.multicall({
        contracts: reads.map(({ label: _label, ...c }) => c),
        blockNumber,
        allowFailure: true,
      });
      return results.map((r, i) => {
        const label = reads[i].label;
        if (r.status === "success") {
          return { ok: true, value: r.result, label } as ReadResult;
        }
        const err = (r as any).error?.shortMessage ?? String((r as any).error ?? "unknown");
        return { ok: false, error: String(err), label };
      });
    }
    ```

    Create `agent/src/constants/prices.ts` (RESEARCH §3 footnote — hash determinism):
    ```ts
    // Static USD prices keyed by block range. Hash-determinism mechanism:
    // engine NEVER hits a live price API at rating time; instead this file is
    // versioned and looked up by ingest_block. Phase 3 historical replay
    // (Elixir deUSD) uses block-range entries; Phase 2 live runs use the
    // "default" entry (recordedAtBlock 0).

    export type PriceEntry = {
      recordedAtBlock: number;
      BTC_USD: number;
      ETH_USD: number;
      MNT_USD: number;
    };

    /** Ordered from oldest to newest. priceAtBlock picks the highest entry whose recordedAtBlock <= block. */
    export const PRICES: PriceEntry[] = [
      // Phase 2 default — pinned at planning time (2026-06-09). Refresh if necessary.
      { recordedAtBlock: 0, BTC_USD: 95_000, ETH_USD: 3_800, MNT_USD: 0.6 },
    ];

    export function priceAtBlock(block: number): PriceEntry {
      let chosen = PRICES[0];
      for (const p of PRICES) {
        if (p.recordedAtBlock <= block) chosen = p;
      }
      return chosen;
    }
    ```

    Create `agent/src/subjects/static.ts` (RESEARCH §3.1-§3.3 + §3 note):
    ```ts
    import type { SubjectId } from "./types";

    /**
     * Static facts version. Bumped any time the contents change. Cited as
     * Fact.source.version per the Static-fact citation source convention
     * (PATTERNS §"Shared Patterns").
     */
    export const STATIC_VERSION = "1.0.0";

    export type StaticSubject = {
      name: string;
      address: `0x${string}`;
      collateral: string;
      audit: string[];
      reserveAttestation: string;
      custodian: string | null;
      oracleArchitecture: string;
      stalenessTolerance: string;
      pausable: boolean;
      timelock: string | null;
      sourceVerified: boolean;
      implementation: `0x${string}` | null;
      proxyPattern: string;
      mantleTVL_USD: number;
      parentTVL_USD: number;
      /** Holder addresses to probe for concentration. Empty array if none known. */
      holderProbeList: `0x${string}`[];
      /** Optional on-chain BTC/USD oracle for FBTC; ETH/USD oracle for cmETH. */
      priceFeed: `0x${string}` | null;
    };

    export const STATIC: Record<SubjectId, StaticSubject> = {
      USDY: {
        name: "Ondo U.S. Dollar Yield",
        address: "0x5be26527e817998A7206475496fDE1E68957c5A6",
        collateral: "short-term US Treasuries + bank deposits",
        audit: ["Code4rena 2023", "Halborn 2024"],
        reserveAttestation: "monthly attestation by Ankura Trust",
        custodian: "Ankura Trust",
        oracleArchitecture: "internal-accrual, daily settler, no external feed on Mantle",
        stalenessTolerance: "24h",
        pausable: true,
        timelock: null,
        sourceVerified: true,
        implementation: "0x3b355A7A25E75A320f631F9736afB3Dcc9F3Ef66",
        proxyPattern: "EIP-1967 transparent proxy",
        mantleTVL_USD: 8_000_000,
        parentTVL_USD: 680_000_000,
        holderProbeList: [],
        priceFeed: null,
      },
      cmETH: {
        name: "Mantle Restaked ETH",
        address: "0xE6829d9a7ee3040e1276Fa75293Bde931859e8fA",
        collateral: "mETH receipt restaked across EigenLayer, Symbiotic, Karak",
        audit: ["Sigma Prime", "Hexens"],
        reserveAttestation: "off-chain prover with on-chain settlement",
        custodian: null,
        oracleArchitecture: "restaked-balance proof system, off-chain prover with on-chain settlement",
        stalenessTolerance: "24h",
        pausable: true,
        timelock: null,
        sourceVerified: true,
        implementation: "0x5A7b3CDe8ac8d780af4797bf1517464ac54ca033",
        proxyPattern: "EIP-1967 transparent proxy",
        mantleTVL_USD: 750_000_000,
        parentTVL_USD: 750_000_000,
        holderProbeList: [],
        priceFeed: null,
      },
      FBTC: {
        name: "FunctionBTC",
        address: "0xC96dE26018A54D51c097160568752c4E3BD6C364",
        collateral: "BTC held by institutional custodian network (Galaxy Digital, Antalpha, Coresky)",
        audit: ["SlowMist 2024", "BlockSec 2024"],
        reserveAttestation: "monthly proof-of-reserves; on-chain PoR where available",
        custodian: "FBTC custodian network",
        oracleArchitecture: "off-chain reserve attestation + Chainlink Proof-of-Reserves where available",
        stalenessTolerance: "monthly",
        pausable: true,
        timelock: null,
        sourceVerified: true,
        implementation: null,
        proxyPattern: "UUPS",
        mantleTVL_USD: 100_000_000,
        parentTVL_USD: 1_500_000_000,
        holderProbeList: [],
        priceFeed: null,
      },
    };

    /** Build a `static`-kind Fact from a STATIC entry field. */
    export function staticFact(opts: {
      label: string;
      value: string | null;
      evidence: string;
    }) {
      return {
        label: opts.label,
        value: opts.value,
        evidence: opts.evidence,
        source: { kind: "static" as const, file: "agent/src/subjects/static.ts", version: STATIC_VERSION },
      };
    }
    ```

    Create `agent/tests/subjects/static.test.ts`:
    ```ts
    import { describe, it, expect } from "vitest";
    import { STATIC, STATIC_VERSION, staticFact } from "../../src/subjects/static";
    import { priceAtBlock, PRICES } from "../../src/constants/prices";
    import { multiread } from "../../src/multicall";
    import { redactRpcUrl } from "../../src/rpc";

    describe("[2-02-01a] STATIC facts module", () => {
      it("STATIC_VERSION is locked to '1.0.0'", () => {
        expect(STATIC_VERSION).toBe("1.0.0");
      });

      it.each(["USDY", "cmETH", "FBTC"] as const)(
        "STATIC.%s has non-empty collateral, audit, oracleArchitecture",
        (id) => {
          const s = STATIC[id];
          expect(s.collateral.length).toBeGreaterThan(0);
          expect(s.audit.length).toBeGreaterThan(0);
          expect(s.oracleArchitecture.length).toBeGreaterThan(0);
        }
      );

      it("staticFact() builds Fact with versioned source", () => {
        const f = staticFact({ label: "issuer", value: "Ondo Finance", evidence: "..." });
        expect(f.source).toEqual({ kind: "static", file: "agent/src/subjects/static.ts", version: "1.0.0" });
      });
    });

    describe("[2-02-01b] Prices lookup (hash determinism)", () => {
      it("priceAtBlock(0) returns the default entry", () => {
        const p = priceAtBlock(0);
        expect(p.BTC_USD).toBeGreaterThan(0);
        expect(p.ETH_USD).toBeGreaterThan(0);
        expect(p.MNT_USD).toBeGreaterThan(0);
      });

      it("PRICES is non-empty and ordered", () => {
        expect(PRICES.length).toBeGreaterThan(0);
        for (let i = 1; i < PRICES.length; i++) {
          expect(PRICES[i].recordedAtBlock).toBeGreaterThanOrEqual(PRICES[i-1].recordedAtBlock);
        }
      });
    });

    describe("[2-02-01c] Multicall + RPC redaction (T-2-03)", () => {
      it("multiread([]) returns empty array without RPC call", async () => {
        const result = await multiread([]);
        expect(result).toEqual([]);
      });

      it("redactRpcUrl scrubs MANTLE_RPC_URL out of error messages", () => {
        // Default MANTLE_RPC_URL is https://rpc.mantle.xyz; ensure it is replaced.
        const msg = "error fetching from https://rpc.mantle.xyz/foo: timeout";
        const redacted = redactRpcUrl(msg);
        expect(redacted.includes("https://rpc.mantle.xyz")).toBe(false);
        expect(redacted.includes("[redacted]")).toBe(true);
      });
    });
    ```
  </action>
  <verify>
    <automated>cd agent && pnpm test -- tests/subjects/static.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `test -f agent/src/rpc.ts` returns 0
    - `test -f agent/src/multicall.ts` returns 0
    - `test -f agent/src/constants/prices.ts` returns 0
    - `test -f agent/src/subjects/static.ts` returns 0
    - `grep -c 'STATIC_VERSION = "1.0.0"' agent/src/subjects/static.ts` returns 1
    - `grep -c '0xcA11bde05977b3631167028862bE2a173976CA11' agent/src/multicall.ts` returns 0 (we rely on viem's mantle chain definition — confirm no hand-hardcoded address in our helper)
    - `grep -c 'allowFailure: true' agent/src/multicall.ts` returns 1 (D-07 mitigation)
    - `grep -c 'redactRpcUrl' agent/src/rpc.ts` returns ≥ 1 (T-2-03 mitigation)
    - `grep -c '0x5be26527e817998A7206475496fDE1E68957c5A6' agent/src/subjects/static.ts` returns 1 (USDY locked address)
    - `grep -c '0xE6829d9a7ee3040e1276Fa75293Bde931859e8fA' agent/src/subjects/static.ts` returns 1 (cmETH locked address)
    - `grep -c '0xC96dE26018A54D51c097160568752c4E3BD6C364' agent/src/subjects/static.ts` returns 1 (FBTC locked address)
    - `cd agent && pnpm test -- tests/subjects/static.test.ts` exits 0
  </acceptance_criteria>
  <done>viem publicClient bound to Mantle Mainnet; multiread helper with allowFailure + blockNumber threading; static facts file with locked STATIC_VERSION = "1.0.0" and 3 subject entries; RPC URL redaction helper proven by test.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2-02-02: USDY adapter + fixture + unit test (W3 split: per-task scope <= 10 files)</name>
  <files>agent/src/subjects/usdy.ts, agent/tests/subjects/usdy.test.ts, agent/tests/fixtures/usdy.fixture.ts</files>
  <read_first>
    - .planning/phases/02-rating-engine-core/02-RESEARCH.md (§3.1 USDY reads, §3.2 cmETH reads, §3.3 FBTC reads, §3.4 SubjectFacts shape; §10 threat-model row "Replay-at-block reads inconsistent if `latest` snuck in")
    - .planning/phases/02-rating-engine-core/02-PATTERNS.md (Block-pinning thread-through, Static-fact citation source convention)
    - .planning/phases/02-rating-engine-core/02-CONTEXT.md (D-01 per-subject layout, D-04 block pinning, D-07 missing-fact handling)
    - agent/src/subjects/types.ts (SubjectFacts shape)
    - agent/src/multicall.ts (multiread signature)
    - agent/src/subjects/static.ts (STATIC, staticFact)
    - agent/src/constants/prices.ts (priceAtBlock)
  </read_first>
  <behavior>
    - Test 1 (per subject): `fetch(blockNumber)` returns SubjectFacts with `subject.chainId == 5000`
    - Test 2 (per subject): `fetch(blockNumber)` returns SubjectFacts whose `subject.address` equals the locked subject address
    - Test 3 (per subject): When `blockNumber = 75_000_000n` is passed, every onchain Fact has `source.blockNumber === 75_000_000`
    - Test 4 (per subject): When all multicall reads return `{status: "failure"}` (mocked), `collateral`/`contract`/`oracle`/`liquidity` contain at least one Fact each but with `value: null` (missing-fact handling at the adapter boundary — does NOT default to 50 here; that's the dimension's job)
    - Test 5 (per subject): When all multicall reads return `{status: "success"}` (mocked) with sensible values, returned SubjectFacts has at least 2 facts in each of `collateral`, `contract`, `oracle`, `liquidity` buckets
    - Test 6 (per subject): All on-chain Facts have `source.kind === "onchain"`; static-sourced facts have `source.kind === "static"` and `source.version === "1.0.0"`
    - Test 7 (no-latest-leak): grep `client\\.multicall(` and `client\\.readContract(` and `multiread(` in `agent/src/subjects/{usdy,cmeth,fbtc}.ts` — every match's enclosing function must accept a `blockNumber` parameter and pass it through (manually verified test: read the source as a string and assert `blockNumber` token appears within ~80 chars of each `multiread(` call site)
    - Test 8 (registry): `ADAPTERS.USDY === fetchUsdy`, `ADAPTERS.cmETH === fetchCmeth`, `ADAPTERS.FBTC === fetchFbtc`
    - Test 9 (registry): `getAdapter("USDY")` returns `fetchUsdy`
  </behavior>
  <action>
    Create `agent/tests/fixtures/usdy.fixture.ts` — exports `usdyMulticallSuccess` and `usdyMulticallAllFail` mock-return arrays matching the expected `multiread` ReadResult[] shape. Use real-looking values: `totalSupply` = `680_000_000_000000n` (6 decimals → $680M), `decimals` = `6`, `paused` = `false`, `implementation` = `"0x3b355A7A25E75A320f631F9736afB3Dcc9F3Ef66"`. The all-fail variant returns 4-6 `{ok: false, error: "exec reverted"}` entries.

    Create the same for `agent/tests/fixtures/cmeth.fixture.ts` (totalSupply `200000_000000000000000000n` 18 decimals → 200k ETH ≈ $760M at $3800; implementation `0x5A7b3CDe8ac8d780af4797bf1517464ac54ca033`) and `agent/tests/fixtures/fbtc.fixture.ts` (decimals 8; totalSupply `1000_00000000n` → 1000 BTC ≈ $95M at $95k).

    Create `agent/src/subjects/usdy.ts` (RESEARCH §3.1):
    ```ts
    import { erc20Abi, type Address, parseAbi } from "viem";
    import type { SubjectFacts, Fact } from "./types";
    import { multiread, type Read } from "../multicall";
    import { STATIC, STATIC_VERSION, staticFact } from "./static";
    import { priceAtBlock } from "../constants/prices";

    const ADDR: Address = STATIC.USDY.address;

    // Extra surface for USDY. If a function does not exist on the proxy, viem's
    // allowFailure path drops it into missing_facts.
    const USDY_EXTRA_ABI = parseAbi([
      "function paused() view returns (bool)",
      "function owner() view returns (address)",
    ]);

    export async function fetchUsdy(blockNumber?: bigint): Promise<SubjectFacts> {
      // Round 1: ERC-20 surface + paused + owner.
      const round1: Read[] = [
        { address: ADDR, abi: erc20Abi, functionName: "totalSupply", label: "USDY totalSupply" },
        { address: ADDR, abi: erc20Abi, functionName: "decimals",    label: "USDY decimals" },
        { address: ADDR, abi: erc20Abi, functionName: "symbol",      label: "USDY symbol" },
        { address: ADDR, abi: USDY_EXTRA_ABI, functionName: "paused", label: "USDY paused()" },
        { address: ADDR, abi: USDY_EXTRA_ABI, functionName: "owner",  label: "USDY owner()" },
      ];
      const r1 = await multiread(round1, blockNumber);

      const ingestBlock = blockNumber !== undefined ? Number(blockNumber) : 0;
      const onchainFact = (label: string, value: string | null, fn: string, evidence: string): Fact => ({
        label, value, evidence,
        source: { kind: "onchain", address: ADDR, function: fn, blockNumber: ingestBlock },
      });

      const collateral: Fact[] = [
        staticFact({ label: "issuer + collateral", value: STATIC.USDY.collateral, evidence: "USDY is issued by Ondo Finance against short-term US Treasuries and bank deposits." }),
        staticFact({ label: "reserve attestation", value: STATIC.USDY.reserveAttestation, evidence: "Reserves are attested monthly by the custodian." }),
        staticFact({ label: "custodian", value: STATIC.USDY.custodian, evidence: "Custody is held by Ankura Trust." }),
        staticFact({ label: "audits", value: STATIC.USDY.audit.join(", "), evidence: "Recent audits include " + STATIC.USDY.audit.join(", ") + "." }),
      ];

      const contract: Fact[] = [
        onchainFact("totalSupply (raw)", r1[0].ok ? String(r1[0].value) : null, "totalSupply()", "ERC-20 totalSupply observed on Mantle."),
        onchainFact("decimals", r1[1].ok ? String(r1[1].value) : null, "decimals()", "ERC-20 decimals reported by the contract."),
        onchainFact("paused", r1[3].ok ? String(r1[3].value) : null, "paused()", "Contract pause flag (true if paused)."),
        onchainFact("owner", r1[4].ok ? String(r1[4].value) : null, "owner()", "Contract owner / admin address."),
        staticFact({ label: "source verified", value: STATIC.USDY.sourceVerified ? "yes" : "no", evidence: "Verified on Mantlescan; implementation " + STATIC.USDY.implementation + "." }),
        staticFact({ label: "proxy pattern", value: STATIC.USDY.proxyPattern, evidence: "Upgrade pattern declared in static config." }),
      ];

      const oracle: Fact[] = [
        staticFact({ label: "oracle architecture", value: STATIC.USDY.oracleArchitecture, evidence: "USDY uses internal accrual; no external price feed on Mantle." }),
        staticFact({ label: "staleness tolerance", value: STATIC.USDY.stalenessTolerance, evidence: "Staleness tolerance per static config." }),
      ];

      const liquidity: Fact[] = [
        staticFact({ label: "mantle TVL (USD)", value: String(STATIC.USDY.mantleTVL_USD), evidence: "Approximate Mantle-side TVL recorded in static config." }),
        staticFact({ label: "parent TVL (USD)", value: String(STATIC.USDY.parentTVL_USD), evidence: "Parent supply across all chains per static config." }),
        // If totalSupply is readable, attach it as an on-chain liquidity fact for citation.
        onchainFact(
          "USDY totalSupply * accrued",
          r1[0].ok && r1[1].ok ? String(r1[0].value) + " (raw, decimals=" + String(r1[1].value) + ")" : null,
          "totalSupply()",
          "On-chain raw totalSupply observed at the pinned block."
        ),
      ];

      return {
        subject: { name: STATIC.USDY.name, ticker: "USDY", address: ADDR, chainId: 5000 },
        ingestBlock,
        collateral, contract, oracle, liquidity,
      };
    }
    ```

    Create `agent/src/subjects/cmeth.ts` (RESEARCH §3.2) following the same template but with `erc20Abi` reads + the parent ETH-price multiplier (use `priceAtBlock(ingestBlock).ETH_USD` for the liquidity TVL fact). Implementation address `0x5A7b3CDe8ac8d780af4797bf1517464ac54ca033`.

    Create `agent/src/subjects/fbtc.ts` (RESEARCH §3.3) following the same template but with `decimals = 8` semantics, blocked-address probe deferred (omit; not on-chain readable on the FBTC proxy without explicit getter — falls into static), and BTC USD price from `priceAtBlock(ingestBlock).BTC_USD`.

    Create `agent/src/subjects/registry.ts`:
    ```ts
    import type { SubjectId, SubjectFacts } from "./types";
    import { fetchUsdy } from "./usdy";
    import { fetchCmeth } from "./cmeth";
    import { fetchFbtc } from "./fbtc";

    export const ADAPTERS: Record<SubjectId, (block?: bigint) => Promise<SubjectFacts>> = {
      USDY: fetchUsdy,
      cmETH: fetchCmeth,
      FBTC: fetchFbtc,
    };

    export function getAdapter(id: SubjectId) {
      const a = ADAPTERS[id];
      if (!a) throw new Error("Unknown subject id: " + String(id));
      return a;
    }
    ```

    Create per-adapter tests `agent/tests/subjects/usdy.test.ts` (and cmeth.test.ts, fbtc.test.ts) using `vi.mock("../../src/multicall", ...)` to inject the fixture return. Each test file asserts behaviors 1-6 in the `<behavior>` section above. Example:
    ```ts
    import { describe, it, expect, vi, beforeEach } from "vitest";
    import { usdyMulticallSuccess, usdyMulticallAllFail } from "../fixtures/usdy.fixture";

    vi.mock("../../src/multicall", () => ({
      multiread: vi.fn(),
    }));
    import { multiread } from "../../src/multicall";
    import { fetchUsdy } from "../../src/subjects/usdy";

    describe("[2-02-02 USDY] adapter", () => {
      beforeEach(() => { vi.mocked(multiread).mockReset(); });

      it("returns SubjectFacts with subject.chainId == 5000 and locked address", async () => {
        vi.mocked(multiread).mockResolvedValue(usdyMulticallSuccess);
        const facts = await fetchUsdy(75_000_000n);
        expect(facts.subject.chainId).toBe(5000);
        expect(facts.subject.address).toBe("0x5be26527e817998A7206475496fDE1E68957c5A6");
        expect(facts.subject.ticker).toBe("USDY");
      });

      it("threads blockNumber through every onchain Fact", async () => {
        vi.mocked(multiread).mockResolvedValue(usdyMulticallSuccess);
        const facts = await fetchUsdy(75_000_000n);
        const allOnchain = [...facts.collateral, ...facts.contract, ...facts.oracle, ...facts.liquidity]
          .filter(f => f.source.kind === "onchain");
        expect(allOnchain.length).toBeGreaterThan(0);
        for (const f of allOnchain) {
          expect((f.source as any).blockNumber).toBe(75_000_000);
        }
      });

      it("emits null value (missing fact) when multicall returns all failures", async () => {
        vi.mocked(multiread).mockResolvedValue(usdyMulticallAllFail);
        const facts = await fetchUsdy(75_000_000n);
        const allOnchain = [...facts.collateral, ...facts.contract, ...facts.oracle, ...facts.liquidity]
          .filter(f => f.source.kind === "onchain");
        expect(allOnchain.length).toBeGreaterThan(0);
        for (const f of allOnchain) expect(f.value).toBeNull();
      });

      it("populates static facts in collateral and oracle buckets", async () => {
        vi.mocked(multiread).mockResolvedValue(usdyMulticallSuccess);
        const facts = await fetchUsdy(75_000_000n);
        const staticCollateral = facts.collateral.filter(f => f.source.kind === "static");
        const staticOracle = facts.oracle.filter(f => f.source.kind === "static");
        expect(staticCollateral.length).toBeGreaterThanOrEqual(2);
        expect(staticOracle.length).toBeGreaterThanOrEqual(1);
        for (const f of [...staticCollateral, ...staticOracle]) {
          expect((f.source as any).version).toBe("1.0.0");
        }
      });

      it("multiread is called with the supplied blockNumber", async () => {
        vi.mocked(multiread).mockResolvedValue(usdyMulticallSuccess);
        await fetchUsdy(75_000_000n);
        const callArgs = vi.mocked(multiread).mock.calls[0];
        expect(callArgs[1]).toBe(75_000_000n);
      });
    });
    ```

    Create `agent/tests/subjects/no-latest-leak.test.ts` (PATTERNS Block-pinning thread-through tripwire — RESEARCH §10 row):
    ```ts
    import { describe, it, expect } from "vitest";
    import { readFileSync } from "node:fs";
    import { resolve } from "node:path";

    const ADAPTER_FILES = ["usdy.ts", "cmeth.ts", "fbtc.ts"];

    describe("[2-02-02 no-latest-leak] block-pinning thread-through", () => {
      for (const f of ADAPTER_FILES) {
        it(`${f} threads blockNumber to every multiread call`, () => {
          const text = readFileSync(resolve(__dirname, "../../src/subjects/", f), "utf8");
          // Strip comments to avoid false positives from prose explaining the rule.
          const code = text.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
          const lines = code.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes("multiread(")) {
              // Look at this line + next 3 for a blockNumber reference.
              const window = lines.slice(i, Math.min(i + 4, lines.length)).join("\n");
              expect(window).toMatch(/blockNumber/);
            }
          }
        });

        it(`${f} contains no direct publicClient.multicall or publicClient.readContract calls`, () => {
          const text = readFileSync(resolve(__dirname, "../../src/subjects/", f), "utf8");
          // Adapters MUST go through the multiread helper, which always passes blockNumber.
          expect(text).not.toMatch(/publicClient\.multicall/);
          expect(text).not.toMatch(/publicClient\.readContract/);
        });
      }
    });
    ```

    Update `agent/src/index.ts` to re-export `ADAPTERS`, `getAdapter`, `STATIC`, `STATIC_VERSION`.
  </action>
  <verify>
    <automated>cd agent && pnpm test -- tests/subjects/usdy.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `test -f agent/src/subjects/usdy.ts` returns 0
    - `test -f agent/tests/subjects/usdy.test.ts` returns 0
    - `test -f agent/tests/fixtures/usdy.fixture.ts` returns 0
    - `grep -c 'export async function fetchUsdy' agent/src/subjects/usdy.ts` returns 1
    - `grep -c 'blockNumber' agent/src/subjects/usdy.ts` returns >= 3 (param + multiread arg + onchainFact.blockNumber)
    - `grep -cE 'publicClient\.(multicall|readContract)' agent/src/subjects/usdy.ts` returns 0 (must go through multiread)
    - `cd agent && pnpm test -- tests/subjects/usdy.test.ts` exits 0
    - `cd agent && pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>USDY adapter calls multiread with blockNumber threaded; never calls publicClient.multicall directly; missing reads surface as Fact{value: null}; static facts cite STATIC_VERSION. cmETH/FBTC adapters and registry land in Task 2-02-03.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2-02-03: cmETH + FBTC adapters + dispatch registry + no-latest-leak tripwire (W3 split sibling of 2-02-02)</name>
  <files>agent/src/subjects/cmeth.ts, agent/src/subjects/fbtc.ts, agent/src/subjects/registry.ts, agent/tests/subjects/cmeth.test.ts, agent/tests/subjects/fbtc.test.ts, agent/tests/subjects/no-latest-leak.test.ts, agent/tests/fixtures/cmeth.fixture.ts, agent/tests/fixtures/fbtc.fixture.ts</files>
  <read_first>
    - .planning/phases/02-rating-engine-core/02-RESEARCH.md (§3.2 cmETH reads, §3.3 FBTC reads, §3.4 SubjectFacts shape; §10 threat-model row "Replay-at-block reads inconsistent if `latest` snuck in")
    - .planning/phases/02-rating-engine-core/02-PATTERNS.md (Block-pinning thread-through, Static-fact citation source convention)
    - .planning/phases/02-rating-engine-core/02-CONTEXT.md (D-01 per-subject layout, D-04 block pinning, D-07 missing-fact handling)
    - agent/src/subjects/usdy.ts (created in 2-02-02 — use as the template; cmETH and FBTC mirror its structure)
    - agent/src/subjects/types.ts (SubjectFacts shape)
    - agent/src/multicall.ts (multiread signature)
    - agent/src/subjects/static.ts (STATIC, staticFact)
    - agent/src/constants/prices.ts (priceAtBlock)
  </read_first>
  <behavior>
    Same per-subject behaviors as Task 2-02-02 (tests 1-6), applied to cmETH and FBTC, plus:
    - Test 7 (no-latest-leak tripwire): for each of `usdy.ts`, `cmeth.ts`, `fbtc.ts`, grep `multiread(` and assert `blockNumber` appears within ~80 chars; assert no `publicClient.multicall` or `publicClient.readContract` direct calls.
    - Test 8 (registry): `ADAPTERS.USDY === fetchUsdy`, `ADAPTERS.cmETH === fetchCmeth`, `ADAPTERS.FBTC === fetchFbtc`.
    - Test 9 (registry): `getAdapter("USDY")` returns `fetchUsdy`.
  </behavior>
  <action>
    Follow the USDY template from Task 2-02-02 verbatim, swapping STATIC entries, decimals, and price feed multipliers per RESEARCH §3.2 (cmETH: 18 decimals, ETH price multiplier, implementation `0x5A7b3CDe8ac8d780af4797bf1517464ac54ca033`) and §3.3 (FBTC: 8 decimals, BTC price multiplier, no on-chain implementation getter — falls into static).

    Create `agent/src/subjects/cmeth.ts` and `agent/src/subjects/fbtc.ts` (full code per Task 2-02-02 action block — kept here only as a structural reference; the executor should literally copy the USDY shape).

    Create `agent/src/subjects/registry.ts`:
    ```ts
    import type { SubjectId, SubjectFacts } from "./types";
    import { fetchUsdy } from "./usdy";
    import { fetchCmeth } from "./cmeth";
    import { fetchFbtc } from "./fbtc";

    export const ADAPTERS: Record<SubjectId, (block?: bigint) => Promise<SubjectFacts>> = {
      USDY: fetchUsdy,
      cmETH: fetchCmeth,
      FBTC: fetchFbtc,
    };

    export function getAdapter(id: SubjectId) {
      const a = ADAPTERS[id];
      if (!a) throw new Error("Unknown subject id: " + String(id));
      return a;
    }
    ```

    Create per-adapter tests `agent/tests/subjects/cmeth.test.ts` and `agent/tests/subjects/fbtc.test.ts` mirroring `usdy.test.ts` (created in Task 2-02-02), and create matching fixtures `agent/tests/fixtures/cmeth.fixture.ts` and `agent/tests/fixtures/fbtc.fixture.ts` with realistic success and all-fail variants.

    Create `agent/tests/subjects/no-latest-leak.test.ts` (Block-pinning thread-through tripwire — RESEARCH §10 row):
    ```ts
    import { describe, it, expect } from "vitest";
    import { readFileSync } from "node:fs";
    import { resolve } from "node:path";

    const ADAPTER_FILES = ["usdy.ts", "cmeth.ts", "fbtc.ts"];

    describe("[2-02-03 no-latest-leak] block-pinning thread-through", () => {
      for (const f of ADAPTER_FILES) {
        it(`${f} threads blockNumber to every multiread call`, () => {
          const text = readFileSync(resolve(__dirname, "../../src/subjects/", f), "utf8");
          const code = text.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
          const lines = code.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes("multiread(")) {
              const window = lines.slice(i, Math.min(i + 4, lines.length)).join("\n");
              expect(window).toMatch(/blockNumber/);
            }
          }
        });

        it(`${f} contains no direct publicClient.multicall or publicClient.readContract calls`, () => {
          const text = readFileSync(resolve(__dirname, "../../src/subjects/", f), "utf8");
          expect(text).not.toMatch(/publicClient\.multicall/);
          expect(text).not.toMatch(/publicClient\.readContract/);
        });
      }
    });
    ```

    Update `agent/src/index.ts` to re-export `ADAPTERS`, `getAdapter`, `STATIC`, `STATIC_VERSION`.
  </action>
  <verify>
    <automated>cd agent && pnpm test -- tests/subjects/</automated>
  </verify>
  <acceptance_criteria>
    - `test -f agent/src/subjects/cmeth.ts` returns 0
    - `test -f agent/src/subjects/fbtc.ts` returns 0
    - `test -f agent/src/subjects/registry.ts` returns 0
    - `test -f agent/tests/subjects/no-latest-leak.test.ts` returns 0
    - `grep -c 'export async function fetchCmeth' agent/src/subjects/cmeth.ts` returns 1
    - `grep -c 'export async function fetchFbtc' agent/src/subjects/fbtc.ts` returns 1
    - `grep -c 'blockNumber' agent/src/subjects/cmeth.ts` returns >= 3
    - `grep -c 'blockNumber' agent/src/subjects/fbtc.ts` returns >= 3
    - `grep -cE 'publicClient\.(multicall|readContract)' agent/src/subjects/cmeth.ts` returns 0
    - `grep -cE 'publicClient\.(multicall|readContract)' agent/src/subjects/fbtc.ts` returns 0
    - `cd agent && pnpm test -- tests/subjects/` exits 0 (all 5 subject test files green)
    - `cd agent && pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>cmETH + FBTC adapters call multiread with blockNumber threaded; never call publicClient.multicall directly; missing reads surface as Fact{value: null}; static facts cite STATIC_VERSION; dispatch registry maps SubjectId -> adapter; no-latest-leak grep tripwire green for all 3 adapters.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Mantle Mainnet RPC → engine | RPC URL may contain API key; error messages must be scrubbed before logging or serialization |
| static facts file → engine | static.ts is in-repo, code-reviewed — lower risk, but values still feed the Claude prompt |
| on-chain string returns (`symbol()`, `name()`) → engine → prompt | Untrusted; prompt injection vector |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-2-03 | Information Disclosure | `agent/src/rpc.ts` (RPC URL leakage) | mitigate | `redactRpcUrl(message)` helper in rpc.ts; Task 2-02-01 test asserts URL is replaced by `[redacted]` in error message paths. Adapters that catch RPC errors MUST run them through `redactRpcUrl` before re-throwing or logging. |
| T-2-04 | Tampering (missing-fact silent fall-through) | adapter `Fact.value` for failed reads | mitigate (this wave: surface) | When multicall returns `{ok: false}`, adapter writes `value: null` (NOT a fabricated value or hidden 0). Downstream dimension scorer (Wave 2) reads `value == null` and applies the D-07 default-to-50 + confidence-drop policy. Test 4 in Task 2-02-02 enforces null surfacing. |
| T-2-07 | Input validation (CLI rejects arbitrary subject ids) | `agent/src/subjects/registry.ts:getAdapter()` | mitigate | `getAdapter(id)` throws on unknown SubjectId. Wave 4 CLI uses `getAdapter` and surfaces the throw. SubjectId is a literal union — TypeScript enforces at compile time too. |
</threat_model>

<verification>
- `cd agent && pnpm test -- tests/subjects/` exits 0 (all 5 test files green)
- `cd agent && pnpm typecheck` exits 0
- no-latest-leak grep test green for all 3 adapters
- All locked addresses present in static.ts (USDY, cmETH, FBTC)
- STATIC_VERSION === "1.0.0" — citation reproducibility guaranteed
</verification>

<success_criteria>
- 3 adapters callable as `fetchUsdy(block?)`, `fetchCmeth(block?)`, `fetchFbtc(block?)` returning typed SubjectFacts
- Dispatch registry returns the right adapter for each SubjectId
- Block-pinning threading enforced by grep tripwire
- Missing-fact handling surfaced as `value: null` at the adapter boundary; dimension defaults to 50 happen in Wave 2 (separation of concerns)
- RPC URL redaction proven (T-2-03)
- Per-task atomic commits
</success_criteria>

<output>
After completion, create `.planning/phases/02-rating-engine-core/02-02-SUMMARY.md` documenting:
- Files created
- Multicall round-trip count per subject (target ≤3 per D-03)
- Any RPC reads that fell back to static (USDY oraclePrice() per RESEARCH A5; cmETH ETH price feed per A6; FBTC PoR per A7 — document actual on-chain availability after first live test)
- Static facts confirmed accurate at planning time
- Test results
</output>
