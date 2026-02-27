# ─── Stage 1: Build ───────────────────────────────────────────────
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy source code
COPY . .

# ─── Stage 2: Production ──────────────────────────────────────────
FROM node:18-alpine AS production

WORKDIR /app

# Copy from build stage
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/src ./src
COPY --from=base /app/package*.json ./

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Expose backend port
EXPOSE 5000

# Health check — Azure uses this to know if container is alive
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

# Start the server
CMD ["node", "src/index.js"]
