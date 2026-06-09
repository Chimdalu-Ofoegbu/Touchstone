# Phase 2: Rating Engine Core - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

A standalone off-chain TypeScript/Node rating engine that, when invoked locally for any of the 3 locked subjects (USDY, cmETH, FBTC on Mantle Mainnet), ingests on-chain data via viem + Multicall3, scores the subject across 4 deterministic dimensions (collateral quality, contract risk, oracle integrity, liquidity & stability) with documented threshold bands, then calls Claude (Sonnet 4.5) to synthesize a letter grade (AAA–D) + per-dimension cited rationale + overall rationale + confidence. Output is a JSON document conforming to a locked schema, canonically serialized via RFC 8785 (JCS) so its keccak256 hash is reproducible by Phase 3 (publisher) and Phase 4 (verifier).

**This phase delivers ONLY the engine + JSON output.** Phase 3 owns IPFS pinning + on-chain `publishRating` + ERC-8004 enforcement. Phase 4 owns the frontend. The historical-downgrade proof (Elixir deUSD, 2025-11-03) starts in Phase 3 but the engine is designed here to support replay-at-block so the same code path serves both live ratings and historical reconstruction.

**Requirements satisfied:** REQ-01 (Rating Engine Pipeline), REQ-05 (Three Mantle RWA Subjects Rated — engine-side only; on-chain publish lands in Phase 3).

</domain>

<decisions>
## Implementation Decisions

### Data Ingest Strategy
- **D-01 (Ingest shape):** Per-subject adapters. File layout: `agent/src/subjects/usdy.ts`, `agent/src/subjects/cmeth.ts`, `agent/src/subjects/fbtc.ts`. Each exports `fetch(blockNumber?: bigint): Promise<SubjectFacts>` returning a normalized `SubjectFacts` shape (TVL, holders/concentration, oracle config, source-verified status, collateral composition, mint/redeem flow stats relevant per asset class). Dimensions consume `SubjectFacts`; they do NOT call RPCs directly. Per-subject organization is judged easier to inspect, diff, and explain than dimension-first or single-generic alternatives.
- **D-02 (RPC client):** `viem` (NOT ethers v6). TS-first, lighter, tree-shakeable. Use `createPublicClient({ chain: mantle, transport: http("https://rpc.mantle.xyz") })`.
- **D-03 (Batching):** Every adapter MUST batch its reads through Multicall3 at `0xcA11bde05977b3631167028862bE2a173976CA11` (deployed on Mantle Mainnet — same canonical address as Ethereum). viem's `multicall` action wraps this natively. Target: ≤3 multicall round-trips per subject (one per logical read-cluster).
- **D-04 (Block-pinning):** Every adapter accepts an optional `blockNumber?: bigint` parameter. When omitted, uses `latest`. When provided, all viem `readContract`/`multicall` calls pass `blockNumber: blockNumber` so reads are pinned to that historical block. This is a Phase 3 reuse hook — the Elixir deUSD historical-downgrade proof in Phase 3 will reconstruct pre-failure state by passing the block before the 2025-11-03 collapse and running the same engine. Phase 2 verification covers `latest` only; Phase 3 stress-tests the historical path.
- **D-05 (Read source vs publish target):** Engine READS from Mantle Mainnet (chain 5000) because that's where USDY (`0x5be26527e817998A7206475496fDE1E68957c5A6`), cmETH (`0xE6829d9a7ee3040e1276Fa75293Bde931859e8fA`), and FBTC (`0xC96dE26018A54D51c097160568752c4E3BD6C364`) actually live. The Phase 3 publisher writes to Mantle Sepolia (chain 5003, contract at `0x54163E309f7C8108F7110B086F640882a97f3838`) through Day 4, then mainnet on Day 5 per DEC-deployment-target-plan. Phase 2 has no publish target — it only writes JSON to disk/stdout.

### Scoring Rubric Shape
- **D-06 (Scoring style):** Threshold-banded with documented brackets. Each dimension defines its bands explicitly in code as a `Bands` table (e.g., `liquidity: [{ max: 10_000_000, score: 25, label: "very thin" }, { max: 50_000_000, score: 55, ... }, ...]`). Hackathon-judge-friendly — every score traces back to a labeled band. NO continuous formulas, NO hybrid weighting per fact within a band.
- **D-07 (Missing data handling):** When a required fact for a dimension is missing or returns 0/unset:
  1. That dimension's score defaults to neutral **50**.
  2. The engine's overall `confidence` field drops by **5 points per missing fact** (floor at 30).
  3. The list of missing facts is passed to Claude in the prompt so the rationale can hedge honestly ("the oracle config could not be read at this block — the dimension defaults to neutral pending data").
  4. Each dimension reports its missing-facts list in the JSON output (`missing_facts: string[]`).
- **D-08 (Dimension weighting):** **Uniform 25% per dimension** across all 3 subjects when synthesizing the letter grade. Asset-class skew shows up naturally in the underlying scores (FBTC's collateral-quality band reflects its custodian risk regardless of weight). No per-asset weight profiles for v1. Phase 4 renders 4 equal bars without weight visualization. Locked behavior simplifies hash stability.

### Claude Integration Shape
- **D-09 (Call structure):** Single-shot prompt. ONE call to Claude per rating run. The prompt receives:
  - The subject's identity (name, ticker, address, chain).
  - All 4 dimension scores AND the underlying facts each dimension used (so Claude can cite specific values).
  - The list of missing facts (if any).
  - The locked grade encoding (AAA=0..D=9).
  - The locked output schema (via tool-use, see D-10).
  Returns: per-dimension rationale (with citations), overall rationale, synthesized letter grade, confidence. ONE roundtrip, easier to mock in tests, Phase 4 streaming can chunk by `dimensions[i]` section.
- **D-10 (Schema enforcement):** Anthropic **tool-use** with strict JSON schema. Define a `submit_rating` tool whose `input_schema` mirrors the reasoning JSON (see D-12). `tool_choice: {type: "tool", name: "submit_rating"}` forces the call. The validated tool args become the canonical reasoning object. On schema-mismatch (rare but possible), retry once with the validation error in the system prompt; then surface the failure.
- **D-11 (Model):** `claude-opus-4-7`. **[User override 2026-06-09 — was `claude-sonnet-4-5`.]** Strongest reasoning + cited-rationale quality in the Claude 4.x family at lock time; the demo prioritizes rationale depth over per-call latency/cost (3 ratings per demo, ~$0.05–$0.10 per rating ≈ $0.30/run total). Configurable via `CLAUDE_MODEL` env var so a runtime swap to `claude-opus-4-8` (newer Opus), `claude-sonnet-4-6` (cheaper, faster), or back to `claude-sonnet-4-5` is one variable change. The default in code MUST be `claude-opus-4-7`.

### Reasoning JSON Schema + Hash Stability
- **D-12 (Schema):** The locked reasoning JSON shape. Phase 3 hashes this; Phase 4 verifies it. Field names are LOCKED — any change is a breaking change for downstream phases.

```ts
type ReasoningDocument = {
  // Identity
  subject: { name: string; ticker: string; address: `0x${string}`; chain_id: number };
  // Final synthesized grade
  grade: { letter: "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "CCC" | "CC" | "C" | "D"; uint8: number /* 0..9 per GradeEnum */ };
  confidence: number; // 0..100
  // 4 dimension breakdowns
  dimensions: Array<{
    key: "collateral_quality" | "contract_risk" | "oracle_integrity" | "liquidity_stability";
    score: number; // 0..100
    band_hit: { max: number | null; score: number; label: string }; // which band produced the score
    missing_facts: string[]; // empty array if none
    rationale: string; // markdown-ish; inline `[1]`, `[2]` refer into citations[]
    citations: Array<{
      id: number; // matches the `[N]` markers in rationale
      label: string; // human-readable, e.g., "TVL on Mantle"
      value: string; // stringified value as observed
      source: { address: `0x${string}`; function: string; block_number: number };
      evidence: string; // 1-2 sentence quote from the prompt's facts
    }>;
  }>;
  // Cross-dimension narrative (also markdown with [d.N] refs allowed, e.g., `[oracle.1]`)
  overall_rationale: string;
  // Provenance — required so Phase 4 can show this in the verify UI
  generated_at: string; // ISO 8601 UTC
  claude_model: string; // e.g., "claude-opus-4-7"
  ingest_block: number; // the Mantle Mainnet block all RPC reads were pinned to
};
```

- **D-13 (Canonical serialization):** **RFC 8785 JSON Canonicalization Scheme (JCS)** via the `canonicalize` npm package (zero/minimal deps). Algorithm: recursive lexicographic key sort, no whitespace, UTF-8, numbers in shortest IEEE 754 form. Phase 4 frontend MUST run the same `canonicalize()` on the IPFS-fetched JSON before keccak256-ing. NO custom sort-keys, NO `JSON.stringify` shortcuts.
- **D-14 (Hash computation):** `reasoningHash = keccak256(utf8Bytes(canonicalize(reasoningDocument)))` — encoded for on-chain storage as `bytes32`. Use `viem.keccak256` with `toBytes(canonicalString)`. Phase 3 publisher MUST use this exact function; Phase 4 verifier MUST use this exact function.

### Claude's Discretion
The following are NOT user decisions — researcher/planner can choose based on standard practice:
- TypeScript project bootstrap (likely `agent/` directory at repo root, `pnpm` or `npm`, `tsx` for local runs).
- Test framework (`vitest` recommended, but planner can choose).
- viem version pinning (latest stable as of execution).
- Exact `Bands` table thresholds per dimension — research-driven. Document the rationale per band in code comments. Phase 2 researcher should propose initial brackets; planner refines.
- Prompt template wording (subject to CON-llm-prompt-evidence-citation — every claim must cite a specific data point).
- CLI shape (`tsx src/cli.ts rate USDY`, `npm run rate -- --subject USDY --block 12345`, etc.) — pick standard.
- Secrets handling — `.env` with `ANTHROPIC_API_KEY` (don't commit), already-globbed by Phase 1 polish (`.env.*` covered).
- Logging/telemetry verbosity.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — Locked decisions affecting Phase 2: DEC-tech-stack (TS/Node, Claude), DEC-llm-reasoning-claude, DEC-five-deterministic-risk-dimensions (revised to FOUR), DEC-onchain-hash-offchain-reasoning, DEC-subject-set-locked (the 3 addresses), DEC-grade-encoding-uint8, DEC-ipfs-provider-web3storage (Phase 3 owns the pin, but schema must be web3.storage-compatible), DEC-historical-proof-case (Elixir deUSD — informs the block-pinning architecture).
- `.planning/REQUIREMENTS.md` — REQ-01 (Rating Engine Pipeline acceptance criteria) + REQ-05 (Three Mantle RWA Subjects Rated). Constraints: CON-deterministic-vs-llm-separation, CON-llm-prompt-evidence-citation, CON-rating-schema, CON-grade-encoding.
- `.planning/ROADMAP.md` §Phase 2 — 4 success criteria for the engine.
- `.planning/STATE.md` — Current canonical Sepolia address `0x54163E309f7C8108F7110B086F640882a97f3838` (Phase 3 will write to this).

### Phase 1 deliverables (Phase 2 must align with these)
- `src/RatingRegistry.sol` — Final hardened contract surface that Phase 3 will publish to. Note the `Rating` struct shape and `publishRating(address subject, uint8 grade, bytes32 reasoningHash, uint8 confidence)` signature — these are the engine's downstream contract.
- `src/constants/GradeEnum.sol` — Locked uint8 encoding (AAA=0..D=9, MAX=9). Phase 2 MUST mirror this in TS as `agent/src/constants/grade-enum.ts` byte-for-byte.
- `.planning/phases/01-lock-skeleton/01-REVIEW.md` — Carries forward: confidence must be ≤100 (Phase 1 hardened this on-chain via `InvalidConfidence()`; the engine MUST respect the same bound).
- `.planning/phases/01-lock-skeleton/01-03-DEPLOYMENT.md` — Current canonical contract address `0x54163E309f7C8108F7110B086F640882a97f3838`.

### External specs / docs (researcher reads these)
- ERC-8004 Identity Registry on Mantle Mainnet at `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` — NOT directly used in Phase 2 (Phase 3 uses it for identity gate), but the engine's `agent_identity` field in the reasoning JSON should be left forward-compatible (planner: include placeholder or omit until Phase 3).
- Multicall3 canonical deployment address (same on every chain including Mantle): `0xcA11bde05977b3631167028862bE2a173976CA11`. Verify on-chain before relying.
- RFC 8785 — JSON Canonicalization Scheme. Pinned npm package: `canonicalize` (verify latest stable at planning time).
- Anthropic Messages API — tool-use docs (researcher should pull current latest via WebFetch/Context7 to confirm `tool_choice` syntax for forcing tool calls).
- DEC-historical-proof-case: Elixir deUSD analyst article by CBB0FE (2025-10-28), Morpho/Euler lending market addresses with xUSD collateral — full details in `.planning/phases/01-lock-skeleton/RESEARCH.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/constants/GradeEnum.sol`** (locked uint8 mapping) — must be mirrored in TS as `agent/src/constants/grade-enum.ts`. ANY divergence between the Solidity and TS encodings breaks on-chain publish.
- **`src/RatingRegistry.sol`** (deployed, verified, hardened) — the engine's downstream consumer. `confidence` is bounded `≤100` on-chain (will revert `InvalidConfidence()` otherwise) — the engine MUST never emit `confidence > 100`. `grade` is `uint8 0..9` — the engine MUST never emit any other value.
- **Mantle Sepolia deploy `0x54163E309f7C8108F7110B086F640882a97f3838`** — Phase 3 will call `publishRating` on this. Phase 2 does NOT write to it. Phase 2 verification can optionally call `latestRating(subject)` to confirm the empty-state sentinel (`timestamp == 0` per WR-03).
- **`.env` (gitignored, populated)** — already contains `PRIVATE_KEY`, `MANTLE_SEPOLIA_RPC_URL`, `MANTLE_RPC_URL`, `MANTLE_EXPLORER_KEY`. Phase 2 adds `ANTHROPIC_API_KEY` to this file (still gitignored under the `.env.*` glob locked by WR-04).

### Established Patterns
- **Atomic per-task commits** (from Phase 1) — Phase 2 should continue the per-task atomic commit cadence so the executor's progress is inspectable.
- **Code review + verifier post-phase loop** (Phase 1 surfaced 4 hardening fixes pre-Phase-2) — Phase 2 should expect the same gate.
- **Foundry + forge-std** is in `lib/` (no Phase 2 use, but `lib/` is the established submodule location if anything Solidity-adjacent comes up).

### Integration Points
- **Phase 3 will import the engine** — the engine's main entry point should be exported as both a CLI (`tsx src/cli.ts rate USDY`) and a library function (`rate(subject: SubjectId, blockNumber?: bigint): Promise<ReasoningDocument>`) so Phase 3's `RatingRequested` event listener can call it directly without spawning a child process.
- **Phase 4 will verify hash off-chain** — Phase 2 MUST export the `canonicalize` + `keccak256` chain as a single reusable utility so Phase 4's frontend imports the exact same code path. Suggested location: `agent/src/hash.ts` exporting `computeReasoningHash(doc: ReasoningDocument): \`0x${string}\``.
- **No existing TS code in the repo** — Phase 2 introduces the `agent/` directory. Researcher should propose the directory structure as part of RESEARCH.md; planner finalizes.

</code_context>

<specifics>
## Specific Ideas

- **Tool-use forcing pattern (Claude integration):** `messages.create({ tools: [submitRatingTool], tool_choice: { type: "tool", name: "submit_rating" }, ... })`. Anthropic's tool-use API guarantees Claude will call the named tool. The validated args ARE the structured output.
- **Multicall3 wrap pattern:** Use viem's high-level `client.multicall({ contracts: [...] })` action — handles encoding/decoding for you. Each adapter exposes its read list as an array of `{ address, abi, functionName, args }` objects, then runs `client.multicall({ contracts: reads, blockNumber, allowFailure: true })` and inspects per-result `status` to populate `missing_facts`.
- **Bands as data, not code:** Each dimension declares its bands as a top-of-file `BANDS` constant (an array of `{ max, score, label }`), then the scoring function is a 3-line loop: `for (const band of BANDS) if (value < band.max) return band;`. Easy to inspect, easy to diff, easy to test. Phase 4 frontend can import and render the same BANDS to show "you scored in band 'thin liquidity'" in the dimension drill-down.
- **Schema versioning hedge:** Even though we locked plain JCS (no `schema_version` field in the JSON root per the user's choice), planner SHOULD include a `schema_version` field in the JSON anyway as a defensive default since (a) it sits inside the hashed bytes naturally, (b) it costs nothing, (c) Phase 3+ that adds new fields needs a way to declare which version a hash is valid for. If the user objects after seeing PLAN.md, drop it — it's an easy revert.

</specifics>

<deferred>
## Deferred Ideas

- **Per-asset-class dimension weighting** (USDY weights oracle higher, cmETH weights contract risk higher, FBTC weights collateral higher) — user explicitly chose uniform 25% for v1. Could revisit if Phase 4 demo shows the uniform grade misrepresents one of the subjects. Tracked here so a future polish phase can pick it up.
- **Per-dimension parallel Claude calls** — single-shot was chosen. If demo latency on Sonnet 4.5 turns out tight, fall back to parallel per-dim + synthesis. Defer to a Phase 4 contingency.
- **claude-opus-4-7 for rationale depth** — already wired via `CLAUDE_MODEL` env var; not a deferred capability, just a tuning knob.
- **JSON mode (Anthropic `response_format`)** — defer indefinitely; tool-use is the chosen path.
- **Additional dimensions** (governance/custodian, etc.) — v2 backlog per DEC-scope-cut-sequence #3.
- **Live ERC-8004 Reputation Registry accuracy loop** — v2 backlog per DEC-scope-cut-sequence #1.
- **More than 3 subjects** — v2 backlog per DEC-scope-cut-sequence #4.

</deferred>

---

*Phase: 2-rating-engine-core*
*Context gathered: 2026-06-09*
