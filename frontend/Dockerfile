# Multi-stage build for Play Prediction Frontend

# Stage 1: Build
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production with Nginx
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built files from builder (TanStack Start outputs to .output/public)
COPY --from=builder /app/dist/client /usr/share/nginx/html
# Rename _shell.html to index.html for Nginx compatibility (TanStack Start SPA mode)
RUN if [ -f /usr/share/nginx/html/_shell.html ]; then mv /usr/share/nginx/html/_shell.html /usr/share/nginx/html/index.html; fi

# Copy environment variable injection script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Run nginx with environment variable injection
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
