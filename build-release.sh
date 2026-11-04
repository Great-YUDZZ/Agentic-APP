#!/usr/bin/env bash
set -e

export PATH="$HOME/.cargo/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Building Nodra from $SCRIPT_DIR..."

cd "$SCRIPT_DIR"
npm run build

cd "$SCRIPT_DIR/src-tauri"
cargo build --release --bin nodra

echo "Release build completed."
