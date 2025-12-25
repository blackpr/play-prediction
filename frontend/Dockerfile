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
# Create nginx config inline to avoid cache issues
RUN printf 'user nginx;\n\
  worker_processes auto;\n\
  error_log /var/log/nginx/error.log warn;\n\
  pid /var/run/nginx.pid;\n\
  events { worker_connections 1024; }\n\
  http {\n\
  include /etc/nginx/mime.types;\n\
  default_type application/octet-stream;\n\
  log_format main "$remote_addr - $remote_user [$time_local] \\"$request\\" $status $body_bytes_sent \\"$http_referer\\" \\"$http_user_agent\\" \\"$http_x_forwarded_for\\"\";\n\
  access_log /var/log/nginx/access.log main;\n\
  sendfile on;\n\
  keepalive_timeout 65;\n\
  server {\n\
  listen 80;\n\
  server_name _;\n\
  root /app/www;\n\
  index index.html;\n\
  location / {\n\
  try_files $uri $uri/ /index.html;\n\
  }\n\
  location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {\n\
  expires 1y;\n\
  add_header Cache-Control "public, immutable";\n\
  }\n\
  }\n\
  }' > /etc/nginx/nginx.conf && \
  rm -rf /etc/nginx/conf.d/default.conf

# Copy built files from builder
RUN mkdir -p /app/www
COPY --from=builder /app/final_build /app/www

# Ensure permissions are correct
RUN chown -R nginx:nginx /app/www

# Copy environment variable injection script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 80

# Health check


# Run nginx with environment variable injection
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
