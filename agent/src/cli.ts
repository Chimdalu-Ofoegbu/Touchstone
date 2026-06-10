#!/usr/bin/env node
// agent/src/cli.ts
// `pnpm rate <SUBJECT> [--block N] [--out -|<path>] [--mock]` entrypoint.
//
// Locked allow-list (T-2-07): only USDY / cmETH / FBTC are accepted.
// Unknown subjects exit 2 with "Unknown subject: ..." on stderr.
//
// Flags:
//   --block N    pin to a historical Mantle Mainnet block (default: latest)
//   --out -      write canonical JSON to stdout instead of agent/out/
//   --mock       use the deterministic Claude mock (no live Anthropic / RPC)
//
// Output:
//   - default: writes canonical JSON to agent/out/<SUBJECT>/<block>.json
//   - --out -: writes canonical JSON to stdout (no file); reasoningHash line still on stdout
//   - stdout always ends with `reasoningHash=0x<64hex>` (and `outPath=...` if a file was written)
//
// Error handling:
//   - any thrown error from rate() goes to stderr prefixed with "ERROR: " and exit 1
//   - synthesize.ts has already scrubbed ANTHROPIC_API_KEY from error messages
//     before they reach this layer (T-2-01)

import { rate } from "./rate.js";
import { canonicalizeDoc } from "./hash.js";
import { redactRpcUrl } from "./rpc.js";
import type { SubjectId } from "./subjects/types.js";

const SUBJECT_IDS: ReadonlySet<SubjectId> = new Set([
  "USDY",
  "cmETH",
  "FBTC",
] as const);

type ParsedArgs = {
  subject: string;
  block?: bigint;
  out?: string;
  mock: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  const subject = positional[0] ?? "";
  const block =
    flags["block"] && typeof flags["block"] === "string"
      ? BigInt(flags["block"])
      : undefined;
  const out = typeof flags["out"] === "string" ? flags["out"] : undefined;
  const mock = flags["mock"] === true;
  return { subject, block, out, mock };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.subject) {
    process.stderr.write(
      "Usage: pnpm rate <SUBJECT> [--block N] [--out -|<path>] [--mock]\n",
    );
    process.stderr.write("  SUBJECT one of: USDY, cmETH, FBTC\n");
    process.exit(2);
  }
  if (!SUBJECT_IDS.has(args.subject as SubjectId)) {
    process.stderr.write("Unknown subject: " + args.subject + "\n");
    process.stderr.write("Allowed: USDY, cmETH, FBTC\n");
    process.exit(2);
  }
  try {
    const writeToFs = args.out !== "-"; // --out - means stdout only
    const result = await rate(args.subject as SubjectId, {
      blockNumber: args.block,
      mock: args.mock,
      writeToFs,
    });
    if (args.out === "-") {
      process.stdout.write(canonicalizeDoc(result.doc) + "\n");
    }
    process.stdout.write("reasoningHash=" + result.reasoningHash + "\n");
    if (result.outPath)
      process.stdout.write("outPath=" + result.outPath + "\n");
  } catch (e) {
    // ANTHROPIC_API_KEY is scrubbed by synthesize.ts; RPC errors are scrubbed
    // by redactRpcError at the call site. CR-03 / T-2-03: redact once more at
    // the boundary as defense-in-depth so no error shape can leak the keyed
    // MANTLE_RPC_URL to stderr.
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write("ERROR: " + redactRpcUrl(msg) + "\n");
    process.exit(1);
  }
}

main();
