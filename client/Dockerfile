# client/Dockerfile

# ─── Stage 1: Build React App ────────────────────────────────────────────────
FROM node:18-alpine AS build

WORKDIR /app

# Accept API URL as build argument (baked into Vite bundle)
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─── Stage 2: Serve with Nginx ───────────────────────────────────────────────
FROM nginx:alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built React app
COPY --from=build /app/dist /usr/share/nginx/html

# Copy maintenance page into its own directory
COPY maintenance.html /usr/share/nginx/maintenance/maintenance.html

# ── Maintenance mode flag ─────────────────────────────────────────────────────
# To ENABLE maintenance mode:  set MAINTENANCE_MODE=true in Docker build-args
# To DISABLE maintenance mode: set MAINTENANCE_MODE=false (or omit it)
ARG MAINTENANCE_MODE=false
RUN if [ "$MAINTENANCE_MODE" = "true" ]; then \
      echo "🔧 MAINTENANCE MODE ON"; \
      touch /usr/share/nginx/maintenance/MAINTENANCE_ON; \
    else \
      echo "✅ MAINTENANCE MODE OFF"; \
      rm -f /usr/share/nginx/maintenance/MAINTENANCE_ON; \
    fi

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]