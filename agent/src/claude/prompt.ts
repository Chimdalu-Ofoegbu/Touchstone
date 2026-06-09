// agent/src/claude/prompt.ts
// buildPromptFromFacts() — renders SubjectFacts + deterministic dimension
// scores into the single-shot Claude prompt (D-09). Facts are wrapped in
// <facts label="...">...</facts> tags so the system instruction can tell
// the model to treat everything inside as DATA, not INSTRUCTIONS
// (T-2-05 prompt-injection mitigation).
//
// Sanitization (T-2-05 / T-2-07):
//   - Every fact value is stripped of C0 controls (\u0000-\u001f) and DEL
//     (\u007f) — defeats newline/BEL injection that would otherwise read
//     as a new instruction line to the model.
//   - Whitespace runs collapse to a single space.
//   - Values are capped at 256 chars (RESEARCH §10 cap).
//
// RESEARCH §4.2.

import type { SubjectFacts, Fact } from "../subjects/types.js";
import type { BandResult } from "../dimensions/types.js";

/**
 * Strip control characters + newlines from a fact value and cap length.
 * NEVER returns a string containing characters in [\u0000-\u001f\u007f].
 */
function sanitize(value: string | null): string {
  if (value === null) return "(missing)";
  const cleaned = value
    // C0 controls + DEL (T-2-05 mitigation: defeats `\n Ignore prior...` injection).
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 256);
}

function renderFacts(
  label: string,
  list: Fact[],
  startId: number,
): { block: string; nextId: number } {
  let id = startId;
  const lines = list.map((f) => {
    const fnText =
      f.source.kind === "onchain"
        ? "onchain " +
          f.source.address +
          "." +
          f.source.function +
          " @block " +
          String(f.source.blockNumber)
        : "static " + f.source.file + "@" + f.source.version;
    const line =
      "  [" +
      String(id) +
      "] " +
      sanitize(f.label) +
      " = " +
      sanitize(f.value) +
      " (source: " +
      sanitize(fnText) +
      ")";
    id++;
    return line;
  });
  return {
    block:
      '<facts label="' +
      sanitize(label) +
      '">\n' +
      lines.join("\n") +
      "\n</facts>",
    nextId: id,
  };
}

export type BuildPromptInput = {
  subject: SubjectFacts;
  scores: {
    collateral: BandResult;
    contract: BandResult;
    oracle: BandResult;
    liquidity: BandResult;
  };
  missingFacts: string[];
};

/**
 * Render the single-shot Claude prompt. Output is plain UTF-8 text fed
 * as messages[0].content to the Anthropic Messages API. The deterministic
 * scores are presented as already-computed (the model only synthesizes
 * narrative — it does NOT recompute numbers).
 */
export function buildPromptFromFacts(input: BuildPromptInput): string {
  const { subject, scores, missingFacts } = input;
  let id = 1;
  const c1 = renderFacts("collateral", subject.collateral, id);
  id = c1.nextId;
  const c2 = renderFacts("contract", subject.contract, id);
  id = c2.nextId;
  const c3 = renderFacts("oracle", subject.oracle, id);
  id = c3.nextId;
  const c4 = renderFacts("liquidity", subject.liquidity, id);

  return [
    "SUBJECT: " +
      subject.subject.ticker +
      " (" +
      subject.subject.name +
      ") at " +
      subject.subject.address +
      " on Mantle Mainnet (chain 5000)",
    "INGEST BLOCK: " + String(subject.ingestBlock),
    "",
    "DETERMINISTIC DIMENSION SCORES (already computed — do NOT recompute, only synthesize):",
    '- collateral_quality: ' +
      String(scores.collateral.score) +
      '/100 (band: "' +
      scores.collateral.label +
      '")',
    '- contract_risk: ' +
      String(scores.contract.score) +
      '/100 (band: "' +
      scores.contract.label +
      '")',
    '- oracle_integrity: ' +
      String(scores.oracle.score) +
      '/100 (band: "' +
      scores.oracle.label +
      '")',
    '- liquidity_stability: ' +
      String(scores.liquidity.score) +
      '/100 (band: "' +
      scores.liquidity.label +
      '")',
    "",
    "FACTS USED BY EACH DIMENSION (cite these explicitly in rationale[N] markers):",
    c1.block,
    c2.block,
    c3.block,
    c4.block,
    "",
    "MISSING FACTS (if any — hedge honestly in rationale):",
    missingFacts.length
      ? missingFacts.map((m) => "  - " + m).join("\n")
      : "  (none)",
    "",
    "GRADE ENCODING (LOCKED — use exactly):",
    "AAA=0, AA=1, A=2, BBB=3, BB=4, B=5, CCC=6, CC=7, C=8, D=9",
    "",
    "INSTRUCTIONS:",
    "- Call submit_rating exactly once.",
    "- Synthesize an AAA-D letter grade from the four scores (uniform 25% weight).",
    "- For EACH dimension write a rationale that cites at least 2 facts using [1], [2], ... markers whose IDs map to citations[] entries in the same dimension.",
    "- overall_rationale: 3-5 sentences.",
    "- confidence: integer 30-100. Start from 100 and subtract 5 per fact in MISSING FACTS (floor 30).",
    "- DO NOT invent facts or addresses. DO NOT cite anything not in the fact list above.",
  ].join("\n");
}
