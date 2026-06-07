# Synthesis Summary

Single entry point for downstream consumers (`gsd-roadmapper`, pitch/README writers, etc.).

## Mode

- Mode: `new` (fresh bootstrap; no existing `.planning/` context to merge against)
- Precedence applied: `["ADR", "SPEC", "PRD", "DOC"]`
- Per-doc overrides honored: `Touchstone Project.md` precedence 0, `Touchstone UI-UX Prompt.md` precedence 1 (both higher priority than default SPEC tier, ordered relative to each other)

## Docs synthesized

- Total: 2 (breakdown: 2 SPEC, 0 ADR, 0 PRD, 0 DOC, 0 UNKNOWN)
- Sources:
  - `Touchstone Project.md` — system architecture, contracts, agent pipeline, phasing, submission (precedence 0)
  - `Touchstone UI-UX Prompt.md` — frontend build spec, design system, AI interaction design, accessibility (precedence 1)

## Decisions

- ADRs locked: 0 (no ADRs in this ingest)
- Spec-asserted decisions captured: 13 (see `decisions.md`)
- IDs: DEC-positioning-ratings-not-yield, DEC-grade-encoding-uint8, DEC-onchain-hash-offchain-reasoning, DEC-five-deterministic-risk-dimensions, DEC-llm-reasoning-claude, DEC-erc8004-identity-reputation, DEC-onchain-trigger-requestRating, DEC-tech-stack, DEC-aesthetic-direction-editorial, DEC-typography-editorial-serif-plus-mono, DEC-grade-color-ramp, DEC-no-browser-storage-in-artifact-context, DEC-scope-cut-sequence, DEC-ship-core-minimum

Note: With no ADRs in the ingest, every captured decision is overridable by a future ADR. Downstream agents should treat these as the working baseline, not locked policy.

## Requirements

- Total: 14 (see `requirements.md`)
- IDs: REQ-rating-engine-pipeline, REQ-rating-registry-contract, REQ-erc8004-identity-mint, REQ-erc8004-reputation-loop, REQ-ipfs-reasoning-pin, REQ-subjects-rated, REQ-historical-downgrade-proof, REQ-frontend-ratings-terminal, REQ-frontend-rating-detail, REQ-frontend-track-record, REQ-frontend-live-request-flow, REQ-frontend-accessibility, REQ-ai-interaction-design, REQ-submission-deliverables, REQ-design-tokens, REQ-phase-0-discovery
- Cuttable (per scope-cut sequence): REQ-erc8004-reputation-loop (live loop), portions of REQ-rating-engine-pipeline (off-chain metadata, governance dimension), REQ-subjects-rated (5 → 3)

## Constraints

- Total: 20 (see `constraints.md`)
- Breakdown by type:
  - `api-contract`: 3 (publishRating, requestRating, read interface)
  - `schema`: 3 (Rating struct, grade encoding, reasoning JSON schema)
  - `protocol`: 4 (ERC-8004 identity, ERC-8004 reputation, on-chain trigger required, data sources)
  - `nfr`: 10 (LLM evidence-citation, deterministic/LLM separation, tech stack pinning, forbidden fonts, grade signaling, grade is largest object, streaming reasoning, verifiability first-class, loading states, deadline/attention, demo video length, public deployment)

## Context

- Topics captured: 9 (see `context.md`) — positioning, judge psychology per rubric, submission-question drafts, historical-downgrade proof rationale, risk register, phase narrative, aesthetic philosophy, agent voice, Best UI/UX rubric weights, definition of done, cross-doc relationship
- Source breakdown: derived from both SPECs (no DOC-typed sources existed in the ingest)

## Conflicts

- Blockers: 0
- Competing variants: 0
- Auto-resolved (precedence applied): 0
- INFO entries: 2 (mutual sibling cross-reference logged; reinforced assertions noted)
- Detail report: `C:\Users\Ben\Desktop\B3NSAG3\Hackathons\Mantle - Turing\Touchstone\.planning\INGEST-CONFLICTS.md`

## Cycle detection

- Graph: 2 nodes, 2 edges (Project.md ↔ UI-UX Prompt.md)
- Cycle present: yes (2-cycle between sibling SPECs)
- Action: NOT treated as a blocker. The cycle is intentional mutual cross-referencing between scope-disjoint sibling SPECs from the same project. Each doc was extracted independently; no transitive merge logic ran across the edge, so no synthesis-loop risk exists. Logged as INFO in the conflicts report.

## Intel files (consumed downstream)

- `C:\Users\Ben\Desktop\B3NSAG3\Hackathons\Mantle - Turing\Touchstone\.planning\intel\decisions.md`
- `C:\Users\Ben\Desktop\B3NSAG3\Hackathons\Mantle - Turing\Touchstone\.planning\intel\requirements.md`
- `C:\Users\Ben\Desktop\B3NSAG3\Hackathons\Mantle - Turing\Touchstone\.planning\intel\constraints.md`
- `C:\Users\Ben\Desktop\B3NSAG3\Hackathons\Mantle - Turing\Touchstone\.planning\intel\context.md`
- Conflicts report: `C:\Users\Ben\Desktop\B3NSAG3\Hackathons\Mantle - Turing\Touchstone\.planning\INGEST-CONFLICTS.md`

## Status

**READY** — no blockers, no competing variants. Safe to route to `gsd-roadmapper`.

## Notes for the roadmapper

- The phase plan in `Touchstone Project.md` §7 is already explicitly day-banded (Day 1 through Day 9). The roadmapper should preserve this banding and the explicit "non-negotiable" / "cuttable" labels rather than re-deriving them.
- The pre-planned scope-cut sequence (DEC-scope-cut-sequence) is an ordered list. The roadmapper should treat it as a contingency lane, not a default cut.
- The deadline (June 15, 2026) and the split-attention constraint (Sui Overflow June 16) are hard inputs. Today's date is June 7, 2026, so runway is 8 days, not the 9-day figure asserted in the spec (which was written assuming a different start date). Roadmapper should rebase phase numbering against today's date.
- Both SPECs explicitly partition by scope. The roadmapper should NOT attempt to derive frontend tasks from `Touchstone Project.md` or backend/contract tasks from `Touchstone UI-UX Prompt.md` — each owns its lane.
