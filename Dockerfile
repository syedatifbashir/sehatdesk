FROM node:20-bookworm AS base
RUN apt-get update && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

FROM base AS builder
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
RUN pnpm install --no-frozen-lockfile
COPY . .
RUN pnpm dlx prisma@6.0.0 generate --schema packages/db/prisma/schema.prisma
RUN pnpm --filter @hms/web build

FROM base AS runner
ENV NODE_ENV=production
# Copy entire built app (avoids pnpm symlink issues with selective COPY)
COPY --from=builder /app /app
EXPOSE 3100
CMD ["node", "apps/web/startup.mjs"]
