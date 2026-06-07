# Context (running notes from ingested DOCs)

No DOC-typed sources were classified in this ingest. The two classified sources are SPECs and their content is extracted into `decisions.md`, `requirements.md`, and `constraints.md`. Cross-cutting narrative context — positioning language, judge psychology, risk framing, demo storytelling — is captured here for downstream consumers (especially the roadmapper and the pitch/README writer).

---

## Topic: Product positioning and the "Moody's of the agentic economy" pitch

- Source: `Touchstone Project.md` §1
- Verbatim: "A touchstone is the dark stone assayers struck gold against to judge its purity. This one does the same for on-chain assets. Every other RWA agent in this hackathon will compete on returns: yield optimizers, rebalancers, vault managers. Touchstone does not trade. It rates."
- Tag line for the panel (Nansen, Hashed, Caladan): "the Moody's of the agentic economy, with an on-chain track record no rating agency has ever had."
- Positioning frame: ratings-first, not yield-first. Upstream of every yield agent in the room → competitors are potential consumers, not just rivals.

## Topic: Why this wins each rubric criterion (judge psychology)

- Source: `Touchstone Project.md` §4
- Technical Depth (30%): real contract analysis + multi-source on-chain ingestion + deterministic scoring fused with LLM reasoning + on-chain publication with verifiable hashes + ERC-8004 reputation loop. "A genuine system, not a wrapper."
- Innovation (25%): structured AI credit ratings published on-chain are not being done. The entire field is yield-first. Ratings-first is the novel paradigm.
- Mantle Ecosystem (25%): rates Mantle-native RWA assets, consumes Mantle on-chain data as core source, produces an oracle other Mantle agents can build on.
- Product Completeness (20%): runnable demo + verified contracts + polished terminal. The historical-downgrade proof converts "interesting" into "complete."

## Topic: Submission-question answers (draft)

- Source: `Touchstone Project.md` §5
- AI x RWA answer: "Touchstone does not tokenize a new asset; it makes existing tokenized real-world assets on Mantle (USDY, mETH and the markets built on them) safer to use by issuing AI-generated credit ratings. The AI ingests on-chain and off-chain risk data, scores five risk dimensions, and reasons to a letter grade with a cited rationale. Every rating is published on-chain under an ERC-8004 identity, so the agent builds a permanent, verifiable accuracy record on Mantle that any other protocol can consume as an oracle."
- AI Alpha & Data answer: "Core data source is Mantle on-chain state: TVL and its volatility, oracle configuration, collateral composition, holder concentration, and verified contract source, supplemented by off-chain custodian and audit metadata. The AI fuses deterministic risk scores with a reasoning step that produces a grade and a cited rationale. Value is verifiable because every rating, its reasoning hash, and its subsequent accuracy are recorded on Mantle; the agent's track record cannot be retroactively edited."

## Topic: The historical-downgrade proof (demo centerpiece)

- Source: `Touchstone Project.md` §6
- Why it matters: "The single most persuasive thing in the demo is showing the agent would have warned you before a real failure."
- Without it: "judges suspect the grades are decorative."
- With it: "the institutional seats lean forward."
- Build steps: (1) select a documented 2025 RWA/stablecoin failure (verify specifics before relying on candidates — tokenized-yield or synthetic-dollar depeg, lending-market bad-debt, RWA custodian failure), (2) reconstruct subject's on-chain state before failure, (3) run agent on historical state → low/deteriorating grade with reasoning naming the specific weakness that broke, (4) show timeline: agent downgrade → real-world failure.

## Topic: Risk register and mitigations

- Source: `Touchstone Project.md` §10
- Cherry-picked accuracy → historical-downgrade proof on a real, checkable 2025 failure.
- AI x RWA is the most crowded track (22%+ of submissions in prior Mantle hackathon) → ratings-first positioning ("upstream infrastructure other agents consume").
- ERC-8004 registries may not be deployed on Mantle → Phase 0 confirmation; if absent, deploy reference registries.
- Reasoning reads as generic → enforce evidence-citation in reasoning prompt.
- Time loss to Sui Overflow → front-loaded deployment bar means worst-case finish still clears 20 Project Deployment Award.

## Topic: Phase-by-phase narrative

- Source: `Touchstone Project.md` §7
- Phase 0 (Day 1, non-negotiable): Lock. Verify subjects + ERC-8004 registries on Mantle, addresses captured. Resolve five dimensions + grade encoding. Deploy skeleton `RatingRegistry.sol` to Mantle testnet, verify on Mantle Explorer, wire trivial `requestRating` to stub `publishRating`. **End-of-day-1: deployment-award technical bar met.**
- Phase 1 (Days 2–3, non-negotiable): Rating engine core. Data ingest + five deterministic scoring modules + LLM reasoning step. Hardcode five subjects.
- Phase 2 (Day 4, non-negotiable): ERC-8004 + on-chain publish. Mint agent identity NFT, wire real `publishRating`, pin reasoning to IPFS, store hash, implement `latestRating` + `ratingHistory` reads.
- Phase 3 (Days 5–6, non-negotiable for Best UI/UX): Frontend per `prompt.md`. Three screens: ratings terminal, reasoning drill-down, track record.
- Phase 4 (Day 7, high value): Historical-downgrade proof.
- Phase 5 (Day 8, cuttable): Reputation accuracy loop.
- Phase 6 (Day 9, non-negotiable): Ship. Demo video (≥ 2 min), README (setup + architecture + addresses), open-source repo, DoraHacks submission with deployment address, submit to both tracks.

## Topic: Aesthetic philosophy (for the pitch writer too, not just the FE engineer)

- Source: `Touchstone UI-UX Prompt.md` §"Aesthetic direction"
- Frame: "Editorial rating-agency broadsheet meets a precision terminal. Authoritative, calm, and expensive-feeling."
- Reference points: a printed credit-rating report, a financial broadsheet — reinterpreted for the screen.
- Anti-reference: neon crypto dashboard, generic SaaS admin panel, AI-dashboard aesthetic (Inter/system fonts, purple-to-blue gradients on white, predictable card grids).
- Restraint as a value: "Negative space is a feature; do not fill every pixel." "This design earns authority through restraint."

## Topic: Agent voice for the LLM reasoning prompts and any in-product copy

- Source: `Touchstone UI-UX Prompt.md` §"AI Interaction Design requirements"
- Voice: "consistent, calm analyst voice. Plain, precise, never hype."
- Behavior: "every assertion is cited"; "the agent never makes an unbacked claim in the UI."

## Topic: Best UI/UX rubric (for design-decision justification)

- Source: `Touchstone UI-UX Prompt.md` §"Design to the prize, literally"
- Visual Design (30%): committed, distinctive aesthetic with real typographic and color discipline. Not a template.
- Interaction & Flow (30%): smooth transitions, clear guidance, responsive states, no dead ends.
- AI Interaction Design (25%): the agent's reasoning presented naturally and transparently — "show the analyst thinking."
- Accessibility (15%): newcomer with no DeFi knowledge can understand what a grade means and why.

## Topic: Definition of done (the whole-system success picture)

- Source: `Touchstone UI-UX Prompt.md` §"Definition of done"
- Verbatim: "A newcomer lands on the terminal, immediately grasps which Mantle RWA assets are safe and which are not, opens one, understands why in plain language with every claim traceable to on-chain data, verifies the reasoning against its on-chain hash, and sees a track record proving the agent called a real failure before it happened. It should feel like a financial institution shipped it."

## Topic: Cross-document relationship

- `Touchstone Project.md` (precedence 0) owns: architecture, agent logic, contracts, phasing, submission gates.
- `Touchstone UI-UX Prompt.md` (precedence 1) owns: frontend visual design, interaction flow, AI interaction patterns, accessibility, demo moments.
- They are complementary by design and reference each other explicitly. No contradictions detected in this ingest.
