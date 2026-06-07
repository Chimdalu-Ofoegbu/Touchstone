# Constraints (synthesized from ingested SPECs)

Both source docs are SPECs. Each constraint below is tagged by type per the synthesizer schema: `api-contract`, `schema`, `nfr` (non-functional requirement), or `protocol`.

---

## CON-publishRating-signature (api-contract)

- Source: `Touchstone Project.md` §3.1
- Type: api-contract
- Content:
  ```solidity
  function publishRating(
      address subject,
      uint8 grade,
      bytes32 reasoningHash,
      uint8 confidence
  ) external;

  event RatingPublished(address indexed subject, uint8 grade, bytes32 reasoningHash, uint8 confidence, uint256 timestamp);
  ```
  - Callable only by the registered agent identity.
  - `grade` ∈ [0, 9].
  - `reasoningHash` = `keccak256(reasoningJSON)`.

## CON-requestRating-signature (api-contract)

- Source: `Touchstone Project.md` §3.1
- Type: api-contract
- Content:
  ```solidity
  function requestRating(address subject) external;

  event RatingRequested(address indexed subject, address indexed requester, uint256 timestamp);
  ```
  - Callable by anyone (public trigger).
  - Off-chain agent listens for `RatingRequested` and responds with `publishRating`.

## CON-read-interface (api-contract)

- Source: `Touchstone Project.md` §3.1
- Type: api-contract
- Content:
  ```solidity
  function latestRating(address subject) external view returns (Rating memory);
  function ratingHistory(address subject) external view returns (Rating[] memory);
  ```
  - Read interface consumed by other on-chain agents and the frontend.

## CON-rating-schema (schema)

- Source: `Touchstone Project.md` §3.1
- Type: schema
- Content:
  ```
  struct Rating {
      address subject;
      uint8 grade;          // 0..9 → AAA..D
      bytes32 reasoningHash; // keccak256(reasoning JSON pinned to IPFS)
      uint8 confidence;
      uint256 timestamp;
      address agentIdentity; // ERC-8004 identity that issued
  }
  ```
  Fields documented in spec: subject, grade, reasoning hash, confidence, timestamp, agent identity.

## CON-grade-encoding (schema)

- Source: `Touchstone Project.md` §3.1
- Type: schema
- Content:
  - `uint8` encoding: 0=AAA, 1=AA, 2=A, 3=BBB, 4=BB, 5=B, 6=CCC, 7=CC, 8=C, 9=D.
  - The mapping lives in a shared constants file consumed by contract, agent, and frontend (single source of truth).

## CON-reasoning-json-schema (schema)

- Source: `Touchstone Project.md` §3.1, §3.2 step 3
- Type: schema
- Content:
  - Reasoning JSON pinned to IPFS contains at minimum: per-dimension scores (0–100 each), per-dimension rationale text with cited evidence references, the synthesized letter grade, the confidence value, and the agent's written overall rationale.
  - `keccak256` of the canonical JSON byte sequence MUST equal the on-chain `reasoningHash`.

## CON-erc8004-identity (protocol)

- Source: `Touchstone Project.md` §3.1
- Type: protocol
- Content:
  - Agent holds an ERC-8004 Identity Registry NFT (ERC-721 canonical).
  - Do NOT reimplement the standard.
  - If canonical ERC-8004 registries are not deployed on Mantle in Phase 0, deploy reference registries and document in README as an ecosystem contribution.

## CON-erc8004-reputation (protocol)

- Source: `Touchstone Project.md` §3.1, §3.2 step 5
- Type: protocol
- Content:
  - Accuracy feedback is written to the agent's ERC-8004 Reputation Registry record.
  - Adverse-event recording: when a rated subject experiences a documented adverse event (depeg, exploit, large loss), record whether the agent's prior rating anticipated it.

## CON-onchain-trigger-required (protocol)

- Source: `Touchstone Project.md` §9 (20 Project Deployment Award gate)
- Type: protocol
- Content:
  - At least one AI-powered function MUST be callable on-chain.
  - The `requestRating` → `publishRating` round-trip is the canonical satisfying flow.
  - Even under maximum scope cut, the trigger must remain on-chain (manual admin trigger is the floor; cf. DEC-scope-cut-sequence #5).

## CON-data-sources (protocol)

- Source: `Touchstone Project.md` §3.2 step 1
- Type: protocol
- Content:
  - On-chain (required): TVL and 30/90-day TVL volatility, oracle configuration and update cadence, collateral composition, holder concentration, verified contract source from Mantle Explorer.
  - Off-chain (cuttable per scope-cut #2): custodian metadata, audit reports, governance structure.
  - Mantle RPC and Mantle Explorer are the canonical sources.

## CON-llm-prompt-evidence-citation (nfr)

- Source: `Touchstone Project.md` §10 risks/mitigations; §3.2 step 3
- Type: nfr
- Content:
  - The reasoning prompt MUST enforce evidence-citation. Every rationale names specific data points (TVL value, oracle address, custodian name, audit firm, etc.) — generic statements are not acceptable.
  - Failure mode mitigated: "Reasoning reads as generic."

## CON-deterministic-vs-llm-separation (nfr)

- Source: `Touchstone Project.md` §3.2 closing paragraph
- Type: nfr
- Content:
  - Deterministic scoring (the five 0–100 dimension scores) MUST be implemented as code separate from the LLM step.
  - The LLM synthesizes and explains; metrics anchor.
  - Rationale: judges can inspect the boundary and verify the agent is not hallucinating grades.

## CON-tech-stack-pinning (nfr)

- Source: `Touchstone Project.md` §3.3; `Touchstone UI-UX Prompt.md` §"Tech constraints"
- Type: nfr
- Content:
  - Contracts: Solidity, Foundry, deployed and verified on Mantle.
  - Agent: TypeScript / Node.
  - Frontend: Next.js + Tailwind core utility classes only.
  - LLM: Claude (per project spec).
  - IPFS pinning: web3.storage or Pinata.
  - No browser `localStorage` / `sessionStorage` in any artifact-rendered context.

## CON-typography-forbidden-fonts (nfr)

- Source: `Touchstone UI-UX Prompt.md` §"Aesthetic direction"
- Type: nfr
- Content:
  - Inter, Roboto, Arial, and system fonts are explicitly forbidden.
  - An editorial serif (for grades, headlines, agent voice) and a precise grotesk or monospace (for data, tickers, addresses, metrics) are required.
  - Fonts must be loaded properly (self-host or reliable source) so distinctive typography renders for judges.

## CON-grade-signaling-never-color-only (nfr)

- Source: `Touchstone UI-UX Prompt.md` §"Grade color system"; §"Accessibility requirements"
- Type: nfr
- Content:
  - A grade chip MUST include the letter (editorial serif) AND a text label AND the family color.
  - Color alone is never sufficient signaling.

## CON-grade-is-largest-object (nfr)

- Source: `Touchstone UI-UX Prompt.md` §"Aesthetic direction"; §"Rating detail"
- Type: nfr
- Content:
  - On any rating view, the grade is the largest object on screen.
  - Reinforces the editorial broadsheet hierarchy and the "ratings-first" product positioning.

## CON-ai-interaction-streaming-reasoning (nfr)

- Source: `Touchstone UI-UX Prompt.md` §"AI Interaction Design requirements"
- Type: nfr
- Content:
  - During live rating generation, reasoning MUST stream dimension by dimension.
  - A finished grade may not pop without the journey shown.
  - The streaming reasoning is the signature motion moment of the demo.

## CON-verifiability-first-class (nfr)

- Source: `Touchstone UI-UX Prompt.md` §"AI Interaction Design requirements"; §"Rating detail"
- Type: nfr
- Content:
  - On-chain reasoning hash and its match status MUST be surfaced as a first-class UI element (not a footnote).
  - The frontend MUST verify the displayed reasoning matches the on-chain hash and show the match state visibly.

## CON-loading-states-required (nfr)

- Source: `Touchstone UI-UX Prompt.md` §"Motion and interaction"; §"Hard anti-patterns"
- Type: nfr
- Content:
  - Every async action MUST have intentional loading, empty, and error states.
  - No spinners into the void; no dead ends; no empty screens with no designed state.

## CON-deadline-and-attention (nfr)

- Source: `Touchstone Project.md` opening + §7
- Type: nfr
- Content:
  - Hard deadline: June 15, 2026.
  - Runway: ~9 days, attention split with Sui Overflow (June 16 deadline).
  - Phases 0–3 and 6 are the irreducible core. Phase 4 (historical-downgrade proof) is highest-value addition. Phase 5 (live Reputation accuracy loop) is first to cut.

## CON-demo-video-min-length (nfr)

- Source: `Touchstone Project.md` §9 (20 Project Deployment Award)
- Type: nfr
- Content:
  - Demo video MUST be ≥ 2 minutes and walk the core use case.
  - Four on-camera demo moments are pre-defined in `Touchstone UI-UX Prompt.md`: (1) terminal load, (2) reasoning drill-down with citations, (3) live rating trigger + on-chain publish, (4) track-record timeline landing the historical-downgrade proof.

## CON-public-deployment (nfr)

- Source: `Touchstone Project.md` §9
- Type: nfr
- Content:
  - Frontend MUST be publicly accessible (not localhost) at submission time.
  - Contract MUST be deployed AND verified on Mantle Mainnet or Testnet, with the address included in the DoraHacks submission.
