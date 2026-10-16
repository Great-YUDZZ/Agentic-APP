#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Building Agentic Native Hub from $SCRIPT_DIR..."

cd /home/yudz/Agentic
npm run build

cd /home/yudz/Agentic/src-tauri
touch src/main.rs
cargo build --release

TARGET_BIN="/home/yudz/.cache/target_agentic/release/agentic_native_hub"

if [ -f "$TARGET_BIN" ]; then
    echo "Deploying binary from $TARGET_BIN..."
    cp --remove-destination "$TARGET_BIN" /home/yudz/Agentic/agentic-native-hub
    chmod +x /home/yudz/Agentic/agentic-native-hub
    cp --remove-destination "$TARGET_BIN" /media/yudz/FLASHDISK/Agentic/agentic-native-hub
    chmod +x /media/yudz/FLASHDISK/Agentic/agentic-native-hub
    echo "Release build and deployment successful!"
else
    echo "Error: Target binary not found at $TARGET_BIN"
    exit 1
fi
