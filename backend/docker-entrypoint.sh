#!/bin/sh
set -e

# Start the API server
# We start it in the background so we can also start the worker
node dist/src/main.js &
API_PID=$!

# Optionally start the worker if enabled
if [ "$ENABLE_WORKER" = "true" ]; then
  echo "Starting worker..."
  node dist/src/worker.js &
  WORKER_PID=$!
fi

# Wait for any process to exit
# If one exits, we exit the whole container so generic restart policies kick in
wait -n

# Exit with status of process that exited first
exit $?
