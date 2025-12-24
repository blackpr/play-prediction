# Multi-stage build for Play Prediction Backend

# Stage 1: Build
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build

# Stage 2: Production
FROM node:24-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install production dependencies AND drizzle-kit (needed for migrations)
RUN npm ci --only=production && npm install drizzle-kit

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Copy migrations folder (drizzle-kit will use DATABASE_URL from env)
COPY drizzle ./drizzle

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nodejs -u 1001 && \
  chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"]
