# Multi-stage build for Play Prediction Frontend

# Stage 1: Build
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Prepare build artifacts
RUN mkdir -p /app/final_build && \
  if [ -d "/app/.output/public" ]; then \
  cp -r /app/.output/public/* /app/final_build/; \
  elif [ -d "/app/dist/client" ]; then \
  cp -r /app/dist/client/* /app/final_build/; \
  elif [ -d "/app/dist" ]; then \
  cp -r /app/dist/* /app/final_build/; \
  else \
  echo "ERROR: Could not find build output" && \
  exit 1; \
  fi

# Rename _shell.html to index.html if needed (TanStack Start SPA mode)
RUN if [ -f "/app/final_build/_shell.html" ] && [ ! -f "/app/final_build/index.html" ]; then \
  mv /app/final_build/_shell.html /app/final_build/index.html; \
  fi

# Stage 2: Production with Nginx
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built files from builder
COPY --from=builder /app/final_build /usr/share/nginx/html

# Ensure permissions are correct
RUN chown -R nginx:nginx /usr/share/nginx/html

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
