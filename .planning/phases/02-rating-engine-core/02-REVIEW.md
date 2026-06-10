---
phase: 02-rating-engine-core
reviewed: 2026-06-10T00:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - agent/src/claude/mock.ts
  - agent/src/claude/prompt.ts
  - agent/src/claude/synthesize.ts
  - agent/src/claude/tool-schema.ts
  - agent/src/cli.ts
  - agent/src/constants/grade-enum.ts
  - agent/src/constants/prices.ts
  - agent/src/dimensions/collateral-quality.ts
  - agent/src/dimensions/contract-risk.ts
  - agent/src/dimensions/liquidity-stability.ts
  - agent/src/dimensions/oracle-integrity.ts
  - agent/src/dimensions/synthesize.ts
  - agent/src/dimensions/types.ts
  - agent/src/hash.ts
  - agent/src/index.ts
  - agent/src/multicall.ts
  - agent/src/rate.ts
  - agent/src/rpc.ts
  - agent/src/schema.ts
  - agent/src/subjects/cmeth.ts
  - agent/src/subjects/fbtc.ts
  - agent/src/subjects/registry.ts
  - agent/src/subjects/static.ts
  - agent/src/subjects/types.ts
  - agent/src/subjects/usdy.ts
findings:
  critical: 4
  warning: 6
  info: 4
  total: 14
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-06-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Phase 2 is the rating engine: it ingests on-chain RWA facts, scores four deterministic dimensions, calls Claude (forced `submit_rating` tool-use) for narrative synthesis, and emits an RFC 8785 (JCS) + keccak256 reasoning hash that Phase 3 (publisher) and Phase 4 (verifier) will consume byte-for-byte.

The hashing primitive (`hash.ts`), the schema bound enforcement (`schema.ts`, `dimensions/synthesize.ts`), the forced-tool-use call shape (`synthesize.ts`), and the prompt-injection sanitization (`prompt.ts`) are all solid and match the stated design. The Anthropic-key redaction path is correct.

However, the review surfaced **four BLOCKER-class defects** that undermine the central cross-phase contract — hash determinism and faithful provenance:

1. **Per-dimension numeric fields are LLM-controlled and never engine-overridden** (`synthesize.ts` + `rate.ts`). The design (PLAN 02-04 line 913) states "Claude controls narrative only," yet `dimensions[].score` and `dimensions[].band_hit` flow into the hashed document verbatim from Claude. Two live runs over identical chain state can therefore yield different hashes.
2. **Live default-block path records `ingest_block: 0` while reading `latest`** (`subjects/*.ts` + `rate.ts`). This is a `latest` leak (violates D-04), poisons provenance, and makes Phase 4 replay impossible for any document rated without `--block`.
3. **RPC URL (API key) is never redacted on the live error path** (`rpc.ts` + `cli.ts` + `multicall.ts`). `redactRpcUrl()` exists and is unit-tested but is wired into zero production call sites; a live RPC failure prints the keyed URL to stderr (T-2-03 unmitigated).
4. **`getBlockTimestampSeconds(undefined, false)` reads `latest` block timestamp** independently of the read block, compounding (1) and (2) as a second non-determinism source.

WARNING-class issues include a dead/misleading `--out <path>` CLI flag, an uncaught-throw path for malformed `--block`, and several float/typing gaps in the schema.

## Critical Issues

### CR-01: Per-dimension numeric fields (`score`, `band_hit`) are Claude-controlled and feed the hash without engine override

**File:** `agent/src/claude/synthesize.ts:185-192`, `agent/src/rate.ts:230-267`
**Issue:**
The engine overrides exactly five fields after zod parse — `grade`, `confidence`, `generated_at`, `claude_model`, `ingest_block`. The entire `dimensions[]` array (each `score`, `band_hit.{max,score,label}`, `rationale`, `missing_facts`, `citations`) is whatever Claude returned and is copied verbatim via `...parsed` into the document that gets hashed.

The header comment on `synthesize.ts:11` claims "Claude controls NARRATIVE only — the numbers are not negotiable," and PLAN `02-04-claude-hash-PLAN.md:913` states the engine overrides the deterministic numeric fields "so Claude controls narrative only." `dimensions[].score` and `band_hit` are numbers, not narrative, and they are **not** overridden. `rate.ts` computes the authoritative `BandResult`s (`collateral`, `contract`, `oracle`, `liquidity`) and feeds them into the *prompt* only — it never writes them back into `doc.dimensions`.

Consequences:
- **Hash non-determinism (T-2-06 violation):** Claude can return `score: 70` on one run and `score: 71` on the next for the same facts; both pass schema validation (`int 0..100`) and produce *different* reasoning hashes. The `--mock` golden tests never catch this because the mock hard-codes `score: 70`. Determinism is only verified under the mock, not against live model variance.
- **Deterministic-vs-LLM seam breach (CON-deterministic-vs-llm-separation):** the per-dimension numbers in the published document are LLM output, not the engine's banded scores. A judge/verifier inspecting `dimensions[i].score` is reading a Claude-authored number, not the deterministic one.

**Fix:** Override the per-dimension numeric fields from the engine's `BandResult`s, the same way `grade`/`confidence` are overridden. Pass the four `BandResult`s into `synthesizeRating` and reconcile by `key`:
```ts
// in synthesizeRating, after parse, before final parse:
const bandByKey: Record<string, BandResult> = {
  collateral_quality: input.scores.collateral,
  contract_risk: input.scores.contract,
  oracle_integrity: input.scores.oracle,
  liquidity_stability: input.scores.liquidity,
};
const dimensions = parsed.dimensions.map((d) => {
  const b = bandByKey[d.key];
  return {
    ...d, // keep Claude's narrative + citations
    score: b.score,
    band_hit: { max: b.max, score: b.score, label: b.label },
    missing_facts: b.missing_facts,
  };
});
const overridden: ReasoningDocument = {
  ...parsed, dimensions, grade: input.preComputedGrade,
  confidence: input.preComputedConfidence, generated_at,
  claude_model: MODEL, ingest_block: input.subject.ingestBlock,
};
```
Then assert the four expected keys are all present (reject if Claude dropped/duplicated a dimension key).

### CR-02: Live default-block path stamps `ingest_block: 0` while actually reading `latest` — provenance corruption + `latest` leak (D-04 violation)

**File:** `agent/src/subjects/usdy.ts:62`, `agent/src/subjects/cmeth.ts:59`, `agent/src/subjects/fbtc.ts:62`, `agent/src/rate.ts:227`
**Issue:**
Each adapter computes `const ingestBlock = blockNumber !== undefined ? Number(blockNumber) : 0;`. When the CLI is run live **without** `--block`, `rate()` calls `adapter(undefined)` → `multiread(round1, undefined)`, and viem's `multicall` with `blockNumber: undefined` reads the **chain head (`latest`)**. But `ingestBlock` is set to the literal `0`.

The document therefore claims `ingest_block: 0` while the on-chain reads, `Fact.source.blockNumber: 0`, the citation `block_number: 0`, and `priceAtBlock(0)` all describe block 0 even though the data came from `latest`. This:
- **Leaks `latest`** into the production pipeline — exactly the threat the `no-latest-leak` tripwire was meant to prevent. That tripwire only greps adapter *source text* for the token `blockNumber` near `multiread(`; it never exercises the runtime default path, so the bug is invisible to the test suite.
- **Breaks Phase 4 replay:** a verifier given `ingest_block: 0` would read genesis-era state, never reproducing the live hash. The on-chain hash and the off-chain document become permanently irreconcilable.
- **Two consecutive live default-block runs are non-deterministic** (different `latest`, same recorded `ingest_block: 0`) — a T-2-06 failure on the default invocation.

**Fix:** Resolve the concrete block number *before* any read and thread it everywhere. In `rate()`:
```ts
const resolvedBlock = opts.blockNumber ?? (opts.mock
  ? MOCK_BLOCK
  : await publicClient.getBlockNumber());
const facts = await adapter(resolvedBlock); // adapter now always receives a concrete bigint
```
and make the adapter signature require a concrete block (or fall back to the resolved value, never `0`). Then `getBlockTimestampSeconds` should fetch that same pinned block (see CR-04).

### CR-03: RPC URL (potential API key) is never redacted on the live error path — T-2-03 unmitigated

**File:** `agent/src/rpc.ts:30-33`, `agent/src/cli.ts:95-99`, `agent/src/multicall.ts:45-64`
**Issue:**
`redactRpcUrl()` is defined and unit-tested (`tests/subjects/static.test.ts`), and `rpc.ts:9-10` instructs "Adapters that catch RPC errors MUST run them through `redactRpcUrl` before re-throwing or logging." But `redactRpcUrl` is called by **zero** production call sites (grep confirms only the definition and the test import). The only `catch` in `src/` is `cli.ts:95`, which writes `e.message` straight to stderr:
```ts
const msg = e instanceof Error ? e.message : String(e);
process.stderr.write("ERROR: " + msg + "\n");
```
The CLI comment (`cli.ts:20-21`) claims "synthesize.ts has already scrubbed ANTHROPIC_API_KEY" — true, but that scrubs only the *Anthropic* key. A failure originating from `multiread`/`getBlock` (live mode: bad block, RPC timeout, node error) carries the **`MANTLE_RPC_URL`** — which the file's own docs note "may contain an Alchemy/Infura API key" — and viem error messages routinely embed the transport URL. That raw, keyed URL reaches stderr un-redacted. T-2-03 is documented-but-not-enforced.

**Fix:** Route the CLI catch (and any future logging) through `redactRpcUrl` and the Anthropic scrubber. Minimum:
```ts
import { redactRpcUrl } from "./rpc.js";
// ...
const raw = e instanceof Error ? e.message : String(e);
const msg = redactRpcUrl(raw);
process.stderr.write("ERROR: " + msg + "\n");
```
Better: wrap the live RPC calls in `multicall.ts`/`rate.ts` so the redaction happens at the boundary that owns the URL, not only at the CLI.

### CR-04: Block-timestamp fetch reads `latest` independently of the read block (second determinism leak)

**File:** `agent/src/rate.ts:133-142`
**Issue:**
```ts
if (mock) return 1_717_804_800;
const block = await publicClient.getBlock(
  blockNumber !== undefined ? { blockNumber } : {},
);
return Number(block.timestamp);
```
In live mode with no `--block`, `getBlock({})` returns the **`latest`** block, whose timestamp drives `generated_at`. Combined with CR-02, the document's `generated_at` is derived from one `latest` snapshot while the facts came from a *different* `latest` snapshot (the two RPC calls race the chain head), and `ingest_block` claims `0`. Even with `--block` supplied this is correct, but the default path is non-deterministic and internally inconsistent. This is the timestamp half of the CR-02 `latest` leak.

**Fix:** Take the resolved pinned block from CR-02 and pass it here unconditionally, so the timestamp comes from the *same* block the reads were pinned to:
```ts
async function getBlockTimestampSeconds(blockNumber: bigint, mock: boolean) {
  if (mock) return 1_717_804_800;
  const block = await publicClient.getBlock({ blockNumber });
  return Number(block.timestamp);
}
```

## Warnings

### WR-01: `--out <path>` flag is dead/misleading — a path argument is silently ignored

**File:** `agent/src/cli.ts:83-94`
**Issue:** The usage string advertises `--out -|<path>`. The parser captures `args.out` as the path, but `main()` only special-cases `args.out === "-"` (stdout). For any other value, `writeToFs = args.out !== "-"` is `true` and `rate()` is called **without** `outDir`, so the file always lands at `agent/out/<SUBJECT>/<block>.json` — the user-supplied path is discarded. `--out /tmp/foo.json` behaves identically to no flag, silently writing somewhere else. Misleading interface; a user relying on the documented path redirection gets wrong behavior with no error.
**Fix:** Either honor the path (`outDir: args.out !== "-" ? dirname(resolve(args.out)) : undefined`, and respect the exact filename), or restrict the flag to `--out -` only and update the usage string + help to remove the `<path>` form.

### WR-02: Malformed `--block` throws outside the try/catch — ugly uncaught error, no `ERROR:` prefix

**File:** `agent/src/cli.ts:59-62, 68-69`
**Issue:** `parseArgs` runs `BigInt(flags["block"])` and is called at `main()`'s first line, *before* the `try`. `BigInt("abc")` throws `SyntaxError: Cannot convert abc to a BigInt` synchronously, escaping the error handling that adds the `ERROR:` prefix and clean exit. The user gets a raw V8 stack trace instead of a friendly message. Negative or non-integer blocks (`--block -1`, `--block 1.5`) likewise throw raw.
**Fix:** Validate the block flag inside `main()`'s try, or wrap the conversion:
```ts
let block: bigint | undefined;
try { block = flags.block ? BigInt(String(flags.block)) : undefined; }
catch { process.stderr.write("ERROR: --block must be a non-negative integer\n"); process.exit(2); }
```

### WR-03: Citation `block_number` is never validated against the ingest block — fabricated provenance passes

**File:** `agent/src/rate.ts:88-126`, `agent/src/schema.ts:30`
**Issue:** `validateCitations` checks only `source.address`. The schema constrains `block_number` to `int >= 0` but nothing ties it to the document's `ingest_block`. In live mode Claude fills `block_number` freely; it can emit any block (or `0`) for an on-chain citation and the pipeline accepts it. The T-2-07 "no fabrication" guarantee covers the address but not the block — a citation can claim data from a block that was never read.
**Fix:** Extend `validateCitations` (or add an engine override) so that on-chain citations carry `block_number === doc.ingest_block`, and `static_config` citations carry the documented sentinel (e.g. `0`). Reject otherwise. Given CR-01's fix overrides `band_hit`, also override citation `block_number` for on-chain sources rather than trusting Claude.

### WR-04: `band_hit.max` accepts arbitrary floats — schema gap vs. integer band data

**File:** `agent/src/schema.ts:43-47`
**Issue:** `band_hit.max` is `z.number().nullable()` (not `.int()`), while every real band `max` is an integer or `null`. If Claude returns a fractional `max` (e.g. `70.5`), it passes validation and is canonicalized via shortest IEEE-754. It is per-value deterministic but semantically wrong (a non-integer band boundary) and an avoidable surface for hash surprises. Once CR-01 overrides `band_hit` from the engine `BandResult` this is moot for the value, but the schema should still reflect the contract.
**Fix:** `max: z.number().int().nullable()` (band boundaries are integers), and keep `score` as `.int()`.

### WR-05: `confidence`/`grade` overrides happen but Claude's narrative may contradict the overridden numbers

**File:** `agent/src/claude/synthesize.ts:185-192`
**Issue:** The engine overwrites `grade` and `confidence` after the fact, but `overall_rationale` and per-dimension `rationale` (authored by Claude *before* the override, against its own self-chosen grade/confidence) are left untouched. The published document can therefore contain a rationale arguing for, say, "AA / high confidence" while `grade.letter` reads "BBB" and `confidence` reads 45 — an internally inconsistent artifact that a Phase 4 reviewer would flag. Not a hash bug (it is deterministic), but a correctness/credibility defect for a *rating* product.
**Fix:** Either (a) compute grade/confidence deterministically *before* the Claude call and put the final numbers in the prompt so Claude writes consistent prose (the prompt already passes scores but not the final grade/confidence), or (b) document the override prominently so downstream consumers know the prose is advisory. Option (a) is preferred and cheap — pass `preComputedGrade`/`preComputedConfidence` into `buildPromptFromFacts`.

### WR-06: `getBlock` / `getBlockNumber` / Anthropic network calls have no per-call error context — failures surface as opaque viem/SDK strings

**File:** `agent/src/rate.ts:138`, `agent/src/multicall.ts:50`
**Issue:** Live RPC calls (`publicClient.getBlock`, `publicClient.multicall`) and the Anthropic call throw raw library errors with no engine-level context (which subject, which block, which stage). Combined with CR-03 (no redaction), operators get an un-prefixed, un-redacted, context-free error. The `multiread` per-read failures are handled gracefully (allow-failure), but a transport-level throw (timeout, bad block) is uncaught until the CLI layer.
**Fix:** Wrap the live network calls with a try/catch that prepends stage context and runs the message through `redactRpcUrl` before re-throwing, e.g. `throw new Error(redactRpcUrl("getBlock(" + blockNumber + ") failed: " + msg))`.

## Info

### IN-01: `redactRpcUrl` empty-URL guard is partly redundant but `__test` export leaks internals

**File:** `agent/src/rpc.ts:30-36`
**Issue:** `MANTLE_RPC_URL` always has a value (the `?? "https://rpc.mantle.xyz"` default), so the `!MANTLE_RPC_URL` branch in `redactRpcUrl` is dead. The `__test` export ships the resolved URL on the module's public surface; harmless here (it is the public default unless overridden), but it is a production export existing only for tests.
**Fix:** Keep the guard (defensive), but consider gating `__test` behind a build flag or moving the URL constant to a test-importable internal. Low priority.

### IN-02: `oracleIndex` staleness regex matches `monthly`/`daily` as a positive even for FBTC "monthly" attestation

**File:** `agent/src/dimensions/oracle-integrity.ts:74`
**Issue:** The comment (line 47) says `+20 if staleness ... "<= 24h" pattern OR "monthly"`, and the regex `\b(24h|12h|6h|1h|monthly|hourly|daily)\b` also matches `daily`/`hourly`, which are not in the documented recipe. The behavior is deterministic and arguably fine, but the regex and the documented recipe have drifted. A future reader auditing "every point traces to a documented rule" will find an undocumented `daily`/`hourly` credit.
**Fix:** Align the regex with the documented set, or update the comment to list every accepted token. Cosmetic / auditability.

### IN-03: `priceAtBlock` linear scan relies on PRICES being pre-sorted but never asserts it

**File:** `agent/src/constants/prices.ts:24-30`
**Issue:** `priceAtBlock` picks "the highest entry whose recordedAtBlock <= block" by iterating and overwriting `chosen` on every match. This is only correct if `PRICES` is sorted ascending by `recordedAtBlock` (the comment says "Ordered from oldest to newest"). With a single entry today it is trivially fine, but Phase 3 historical replay will add block-range entries; an out-of-order insert would silently pick the wrong price. No invariant guards the ordering.
**Fix:** Either pick by `Math.max` over eligible entries regardless of array order, or add a module-load assertion that `PRICES` is monotonically non-decreasing in `recordedAtBlock`.

### IN-04: `tool-schema.ts` double `as unknown` casts hide a real zod-v3/v4 + zod-to-json-schema version mismatch

**File:** `agent/src/claude/tool-schema.ts:34-38`
**Issue:** `zodToJsonSchema(ReasoningDoc as unknown as ...)` and `as unknown as Record<string, unknown>` suppress type errors arising because the schema is zod v4 while `zod-to-json-schema` targets v3. The cast is documented as "structurally compatible," but a v4 feature that v3's JSON-Schema emitter mishandles (e.g. how `z.literal`, `z.enum`, or `.length(4)` lower) could silently emit a JSON Schema that diverges from the runtime zod validator, weakening the `strict: true` tool contract. Not a confirmed bug, but the double-cast removes the compiler's ability to warn.
**Fix:** Add a test that snapshots the emitted `input_schema` and asserts key constraints (e.g. `chain_id` const 5000, `dimensions` minItems/maxItems 4, `grade.uint8` max 9) survive the v3 emitter, so a version drift is caught.

---

_Reviewed: 2026-06-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
