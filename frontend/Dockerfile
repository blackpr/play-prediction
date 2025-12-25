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
# #region agent log
RUN echo "[DEBUG LOG] Starting build at $(date)" && \
  echo "[DEBUG LOG] Node version: $(node --version)" && \
  echo "[DEBUG LOG] NPM version: $(npm --version)"
# #endregion
RUN npm run build
# #region agent log
RUN echo "[DEBUG LOG] Build completed at $(date)" && \
  echo "[DEBUG LOG] Listing /app directory:" && \
  ls -laR /app | head -100
# #endregion

# Prepare build artifacts
# #region agent log
RUN echo "[DEBUG LOG] Checking for build output directories:" && \
  echo "[DEBUG LOG] Checking /app/.output/public: $([ -d '/app/.output/public' ] && echo 'EXISTS' || echo 'NOT FOUND')" && \
  echo "[DEBUG LOG] Checking /app/dist/client: $([ -d '/app/dist/client' ] && echo 'EXISTS' || echo 'NOT FOUND')" && \
  echo "[DEBUG LOG] Checking /app/dist: $([ -d '/app/dist' ] && echo 'EXISTS' || echo 'NOT FOUND')"
# #endregion
RUN mkdir -p /app/final_build && \
  if [ -d "/app/.output/public" ]; then \
  echo "[DEBUG LOG] Found build in .output/public" && \
  echo "[DEBUG LOG] Contents:" && ls -la /app/.output/public && \
  cp -r /app/.output/public/* /app/final_build/; \
  elif [ -d "/app/dist/client" ]; then \
  echo "[DEBUG LOG] Found build in dist/client" && \
  echo "[DEBUG LOG] Contents:" && ls -la /app/dist/client && \
  cp -r /app/dist/client/* /app/final_build/; \
  elif [ -d "/app/dist" ]; then \
  echo "[DEBUG LOG] Found build in dist" && \
  echo "[DEBUG LOG] Contents:" && ls -la /app/dist && \
  cp -r /app/dist/* /app/final_build/; \
  else \
  echo "[DEBUG LOG] ERROR: Could not find build output" && \
  echo "[DEBUG LOG] Listing /app:" && ls -F /app && \
  exit 1; \
  fi
# #region agent log
RUN echo "[DEBUG LOG] Contents of /app/final_build after copy:" && \
  ls -la /app/final_build | head -50
# #endregion

# Rename _shell.html to index.html if needed (TanStack Start SPA mode)
# #region agent log
RUN echo "[DEBUG LOG] Checking for _shell.html: $([ -f '/app/final_build/_shell.html' ] && echo 'EXISTS' || echo 'NOT FOUND')" && \
  echo "[DEBUG LOG] Checking for index.html: $([ -f '/app/final_build/index.html' ] && echo 'EXISTS' || echo 'NOT FOUND')"
# #endregion
RUN if [ -f "/app/final_build/_shell.html" ] && [ ! -f "/app/final_build/index.html" ]; then \
  echo "[DEBUG LOG] Renaming _shell.html to index.html" && \
  mv /app/final_build/_shell.html /app/final_build/index.html && \
  echo "[DEBUG LOG] Rename successful"; \
  else \
  echo "[DEBUG LOG] Rename not needed or _shell.html not found"; \
  fi
# #region agent log
RUN echo "[DEBUG LOG] Final check - index.html exists: $([ -f '/app/final_build/index.html' ] && echo 'YES' || echo 'NO')" && \
  if [ -f "/app/final_build/index.html" ]; then \
  echo "[DEBUG LOG] First 200 chars of index.html:" && \
  head -c 200 /app/final_build/index.html; \
  fi
# #endregion

# Stage 2: Production with Nginx
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built files from builder
COPY --from=builder /app/final_build /usr/share/nginx/html
# #region agent log
RUN echo "[DEBUG LOG] Contents of /usr/share/nginx/html after copy from builder:" && \
  ls -la /usr/share/nginx/html && \
  echo "[DEBUG LOG] Checking for index.html: $([ -f '/usr/share/nginx/html/index.html' ] && echo 'EXISTS' || echo 'NOT FOUND')" && \
  if [ -f "/usr/share/nginx/html/index.html" ]; then \
  echo "[DEBUG LOG] First 200 chars of index.html in nginx html dir:" && \
  head -c 200 /usr/share/nginx/html/index.html; \
  fi
# #endregion

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
