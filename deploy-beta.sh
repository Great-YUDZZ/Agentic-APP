#!/usr/bin/env bash
set -e

# deploy-beta.sh
# Skrip otomatisasi untuk menyalin, mengompilasi, dan memasang versi Beta ke laptop
# Target lokasi: /home/yudz/Agentic-Beta

SRC_DIR="/media/yudz/FLASHDISK/Agentic"
BETA_DIR="/home/yudz/Agentic-Beta"
CACHE_TARGET="/home/yudz/.cache/target_agentic"

echo "=== Memulai Deployment Versi Beta ke Laptop ==="

# 1. Pastikan direktori tujuan tersedia
mkdir -p "$BETA_DIR"

# 2. Sinkronisasi sumber daya dari flashdisk ke laptop
echo "1. Menyinkronkan file dari flashdisk ke $BETA_DIR..."
rsync -av --exclude=node_modules --exclude=target --exclude=backup_app_data --exclude=.git "$SRC_DIR/" "$BETA_DIR/"

cd "$BETA_DIR"

# 3. Pastikan dependensi npm terpasang
if [ ! -d "$BETA_DIR/node_modules" ]; then
    echo "2. Memasang dependensi npm di $BETA_DIR..."
    npm install
fi

# 4. Modifikasi konfigurasi tauri untuk identitas Beta
echo "3. Menyesuaikan konfigurasi identitas Beta..."
python3 -c "
import json

path = '$BETA_DIR/src-tauri/tauri.conf.json'
with open(path, 'r') as f:
    conf = json.load(f)

conf['productName'] = 'Agentic Native Hub Beta'
conf['identifier'] = 'com.agentic.nativehub.beta'
if 'app' in conf and 'windows' in conf['app'] and len(conf['app']['windows']) > 0:
    conf['app']['windows'][0]['title'] = 'Agentic Native Hub (Beta)'

with open(path, 'w') as f:
    json.dump(conf, f, indent=2)
"

# 5. Kompilasi frontend React
echo "4. Mengompilasi frontend React 19..."
npm run build

# 6. Kompilasi binary Rust
echo "5. Mengompilasi native Rust binary..."
cd "$BETA_DIR/src-tauri"
touch src/main.rs
source "$HOME/.cargo/env" 2>/dev/null || true
cargo build --release

# 7. Salin binary dan buat launcher script
echo "6. Menyiapkan biner dan skrip peluncur di $BETA_DIR..."
BIN_OUTPUT="$CACHE_TARGET/release/agentic_native_hub"

if [ ! -f "$BIN_OUTPUT" ]; then
    echo "Galat: File biner tidak ditemukan di $BIN_OUTPUT"
    exit 1
fi

cp -f "$BIN_OUTPUT" "$BETA_DIR/agentic-native-hub-beta"
chmod +x "$BETA_DIR/agentic-native-hub-beta"

cat << 'EOF' > "$BETA_DIR/run.sh"
#!/bin/sh
export AGENTIC_BETA=1
export WEBKIT_DISABLE_DMABUF_RENDERER=1
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
exec "$SCRIPT_DIR/agentic-native-hub-beta" "$@"
EOF
chmod +x "$BETA_DIR/run.sh"

# 8. Siapkan ikon aplikasi Beta
mkdir -p "$HOME/.local/share/icons/hicolor/128x128/apps"
cp -f "$BETA_DIR/src-tauri/icons/128x128.png" "$BETA_DIR/icon-beta.png"
cp -f "$BETA_DIR/src-tauri/icons/128x128.png" "$HOME/.local/share/icons/hicolor/128x128/apps/agentic-native-hub-beta.png"

# 9. Buat Desktop Shortcut di Laptop
echo "7. Membuat desktop shortcut di menu laptop..."
mkdir -p "$HOME/.local/share/applications"
cat << 'EOF' > "$HOME/.local/share/applications/agentic-native-hub-beta.desktop"
[Desktop Entry]
Version=1.0
Type=Application
Name=Agentic Native Hub (Beta)
GenericName=Autonomous AI Native Hub (Beta)
Comment=Autonomous AI Native Hub - Versi Pengujian Beta
Exec=/home/yudz/Agentic-Beta/run.sh
Icon=agentic-native-hub-beta
Terminal=false
Categories=Development;Utility;
StartupNotify=true
StartupWMClass=Agentic Native Hub Beta
Keywords=ai;agent;beta;llm;chat;
EOF

update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

echo "=== Deployment Versi Beta Berhasil! ==="
echo "Lokasi Aplikasi: $BETA_DIR"
echo "Biner Eksekusi: $BETA_DIR/agentic-native-hub-beta"
echo "Peluncur Desktop: ~/.local/share/applications/agentic-native-hub-beta.desktop"
echo "Silakan buka 'Agentic Native Hub (Beta)' dari menu aplikasi laptop Anda untuk pengujian."
