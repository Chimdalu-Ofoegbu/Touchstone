// agent/tests/helpers/mock-anthropic.ts
// Mock Anthropic client that satisfies AnthropicClientLike. Returns
// hand-authored tool_use blocks shaped like the real API. Used by
// claude.mock.test.ts AND by tests/goldens/*.golden.test.ts so the
// pipeline tests run without ANTHROPIC_API_KEY.
//
// fixtureToolUseResponse(args) deliberately injects WRONG values for
// generated_at / claude_model / ingest_block so tests can prove the
// engine OVERRIDES them after zod parse (T-2-06 hash-determinism).

import type { AnthropicClientLike } from "../../src/claude/synthesize.js";
import type { ReasoningDocument } from "../../src/schema.js";

/**
 * Build a fake Anthropic response.content[0] tool_use block from
 * partial ReasoningDocument args. Engine-overridden fields default
 * to deliberately-wrong values so the engine-side override is observable.
 */
export function fixtureToolUseResponse(
  args: Omit<
    ReasoningDocument,
    "generated_at" | "claude_model" | "ingest_block"
  > & {
    generated_at?: string;
    claude_model?: string;
    ingest_block?: number;
  },
) {
  return {
    content: [
      {
        type: "tool_use",
        name: "submit_rating",
        input: {
          ...args,
          // Wrong on purpose — engine must override these post-parse.
          generated_at: args.generated_at ?? "9999-12-31T23:59:59Z",
          claude_model: args.claude_model ?? "claude-imaginary-99",
          ingest_block: args.ingest_block ?? 0,
        },
      },
    ],
  };
}

export type MockBehavior =
  | { kind: "ok"; response: unknown }
  | { kind: "schema-mismatch"; response: unknown }
  | { kind: "no-tool"; response: unknown };

/**
 * Stateful mock that walks a queue of behaviors so the one-retry path
 * (first response: schema-mismatch -> second response: ok) is testable.
 * Throws if a test queues fewer behaviors than it triggers.
 */
export function mockAnthropicClient(
  behaviors: MockBehavior[],
): AnthropicClientLike {
  const queue = [...behaviors];
  return {
    messages: {
      create: async () => {
        if (queue.length === 0) {
          throw new Error(
            "mock anthropic: no more behaviors queued (test triggered more calls than behaviors)",
          );
        }
        const next = queue.shift()!;
        return next.response;
      },
    },
  };
}
