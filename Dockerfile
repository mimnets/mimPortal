# A Site runs anywhere that runs a container (ADR-0008).
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/core/package.json ./packages/core/
COPY packages/blocks/package.json ./packages/blocks/
COPY packages/admin/package.json ./packages/admin/
COPY starter/package.json ./starter/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/starter/node_modules ./starter/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm --filter starter build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/starter/.next/standalone ./
COPY --from=builder /app/starter/.next/static ./starter/.next/static
COPY --from=builder /app/starter/public ./starter/public
EXPOSE 3000
CMD ["node", "starter/server.js"]
