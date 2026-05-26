FROM oven/bun:1-slim

WORKDIR /app

# System libs needed by workerd (@cloudflare/vite-plugin preview)
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies (cached unless lockfile changes)
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

# Copy source and build
COPY . .
RUN bun run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]
