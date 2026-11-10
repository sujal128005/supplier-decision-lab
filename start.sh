#!/bin/sh
cd "$(dirname "$0")"
if command -v node >/dev/null 2>&1; then
  node server.js
else
  echo "Node.js not found, using Python. Open http://localhost:8080"
  python3 -m http.server 8080
fi
