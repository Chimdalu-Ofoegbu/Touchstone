# prompt.md — Touchstone UI/UX Build Spec

A standalone build prompt for the Touchstone frontend. The goal of this file is narrow and specific: **win the Best UI/UX Award** while making the agent's credit ratings legible enough to carry the AI x RWA and Alpha submissions. Hand this directly to the engineering pass. Read `project.md` for system architecture; this file owns the interface.

---

## Mission

Build the Touchstone ratings terminal in Next.js: a public web interface where anyone can see the AI agent's credit ratings for Mantle RWA assets, drill into the reasoning behind any grade, and view the agent's verifiable accuracy track record. It must look like a credible financial institution built it, not like a hackathon dashboard.

## Design to the prize, literally

Best UI/UX is scored on four weighted criteria. Every design decision below is justified by which criterion it serves.

- **Visual Design (30%)** — a committed, distinctive aesthetic with real typographic and color discipline. Not a template.
- **Interaction & Flow (30%)** — smooth transitions, clear guidance, responsive states, no dead ends.
- **AI Interaction Design (25%)** — the agent's reasoning presented naturally and transparently. This is where a ratings tool can out-design a flashy consumer app: show the analyst thinking.
- **Accessibility (15%)** — a newcomer with no DeFi knowledge can understand what a grade means and why. Lower the Web3 barrier.

Design as if these percentages are the grading sheet, because they are.

## Aesthetic direction (commit fully)

**Editorial rating-agency broadsheet meets a precision terminal.** Authoritative, calm, and expensive-feeling. The reference points are a printed credit-rating report and a financial broadsheet, reinterpreted for the screen, not a neon crypto dashboard and not a generic SaaS admin panel.

Commit to these choices:

- **Theme:** warm paper-light base (a true off-white, not pure white), deep ink text, generous margins, editorial hierarchy. A confident single accent used sparingly for authority, not decoration. (If you instead build dark, make it a deep ink-navy terminal, not pure black, and keep the same restraint. Pick one and execute it completely.)
- **Typography:** a characterful editorial serif for grades, headlines, and the agent's voice; a precise grotesk or monospace for data, tickers, addresses, and metrics. The serif gives gravitas; the mono gives credibility. **Do not use Inter, Roboto, Arial, or system fonts.** Choose distinctive, well-paired faces and load them properly.
- **Layout:** intentional, asymmetric where it earns it, with strong vertical rhythm. The grade is always the largest object on any rating view. Negative space is a feature; do not fill every pixel.
- **Texture and depth:** subtle paper grain or a fine baseline grid, hairline rules between sections like a print report, restrained shadows. Atmosphere over flatness, but nothing loud.

## Design tokens

Define everything as CSS variables. Set, at minimum: a 6-step neutral ink ramp, the single accent and its two tints, the full grade color system below, a type scale with at least display / heading / body / mono / caption, an 8px-based spacing scale, two radii, and two shadow levels. Consistency across the app is itself a Visual Design score.

## Grade color system (the data-viz core)

The AAA–D scale must read instantly without reading the letters. Build a coherent ramp, not ten arbitrary colors:

- **Investment grade (AAA, AA, A, BBB):** a calm, cool, trustworthy family progressing from strongest to weakest.
- **Speculative (BB, B):** amber / caution.
- **Distressed (CCC, CC, C, D):** a deepening warning red.

Every grade gets a chip with consistent shape, the letter in the editorial serif, and the family color. The same chip component is reused everywhere a grade appears so the visual language is unmistakable. Never rely on color alone; the letter and a text label always accompany it (this is also an Accessibility point).

## Core screens (these three must exist)

### 1. Ratings terminal (home)
The hero view. A ranked board of the rated Mantle RWA subjects, each row showing: subject name and ticker, the grade chip, confidence, last-updated timestamp, and a sparkline of grade history. The single most important object on screen is the grades. This should feel like opening a rating-agency's daily sheet. Sorting and a subject filter. Tapping a row opens the detail.

### 2. Rating detail + reasoning drill-down (where AI Interaction Design is won)
For a single subject: the large grade, the confidence, and then the agent's reasoning made transparent. Show the five risk dimensions (collateral quality, contract risk, oracle integrity, liquidity and stability, governance and custodian) each as a scored bar with a one-line plain-language summary, expandable to the agent's full rationale for that dimension. Every claim in the rationale links to the specific on-chain data point behind it. Surface the verifiable artifact: the on-chain reasoning hash, with a control to verify the displayed reasoning matches the hash. The agent should read like an analyst showing its work, not a black box emitting a letter.

### 3. Track record (the credibility view)
The agent's accuracy over time, anchored by the historical-downgrade proof from `project.md`: a timeline showing the agent's grade for a subject, then the real-world failure that followed, making the case that the ratings mean something. Show the agent's ERC-8004 identity and its reputation as a documented, permanent record. This view is what converts "neat demo" into "trustworthy institution."

Supporting: a lightweight request flow (enter or pick a subject, trigger `requestRating`, watch the agent produce and publish a rating) so judges see the on-chain AI function fire live.

## AI Interaction Design requirements (25%)

- **Show thinking, not just output.** When a rating is generated live, stream the reasoning as it forms, dimension by dimension. Do not pop a finished grade with no journey.
- **Confidence is visual,** not a bare number. The interface should feel more certain at high confidence and visibly more cautious at low confidence.
- **Every assertion is cited.** Reasoning text links to the on-chain metric or contract that supports it. The agent never makes an unbacked claim in the UI.
- **Verifiability is a first-class UI element,** not a footnote. The reasoning hash and its match status are shown with quiet confidence; this is the whole point of doing it on-chain.
- **The agent has a consistent, calm analyst voice.** Plain, precise, never hype.

## Accessibility requirements (15%)

- Plain-language layer everywhere: any grade and any dimension has a one-sentence explanation a newcomer understands ("BBB means investment grade but with meaningful risks; here is the main one").
- Define jargon inline on first use (TVL, oracle, depeg, custodian) via accessible tooltips or a glossary affordance.
- Full keyboard navigation, visible focus states, semantic HTML, real contrast ratios, and never color alone to convey a grade.
- Responsive from phone to desktop; the terminal must be legible on a narrow screen for the live demo.

## Motion and interaction (30%)

- One well-orchestrated page load with staggered reveals beats scattered micro-animations. The ratings board settling into place on first load should feel composed.
- The reasoning drill-down expands smoothly; dimension bars animate to their scores once, on reveal.
- The live rating generation is the signature motion moment: data gathering, then reasoning streaming in, then the grade resolving. Make this the thing people remember.
- Every async action has an intentional loading and empty and error state. No spinners into the void, no dead ends.

## On-camera demo moments (design these to look great in the 2-minute video)

1. The ratings terminal loading into its composed state.
2. Opening a subject and expanding the reasoning, with citations visibly linking to on-chain data.
3. Triggering a live rating and watching the agent reason and publish on-chain.
4. The track-record timeline landing the historical-downgrade proof.

Each of these must be visually finished, because the demo video is what most judges actually see.

## Tech constraints

- Next.js, the existing project stack.
- For React in this environment use only Tailwind core utility classes and the available libraries; if charts are needed, use a supported charting library; keep the build self-contained.
- No browser localStorage or sessionStorage in any artifact-rendered context; hold state in React state.
- Load custom fonts properly and self-host or use a reliable source so the distinctive typography actually renders for judges.

## Hard anti-patterns (do not ship these)

- Generic AI-dashboard aesthetic: Inter or system fonts, purple-to-blue gradients on white, evenly distributed timid color, predictable card grids.
- A grade with no reasoning behind it, or reasoning with no citations.
- Color-only grade signaling.
- A wall of crypto jargon with no plain-language layer.
- Spinners or empty screens with no designed state.
- Filling every pixel; this design earns authority through restraint.

## Definition of done

A newcomer lands on the terminal, immediately grasps which Mantle RWA assets are safe and which are not, opens one, understands why in plain language with every claim traceable to on-chain data, verifies the reasoning against its on-chain hash, and sees a track record proving the agent called a real failure before it happened. It should feel like a financial institution shipped it. That is the Best UI/UX win.
