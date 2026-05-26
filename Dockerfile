# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM oven/bun:1-slim AS deps

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM oven/bun:1-slim AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN bun run build

# ── Stage 3: Production ──────────────────────────────────────────────────────
FROM oven/bun:1-slim AS production

WORKDIR /app

# workerd (used by @cloudflare/vite-plugin preview) needs these system libs
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copy build output and everything the preview server needs
COPY --from=build /app /app

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]
