#!/usr/bin/env bash
set -euo pipefail

node /app/server/dist/index.js &
SERVER_PID=$!

cleanup() {
  if kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" || true
    wait "$SERVER_PID" || true
  fi
}

trap cleanup EXIT

node /app/cli/dist/index.js
