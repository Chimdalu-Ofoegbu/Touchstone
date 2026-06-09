// agent/tests/helpers/mock-anthropic.ts
// Backward-compat re-export per W2 fix. The production-safe home for the
// mock helpers is agent/src/claude/mock.ts so rate({ mock: true }) — which
// is callable from non-test code (CLI, Phase 3) — does not import test
// infrastructure. Wave 3 tests imported from this path; preserving it.

export {
  fixtureToolUseResponse,
  mockAnthropicClient,
} from "../../src/claude/mock.js";
export type { MockBehavior } from "../../src/claude/mock.js";
