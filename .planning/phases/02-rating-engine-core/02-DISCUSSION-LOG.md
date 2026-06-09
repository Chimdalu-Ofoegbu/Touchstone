# Phase 2: Rating Engine Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 02-rating-engine-core
**Areas discussed:** Data ingest strategy, Scoring rubric shape, Claude integration shape, Reasoning JSON schema + hash stability

---

## Data Ingest Strategy

### Q1: Engine organization around the 3 subjects (USDY stablecoin, cmETH restaked ETH, FBTC wrapped BTC)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-subject adapters | `agent/src/subjects/{usdy,cmeth,fbtc}.ts` each export `fetch(blockNumber?) → SubjectFacts` returning a normalized shape. Dimensions consume SubjectFacts. Simpler to inspect/diff per subject; trivially supports Phase 3 block-pinned historical replay. | ✓ |
| Dimension-first with subject-aware fetchers | Each of the 4 dimensions owns its own per-subject fetch logic. More orthogonal but spreads each subject's behavior across 4 files — harder to debug. | |
| Single generic ingester with config map | One `ingest.ts` reads a `subjects.config.ts` describing what to fetch per subject. Least code but config object grows into a swamp; per-asset edge cases leak into config. | |

**User's choice:** Per-subject adapters (recommended).
**Notes:** Anchors the file layout and makes Phase 3 historical-replay reuse free (just pass `blockNumber`).

### Q2: RPC client + block-pinning architecture

| Option | Description | Selected |
|--------|-------------|----------|
| viem + multicall + block-pinned by default | Modern TS-first client. Every adapter accepts `blockNumber?: bigint` and batches reads through Multicall3 at `0xcA11bde05977b3631167028862bE2a173976CA11`. Phase 3 replay just passes the pre-Elixir block. | ✓ |
| viem, no multicall, latest block only | Skip multicall and block-pinning for now; refactor in Phase 3. Faster Phase 2 but adds Phase 3 friction. | |
| ethers v6 | More familiar surface if user has written ethers before. Larger bundle; multicall via additional dep. | |

**User's choice:** viem + multicall + block-pinned (recommended).
**Notes:** This is the leverage move — Phase 3 historical proof gets a free path. Mantle Mainnet (chain 5000) is the read source since the locked subjects live there.

---

## Scoring Rubric Shape

### Q1: Per-dimension scoring style — raw facts to 0–100

| Option | Description | Selected |
|--------|-------------|----------|
| Threshold-banded with documented brackets | Each dimension defines explicit bands (e.g., liquidity = `<$10M:25, <$50M:55, <$200M:75, ≥$200M:90`). Hackathon-judge-friendly — rubric inspectable, every score traces to a bracket. Fastest to ship. | ✓ |
| Continuous formula per dimension | Smoother but harder to explain to judges; tuning curves per dimension is extra Day 2 work. | |
| Hybrid — threshold for binary facts, continuous for magnitudes | Most accurate but most code surface in 1 day. | |

**User's choice:** Threshold-banded (recommended).
**Notes:** Demo defensibility weighed heaviest — "we scored X because TVL crossed band Y" is easy to walk a judge through.

### Q2: Missing data handling

| Option | Description | Selected |
|--------|-------------|----------|
| Neutral 50 AND reduce overall confidence | Missing facts contribute neutral 50 to dimension; overall confidence drops per missing fact; Claude told which facts are missing so rationale hedges honestly. | ✓ |
| Penalize — missing fact → lower band | Conservative but punishes legit gaps (e.g., FBTC's off-chain mint flow). | |
| Abstain — emit dimension as `unscored` | Most rigorous but Phase 4 has to render unscored bars (extra UI work). | |

**User's choice:** Neutral 50 + drop confidence (recommended).
**Notes:** Matches the "calm, analyst-like" voice per DEC-aesthetic-direction-editorial. Drop is 5 points per missing fact, confidence floor 30.

### Q3: Dimension weighting per asset class

| Option | Description | Selected |
|--------|-------------|----------|
| Uniform 25% per dimension across all subjects | Simpler, defensible; asset-class skew shows up naturally in the underlying scores. Phase 4 renders 4 equal bars without weight viz. Locks hash stability. | ✓ |
| Per-asset-class weight profiles | USDY weights oracle higher (depeg-driven); cmETH weights contract risk higher; FBTC weights collateral higher. More accurate but adds visualization burden. | |

**User's choice:** Uniform 25% (recommended).
**Notes:** Deferred to v2 backlog. If demo shows uniform misrepresents a subject, revisit in a polish phase.

---

## Claude Integration Shape

### Q1: Claude call structure

| Option | Description | Selected |
|--------|-------------|----------|
| Single-shot with all 4 dimension facts + scores in one prompt | One request returns per-dim rationale, grade, overall, confidence. Globally coherent narrative. Phase 4 streaming chunks by section. Fewest roundtrips. | ✓ |
| Per-dimension call + synthesis (5 total) | 4 dim calls each see only their own facts → tight cited rationale; 5th call synthesizes. Sharper citation discipline but 5x roundtrips. | |
| Parallel per-dim + synthesis | 4 parallel + 1 sequential. Most code complexity for Day 2. | |

**User's choice:** Single-shot (recommended).
**Notes:** Trades sharper per-dim citation discipline for global coherence + simpler streaming.

### Q2: Schema enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Anthropic tool-use with strict JSON schema | Define `submit_rating` tool; Claude forced to call it with conforming args. Server-side validation, retry on mismatch. Most reliable. | ✓ |
| Prompt-only with post-validation | Plain prompt + Zod check + 1 retry. Simpler; less reliable. | |
| JSON mode via `response_format` | Newer; behavior varies per model. Tool-use is the universal path. | |

**User's choice:** Tool-use (recommended).
**Notes:** `tool_choice: {type: "tool", name: "submit_rating"}` forces the call. Validated args = canonical reasoning object.

### Q3: Model tier

| Option | Description | Selected |
|--------|-------------|----------|
| claude-sonnet-4-5 | Best price/quality balance; ~3-5s latency; AI Interaction Design rubric sings on Sonnet 4.5. | ✓ |
| claude-opus-4-7 | Deepest reasoning; ~8-15s latency — risks Phase 4 streaming feeling sluggish. | |
| claude-haiku-4-5 | Fast/cheap but citation discipline thinner. | |
| Wire both, pick at runtime via env var | Default Sonnet 4.5, swap to Opus with `CLAUDE_MODEL=...`. | |

**User's choice:** claude-sonnet-4-5 (recommended).
**Notes:** Env var swap path included anyway (negligible cost) so Opus can be A/B'd at demo time.

---

## Reasoning JSON Schema + Hash Stability

### Q1: Citation format inside reasoning JSON

| Option | Description | Selected |
|--------|-------------|----------|
| Structured citations[] array per dimension, rationale `[N]` references | rationale has inline `[1]` `[2]` refs; `citations: [{id, label, value, source: {address, function, blockNumber}, evidence}]` is structured. Phase 4 renders rationale, links `[1]` to explorer URL. | ✓ |
| Inline structured — rationale as array of typed nodes | Most precise but alien for Claude to produce reliably; tool-use schema gets gnarly. | |
| Plain markdown rationale + separate facts[] | Loses cited-claim guarantee — Phase 4 can't directly link claim → fact. | |

**User's choice:** Structured citations[] array (recommended).
**Notes:** Survives Claude rewording; structured array is what Phase 4 trusts.

### Q2: Canonical serialization for keccak256 stability

| Option | Description | Selected |
|--------|-------------|----------|
| RFC 8785 JSON Canonicalization Scheme (JCS) | Standardized: recursive lex key sort, no whitespace, UTF-8, IEEE 754 shortest. Library: `canonicalize` (npm). Cross-language safe. | ✓ |
| Sort-keys + compact (custom) | Simpler but doesn't handle nested objects, numbers, Unicode correctly — risk of 1% hash mismatches. | |
| Version field + JCS | JCS plus top-level `schema_version` for future schema evolution. | |

**User's choice:** RFC 8785 JCS (recommended).
**Notes:** Pinned npm package: `canonicalize`. Phase 4 verifier MUST use the same function. CONTEXT.md still suggests planner include a `schema_version` field defensively (zero cost, sits inside hashed bytes naturally) — flagged in `<specifics>`.

---

## Claude's Discretion

The following were marked as researcher/planner discretion in CONTEXT.md — NOT user decisions:
- TypeScript project bootstrap (likely `agent/` dir at repo root, `pnpm`/`npm`, `tsx` for local runs)
- Test framework — `vitest` recommended
- viem version pinning (latest stable at execution time)
- Exact `Bands` table thresholds per dimension (research-driven; researcher proposes, planner refines)
- Prompt template wording (subject to CON-llm-prompt-evidence-citation)
- CLI shape
- Secrets handling beyond `ANTHROPIC_API_KEY` in `.env`
- Logging/telemetry verbosity

## Deferred Ideas

- **Per-asset-class dimension weighting** — chosen uniform 25% for v1; could revisit if demo shows misrepresentation.
- **Per-dimension parallel Claude calls** — chose single-shot; fall back if Sonnet 4.5 latency tightens at demo time.
- **claude-opus-4-7 for rationale depth** — wired via `CLAUDE_MODEL` env var; runtime swap.
- **JSON mode (Anthropic `response_format`)** — defer indefinitely; tool-use chosen.
- **Additional dimensions** (governance/custodian) — v2 backlog per DEC-scope-cut-sequence #3.
- **Live ERC-8004 Reputation Registry accuracy loop** — v2 backlog per DEC-scope-cut-sequence #1.
- **More than 3 subjects** — v2 backlog per DEC-scope-cut-sequence #4.
