#!/bin/sh
set -e

# #region agent log
echo "[DEBUG LOG] ===== DOCKER ENTRYPOINT START ====="
echo "[DEBUG LOG] Current time: $(date)"
echo "[DEBUG LOG] Contents of /app/www:"
ls -la /app/www
echo "[DEBUG LOG] Checking for index.html: $([ -f '/app/www/index.html' ] && echo 'EXISTS' || echo 'NOT FOUND')"
if [ -f "/app/www/index.html" ]; then
  echo "[DEBUG LOG] First 300 chars of index.html:"
  head -c 300 /app/www/index.html
fi
echo "[DEBUG LOG] Environment variable VITE_API_URL: ${VITE_API_URL:-NOT_SET}"
# #endregion

echo "Injecting environment variables..."

# Debug: Count matches before replacement
MATCH_COUNT=$(grep -r "VITE_API_URL_PLACEHOLDER" /app/www | wc -l)
echo "[DEBUG LOG] Found $MATCH_COUNT files/instances containing 'VITE_API_URL_PLACEHOLDER'"

# Find all JS files in the build directory and replace placeholder with actual env var
find /app/www -type f -name "*.js" -exec sed -i \
  "s|VITE_API_URL_PLACEHOLDER|${VITE_API_URL}|g" {} \;

echo "Environment variables injected successfully"

# #region agent log
echo "[DEBUG LOG] ===== DOCKER ENTRYPOINT END ====="
# #endregion

# Execute the CMD
exec "$@"
