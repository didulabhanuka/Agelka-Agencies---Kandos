# ─── Stage 1: Build React App ─────────────────────────────────────
FROM node:18-alpine AS build

WORKDIR /app

# Accept API URL as build argument
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev — needed for Vite build)
RUN npm ci

# Copy source code
COPY . .

# Build the production bundle (VITE_API_BASE_URL is baked in here)
RUN npm run build

# ─── Stage 2: Serve with Nginx ────────────────────────────────────
FROM nginx:alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built React app from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
