#!/usr/bin/env bash
# Node lives in ~/.local on this machine (not on the system PATH).
export PATH="/Users/azimuth/.local/node/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
exec node node_modules/next/dist/bin/next dev --webpack -p "${PORT:-5200}"
