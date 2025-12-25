#!/bin/sh
set -e

# This script injects environment variables into the built JavaScript files at runtime
# This allows the same Docker image to be used across different environments

# #region agent log
echo "[DEBUG LOG] ===== DOCKER ENTRYPOINT START ====="
echo "[DEBUG LOG] Current time: $(date)"
echo "[DEBUG LOG] Contents of /usr/share/nginx/html:"
ls -la /usr/share/nginx/html
echo "[DEBUG LOG] Checking for index.html: $([ -f '/usr/share/nginx/html/index.html' ] && echo 'EXISTS' || echo 'NOT FOUND')"
if [ -f "/usr/share/nginx/html/index.html" ]; then
  echo "[DEBUG LOG] First 300 chars of index.html:"
  head -c 300 /usr/share/nginx/html/index.html
fi
echo "[DEBUG LOG] Environment variable VITE_API_URL: ${VITE_API_URL:-NOT_SET}"
# #endregion

echo "Injecting environment variables..."

# Find all JS files in the build directory and replace placeholder with actual env var
find /app/www -type f -name "*.js" -exec sed -i \
  "s|VITE_API_URL_PLACEHOLDER|${VITE_API_URL}|g" {} \;

echo "Environment variables injected successfully"

# #region agent log
echo "[DEBUG LOG] ===== DOCKER ENTRYPOINT END ====="
# #endregion

# Execute the CMD
exec "$@"
