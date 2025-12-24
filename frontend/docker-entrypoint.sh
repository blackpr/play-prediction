#!/bin/sh
set -e

# This script injects environment variables into the built JavaScript files at runtime
# This allows the same Docker image to be used across different environments

echo "Injecting environment variables..."

# Find all JS files in the build directory and replace placeholder with actual env var
find /usr/share/nginx/html -type f -name "*.js" -exec sed -i \
  "s|VITE_API_URL_PLACEHOLDER|${VITE_API_URL}|g" {} \;

echo "Environment variables injected successfully"

# Execute the CMD
exec "$@"
