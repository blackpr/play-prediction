# Multi-stage build for Play Prediction Backend

# Stage 1: Build
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies first (for layer caching)
COPY package*.json ./
RUN npm install

# Copy all source files needed for TypeScript compilation
COPY tsconfig.json ./
COPY src ./src
COPY drizzle.config.ts ./drizzle.config.ts
COPY vitest.config.ts ./vitest.config.ts
COPY vitest.integration.config.ts ./vitest.integration.config.ts

# Build TypeScript to JavaScript
RUN npm run build

# Verify build output
RUN ls -la dist/src/ && test -f dist/src/main.js || (echo "Build failed: main.js not found" && exit 1)

# Stage 2: Production
FROM node:24-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install production dependencies AND drizzle-kit (needed for migrations)
RUN npm install --only=production && npm install drizzle-kit

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Copy migrations folder (drizzle-kit will use DATABASE_URL from env)
COPY drizzle ./drizzle

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nodejs -u 1001 && \
  chown -R nodejs:nodejs /app

# Copy entrypoint script and ensure it is executable and owned by the correct user
COPY --chown=nodejs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application via entrypoint script
CMD ["./docker-entrypoint.sh"]
