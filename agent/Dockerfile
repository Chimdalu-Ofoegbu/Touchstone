# Touchstone agent watcher — 24/7 background worker.
# Listens for RatingRequested on the Mantle RatingRegistry and runs the
# rate -> pin -> publishRating pipeline so the live site's "Re-rate" works for
# any visitor. Build context is the agent/ directory (see render.yaml
# dockerContext, or set Root Directory = agent on Railway).

FROM node:22-slim

# pnpm via corepack, matching the dev toolchain (pnpm 10; lockfileVersion 9.0).
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Install deps first so this layer caches unless the manifest/lockfile changes.
# tsx (the TS runner the `watch` script uses) is a devDependency, so do NOT use
# --prod here.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# App source (node_modules / out / tests excluded via .dockerignore).
COPY . .

ENV NODE_ENV=production

# All config comes from the environment (the host injects the secrets). The
# `watch` script runs `tsx --env-file-if-exists=../.env src/watch.ts`; ../.env
# simply doesn't exist in the image, so process.env (the host vars) is used.
CMD ["pnpm", "watch"]
