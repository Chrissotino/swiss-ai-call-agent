# ─────────────────────────────────────────────────────────────
# Swiss AI Call Agent — Multi-stage Dockerfile
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Base Builder ────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci --frozen-lockfile

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 2: MCP Server ──────────────────────────────────────
FROM node:20-alpine AS mcp

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --frozen-lockfile --omit=dev

COPY --from=builder /app/dist ./dist

# Health check via MCP stdio (no HTTP)
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "process.exit(0)"

USER node

CMD ["node", "dist/mcp-server/index.js"]

# ── Stage 3: API Server ──────────────────────────────────────
FROM node:20-alpine AS api

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --frozen-lockfile --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

USER node

CMD ["node", "dist/api/index.js"]
