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

import { z } from "zod";
import { ReasoningDoc } from "../schema.js";

/**
 * Build the Anthropic `input_schema` for submit_rating from the locked zod
 * schema, so the on-the-wire contract and the runtime validator can never drift.
 *
 * CR-05 (live-path bug): the previous implementation used zod-to-json-schema
 * (v3), whose converter targets zod v3 internals. Against our zod-v4 schema it
 * emitted a `{ $ref, definitions }` wrapper with NO top-level `type`, which the
 * Anthropic Messages API rejects with
 *   400 invalid_request_error: tools.0.custom.input_schema.type: Field required
 * The mock suite never caught it because the mock client doesn't validate the
 * tool schema the way the real API does. zod v4 ships a native, spec-correct
 * converter (`z.toJSONSchema`) that emits a proper root-typed object schema
 * (`type: "object"`, `properties`, `required`) — use it directly.
 */
function buildInputSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(ReasoningDoc) as Record<string, unknown>;
  // Anthropic's input_schema is a bare JSON Schema object; the `$schema` meta
  // key is not part of the tool contract — drop it to keep the request clean.
  delete schema.$schema;
  return schema;
}

/**
 * The submit_rating tool. Description doubles as the system instruction
 * for citation discipline — every dimension's rationale MUST use [N]
 * markers that map into the dimension's own citations[] array, and the
 * facts the engine supplies are wrapped in <facts>...</facts> tags so
 * the model can reliably distinguish DATA from INSTRUCTIONS (T-2-05).
 *
 * Forced selection is guaranteed by the caller's
 * tool_choice: { type: "tool", name: "submit_rating" } (synthesize.ts), and the
 * engine re-validates the tool args against ReasoningDoc with a one-retry path,
 * so no non-standard `strict` field is sent to the Anthropic API.
 */
export const submitRatingTool = {
  name: "submit_rating" as const,
  description:
    "Submit the final rating for the subject. Every dimension's rationale MUST cite " +
    "specific facts from the supplied <facts>...</facts> list using [N] markers that " +
    "map to citations[] entries in the same dimension. The overall_rationale " +
    "synthesizes across dimensions. Do NOT fabricate facts or addresses — only cite " +
    "values present in the supplied fact list.",
  input_schema: buildInputSchema(),
};
