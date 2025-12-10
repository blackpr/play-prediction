#!/bin/bash

# Configuration
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    echo "Stopping server (PID: $SERVER_PID)..."
    kill $SERVER_PID
  fi
  rm -f cookies.txt register.json login.json logout.json
}

trap cleanup EXIT

# Kill anything on port 4000
lsof -ti:4000 | xargs kill -9 2>/dev/null || true

# Start server
echo "Starting server..."
npm run dev:api > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server to be ready..."
tries=0
while ! nc -z localhost 4000; do
  sleep 1
  tries=$((tries+1))
  if [ $tries -gt 30 ]; then
    echo "Server failed to start"
    cat server.log
    kill $SERVER_PID
    exit 1
  fi
done
echo "Server is ready."

# Test variables
EMAIL="test_auth_$(date +%s)@example.com"
PASSWORD="SecurePassword123!"
COOKIE_FILE="cookies.txt"

# 1. Register
echo "Registering user $EMAIL..."
curl -s -X POST http://localhost:4000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\", \"password\":\"$PASSWORD\"}" > register.json

if grep -q "success\":true" register.json; then
  echo "Registration successful"
else
  echo "Registration failed"
  cat register.json
  kill $SERVER_PID
  exit 1
fi

# 2. Login
echo "Logging in..."
curl -s -X POST http://localhost:4000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\", \"password\":\"$PASSWORD\"}" \
  -c $COOKIE_FILE > login.json

if grep -q "success\":true" login.json; then
  echo "Login successful"
else
  echo "Login failed"
  cat login.json
  kill $SERVER_PID
  exit 1
fi

# Check cookie file is not empty (ignoring comments)
if grep -v "^#" $COOKIE_FILE | grep -q "."; then
  echo "Cookie received"
else
  echo "Warning: Cookie file might be empty of actual cookies"
  cat $COOKIE_FILE
fi

# 3. Logout
echo "Logging out..."
curl -s -X POST http://localhost:4000/v1/auth/logout \
  -b $COOKIE_FILE \
  -c $COOKIE_FILE > logout.json

if grep -q "success\":true" logout.json; then
  echo "Logout successful"
else
  echo "Logout failed"
  cat logout.json
  kill $SERVER_PID
  exit 1
fi

echo "All tests passed!"
