#!/usr/bin/env node
// agent/src/publish-cli.ts
// `pnpm publish-rating <SUBJECT>` — the break-glass MANUAL fallback that calls
// the IDENTICAL publishRatingFor pipeline (D-03 — no duplicated publish logic;
// the Plan 06 watcher calls the same function automatically). Rehearsable for
// the demo.
//
// Locked allow-list (T-03-17): only USDY / cmETH / FBTC reach the pipeline.
// Unknown subjects exit 2 (an unknown ticker never reaches rate()/Claude/the
// write). Mirrors cli.ts's parse / exit-code / redact discipline exactly.
//
// Output (stdout): subject, txHash, reasoningHash, cid.
// Errors: thrown messages go to stderr prefixed "ERROR: " and exit 1, scrubbed
// once more through redactRpcUrl at the boundary (the write path already funnels
// through redactRpcError; this is defense-in-depth — T-03-18).

import { publishRatingFor } from "./publish.js";
import { redactRpcUrl } from "./rpc.js";
import type { SubjectId } from "./subjects/types.js";

const SUBJECT_IDS: ReadonlySet<SubjectId> = new Set([
  "USDY",
  "cmETH",
  "FBTC",
] as const);

async function main() {
  const subject = process.argv.slice(2)[0] ?? "";
  if (!subject) {
    process.stderr.write("Usage: pnpm publish-rating <SUBJECT>\n");
    process.stderr.write("  SUBJECT one of: USDY, cmETH, FBTC\n");
    process.exit(2);
  }
  if (!SUBJECT_IDS.has(subject as SubjectId)) {
    process.stderr.write("Unknown subject: " + subject + "\n");
    process.stderr.write("Allowed: USDY, cmETH, FBTC\n");
    process.exit(2);
  }
  try {
    const { cid, reasoningHash, txHash } = await publishRatingFor(
      subject as SubjectId,
    );
    process.stdout.write("subject=" + subject + "\n");
    process.stdout.write("txHash=" + txHash + "\n");
    process.stdout.write("reasoningHash=" + reasoningHash + "\n");
    process.stdout.write("cid=" + cid + "\n");
  } catch (e) {
    // The write path already scrubbed via redactRpcError; scrub once more at the
    // boundary so no error shape can leak the keyed MANTLE_RPC_URL (cli.ts idiom).
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write("ERROR: " + redactRpcUrl(msg) + "\n");
    process.exit(1);
  }
}

main();
