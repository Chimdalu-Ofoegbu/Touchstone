// agent/src/claude/tool-schema.ts
// Anthropic tool-use definition for the forced submit_rating call (D-10).
// Used with:
//   tool_choice: { type: "tool", name: "submit_rating" }
//   strict: true
// Anthropic guarantees Claude calls THIS tool with args matching THIS
// input_schema. The zod schema is the single source of truth — we derive
// the JSON Schema from it so the on-the-wire contract and the runtime
// validator can never drift.
//
// RESEARCH §4 + CONTEXT D-10.

import { zodToJsonSchema } from "zod-to-json-schema";
import { ReasoningDoc } from "../schema.js";

/**
 * The submit_rating tool. Description doubles as the system instruction
 * for citation discipline — every dimension's rationale MUST use [N]
 * markers that map into the dimension's own citations[] array, and the
 * facts the engine supplies are wrapped in <facts>...</facts> tags so
 * the model can reliably distinguish DATA from INSTRUCTIONS (T-2-05).
 *
 * `strict: true` tells Anthropic to enforce the input_schema strictly,
 * which eliminates an entire class of one-retry costs (RESEARCH §4 tip).
 */
export const submitRatingTool = {
  name: "submit_rating" as const,
  description:
    "Submit the final rating for the subject. Every dimension's rationale MUST cite " +
    "specific facts from the supplied <facts>...</facts> list using [N] markers that " +
    "map to citations[] entries in the same dimension. The overall_rationale " +
    "synthesizes across dimensions. Do NOT fabricate facts or addresses — only cite " +
    "values present in the supplied fact list.",
  // zod-to-json-schema's type signature targets zod v3; our schema is zod v4
  // and structurally compatible. Cast through `unknown` to satisfy tsc.
  input_schema: zodToJsonSchema(ReasoningDoc as unknown as Parameters<typeof zodToJsonSchema>[0], {
    target: "openAi",
  }) as unknown as Record<string, unknown>,
  strict: true as const,
};
