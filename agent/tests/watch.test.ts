// agent/tests/watch.test.ts
// [3-06-01] RatingRequested watcher — the pure, testable event handler.
// Proves the three loop invariants without a live subscription (handleLogs is
// injected with a fake publishRatingFor + a shared inFlight Set):
//   1. a known subject address -> publishRatingFor(mappedSubjectId) exactly once
//   2. a double-fire while in flight -> publishRatingFor NOT called again (dedupe)
//   3. an unknown subject address -> publishRatingFor NEVER called (skip, no crash)

import { describe, it, expect } from "vitest";
import { handleLogs, type WatchDeps } from "../src/watch.js";
import type { SubjectId } from "../src/subjects/types.js";

const USDY: `0x${string}` = "0x5bE26527e817998A7206475496fDE1E68957c5A6";
const UNKNOWN: `0x${string}` = "0x000000000000000000000000000000000000dEaD";

const flush = () => new Promise((r) => setTimeout(r, 0));

function deps(publishRatingFor: WatchDeps["publishRatingFor"]): {
  d: WatchDeps;
  calls: SubjectId[];
} {
  const calls: SubjectId[] = [];
  const wrapped: WatchDeps["publishRatingFor"] = async (id) => {
    calls.push(id);
    return publishRatingFor(id);
  };
  return {
    d: { publishRatingFor: wrapped, inFlight: new Set<SubjectId>(), log: () => {}, error: () => {} },
    calls,
  };
}

describe("[3-06-01] watcher handleLogs — map / dedupe / skip", () => {
  it("maps a known address and invokes publishRatingFor once with the SubjectId", async () => {
    const { d, calls } = deps(async () => ({ txHash: "0x" }));
    handleLogs([{ args: { subject: USDY } }], d);
    await flush();
    expect(calls).toEqual(["USDY"]);
  });

  it("dedupes a double-fire while the first publish is still in flight", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { d, calls } = deps(async () => {
      await gate; // hold the first publish open
      return {};
    });
    // two logs for the SAME subject in one batch -> second must be skipped
    handleLogs([{ args: { subject: USDY } }, { args: { subject: USDY } }], d);
    expect(calls).toEqual(["USDY"]); // synchronous push ran exactly once
    release();
    await flush();
    // after the first settles, inFlight is cleared and a fresh fire works again
    handleLogs([{ args: { subject: USDY } }], d);
    await flush();
    expect(calls).toEqual(["USDY", "USDY"]);
  });

  it("skips an unknown subject address without calling publishRatingFor", async () => {
    const { d, calls } = deps(async () => ({}));
    handleLogs([{ args: { subject: UNKNOWN } }], d);
    await flush();
    expect(calls).toEqual([]);
  });
});
