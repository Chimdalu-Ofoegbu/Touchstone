# @touchstone/agent

Off-chain TypeScript rating engine for Mantle RWA subjects. Phase 2 deliverable.

## Setup

1. From the repository root, `cd agent`.
2. `pnpm install` (or `npm install`).
3. Make sure the root project `.env` (one directory up — `../.env`) has `ANTHROPIC_API_KEY` set. The `pnpm rate` script loads it automatically via `tsx --env-file-if-exists=../.env`. There is **no separate `agent/.env`** — root `.env` is the single source of secrets for the whole project (per CONTEXT.md `<code_context>` section). `--env-file-if-exists` means the script still runs when the root `.env` is missing (e.g., `--mock` runs or CI), but you will need it for live rating calls.

## Environment variables (all read from the root project `.env`)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ANTHROPIC_API_KEY` | yes (live runs) | — | Anthropic Messages API; needed for non-`--mock` invocations. |
| `MANTLE_RPC_URL` | no | `https://rpc.mantle.xyz` | viem publicClient RPC. Set this to a private RPC (Alchemy/Infura on Mantle) for production. |
| `CLAUDE_MODEL` | no | `claude-opus-4-8` | Model alias (locked per D-11 user override 2026-06-09 — newest Opus). Swap to `claude-opus-4-7`, `claude-sonnet-4-6`, or `claude-sonnet-4-5` if you want different speed/cost/quality. To use the locked default, leave the `CLAUDE_MODEL` line commented out in `.env` (an empty `CLAUDE_MODEL=` line breaks the engine's `??` fallback). |

> Phase 2 engine never reads `PRIVATE_KEY`. It is only used by Foundry / Phase 3 publisher.

## Usage

```
pnpm rate USDY                       # rate USDY at latest Mantle Mainnet block
pnpm rate cmETH --block 75000000     # rate at a pinned historical block (Phase 3 replay hook)
pnpm rate FBTC --mock                # deterministic mock (no live Anthropic / RPC) — used by tests
pnpm rate USDY --out -               # write canonical JSON to stdout instead of agent/out/
```

Output JSON lives at `agent/out/<SUBJECT>/<block>.json` (file is the canonical-bytes form — its keccak256 IS the `reasoningHash` printed by the CLI).

## Testing

```
pnpm test                            # full vitest suite (no live RPC / Anthropic required)
pnpm test:live                       # gated by RUN_LIVE=1; uses real Mantle RPC + Anthropic
pnpm typecheck                       # tsc --noEmit
```

## Architecture

- `src/subjects/{usdy,cmeth,fbtc}.ts` — viem + Multicall3 adapters (D-01..D-04)
- `src/dimensions/*.ts` — 4 threshold-banded scorers (D-06)
- `src/dimensions/synthesize.ts` — uniform 25% combine (D-08) + grade letter mapping
- `src/claude/synthesize.ts` — single-shot Anthropic tool-use (D-09, D-10, D-11)
- `src/hash.ts` — RFC 8785 JCS + viem.keccak256 (D-13, D-14)
- `src/rate.ts` — orchestrator; Phase 3 imports this
- `src/cli.ts` — `pnpm rate` entrypoint

Deterministic code (`subjects/*`, `dimensions/*`, `hash.ts`) is strictly separated from the LLM step (`claude/*`) per CON-deterministic-vs-llm-separation.

## Phase contracts

- Phase 3 imports `rate()` to handle `RatingRequested` events.
- Phase 4 imports `computeReasoningHash()` to verify on-chain hash against IPFS-fetched JSON.
