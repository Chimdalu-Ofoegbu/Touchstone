# Deploying the Touchstone agent watcher (24/7)

The watcher (`agent/src/watch.ts`) is the always-on daemon that makes the live
site's **Re-rate ↻** button work for any visitor: it listens for `RatingRequested`
on the Mantle RatingRegistry and runs the rate → pin → `publishRating` pipeline.

It is a **persistent process**, so it can't live on Vercel (serverless). Run it as
a background worker on **Render** or **Railway** (or any always-on host). This repo
ships `agent/Dockerfile` and a Render blueprint (`render.yaml`).

## Secrets to set in the host dashboard (from your local `agent` .env — never commit them)

| Var | What |
|---|---|
| `ANTHROPIC_API_KEY` | Claude (reasoning synthesis) |
| `MANTLE_RPC_URL` | Mantle mainnet RPC endpoint |
| `PINATA_JWT` | IPFS pinning |
| `PINATA_GATEWAY` | IPFS gateway host |
| `PRIVATE_KEY` | agent wallet — holds NFT #114, signs `publishRating` |
| `RATING_REGISTRY_ADDRESS` | `0xF16d03965E1870Fc3235198468C56dEC65E5606D` |
| `RERATE_COOLDOWN_S` | per-subject rate limit in seconds (blueprint default `21600` = 6h) |

The agent wallet must hold MNT for gas (currently ~16 MNT — ample at low volume).

## Option A — Render (uses `render.yaml`)
1. Push this repo to GitHub (done).
2. Render → **New → Blueprint** → select this repo. Render reads `render.yaml` and
   proposes a worker named `touchstone-agent-watcher`.
3. It prompts for each `sync: false` secret — paste the values from the table.
4. **Apply.** Render builds `agent/Dockerfile` and starts `pnpm watch`.
   (Background workers are a paid plan — Starter ≈ $7/mo; there is no free worker tier.)
5. Open the service **Logs** — you should see
   `=== Touchstone agent watcher LIVE ===` followed by a `[heartbeat]` line ~every 15s.

## Option B — Railway (uses `agent/Dockerfile`)
1. Railway → **New Project → Deploy from GitHub repo** → select this repo.
2. Service **Settings → Root Directory = `agent`** (so it uses `agent/Dockerfile`
   and the agent lockfile). Builder = Dockerfile.
3. **Variables** → add the seven vars from the table.
4. Deploy → check **Deploy Logs** for the `LIVE` + `[heartbeat]` lines.
   (Railway is usage-based, ~$5/mo, with trial credit.)

## Verify it actually works
1. Open https://www.touchstoneai.xyz, connect a wallet, and click **Re-rate ↻** on a
   subject last rated more than `RERATE_COOLDOWN_S` ago.
2. The worker logs should print
   `>>> RatingRequested CAUGHT -> <SUBJECT>` … then `>>> PUBLISHED <SUBJECT>` (tx / cid / hash).
3. The site auto-refreshes (~12s poll) and the new rating + reasoning appear.

## Operating notes
- **Cost per re-rate** = one Claude call + one Pinata pin + one Mantle gas tx (paid by
  the agent wallet). The per-subject **cooldown** is the real anti-spam throttle — keep
  it high (6h+) for a public agent.
- **RPC load:** the watcher polls every 4s. If your RPC has tight limits, raise `POLL_MS`
  in `agent/src/watch.ts` (e.g. 10–15s) — trades a little re-rate latency for fewer calls.
- **Keep the wallet funded** with MNT; top it up before it runs dry or publishes will fail.
- **Downtime is not replayed:** on restart the watcher resumes from the current block, so
  re-rate clicks made while it was down are not published (the UI just times out). Keep it up.
- **To pause:** suspend the Render/Railway service.
