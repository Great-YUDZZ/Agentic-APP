#!/usr/bin/env bash
set -e

SRC_DIR="/media/yudz/FLASHDISK/Agentic"
MIRROR_DIR="/home/yudz/Agentic"
CACHE_TARGET="/home/yudz/.cache/target_agentic"
RELEASE_DIR="$SRC_DIR/release"
MIRROR_RELEASE_DIR="$MIRROR_DIR/release"

echo "=== Memulai Pemaketan Rilis Agentic Native Hub ==="

# 1. Sinkronisasi sumber daya dari flashdisk ke mirror build lokal
echo "1. Menyinkronkan file ke $MIRROR_DIR..."
rsync -av --exclude=node_modules --exclude=target "$SRC_DIR/src/" "$MIRROR_DIR/src/"
rsync -av --exclude=target "$SRC_DIR/src-tauri/" "$MIRROR_DIR/src-tauri/"
rsync -av "$SRC_DIR/package.json" "$MIRROR_DIR/package.json"
rsync -av "$SRC_DIR/agentic-native-hub.desktop" "$MIRROR_DIR/agentic-native-hub.desktop"

# 2. Build frontend
echo "2. Mengompilasi frontend React 19..."
cd "$MIRROR_DIR"
npm run build

# 3. Build biner dan bundles dengan Tauri
echo "3. Membangun installer biner (.deb, .AppImage) via Tauri..."
cd "$MIRROR_DIR"
if [ -f "$HOME/.tauri/agentic.key" ]; then
    export TAURI_SIGNING_PRIVATE_KEY="$(cat $HOME/.tauri/agentic.key)"
    export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="agentic_native_hub_key_2026"
fi
# Jalankan tauri build untuk bundler deb dan appimage
npx tauri build --bundles deb,appimage

# 4. Siapkan direktori output rilis
echo "4. Menyiapkan direktori rilis di $RELEASE_DIR..."
mkdir -p "$RELEASE_DIR"
mkdir -p "$MIRROR_RELEASE_DIR"
rm -f "$RELEASE_DIR"/* "$MIRROR_RELEASE_DIR"/*

# 5. Salin paket .deb
DEB_FILE=$(find "$CACHE_TARGET/release/bundle/deb" -name "*.deb" | head -n 1)
if [ -n "$DEB_FILE" ] && [ -f "$DEB_FILE" ]; then
    echo "Menyalin .deb: $DEB_FILE"
    cp "$DEB_FILE" "$RELEASE_DIR/"
    cp "$DEB_FILE" "$MIRROR_RELEASE_DIR/"
else
    echo "Peringatan: File .deb tidak ditemukan di $CACHE_TARGET/release/bundle/deb"
fi

# 6. Salin paket .AppImage
APPIMAGE_FILE=$(find "$CACHE_TARGET/release/bundle/appimage" -name "*.AppImage" | head -n 1)
if [ -n "$APPIMAGE_FILE" ] && [ -f "$APPIMAGE_FILE" ]; then
    echo "Menyalin .AppImage: $APPIMAGE_FILE"
    cp "$APPIMAGE_FILE" "$RELEASE_DIR/"
    cp "$APPIMAGE_FILE" "$MIRROR_RELEASE_DIR/"
    chmod +x "$RELEASE_DIR"/*.AppImage
    chmod +x "$MIRROR_RELEASE_DIR"/*.AppImage
else
    echo "Peringatan: File .AppImage tidak ditemukan di $CACHE_TARGET/release/bundle/appimage"
fi

# 7. Siapkan paket portabel .zip
echo "7. Membuat arsip portabel .zip..."
BIN_SOURCE="$CACHE_TARGET/release/agentic_native_hub"
if [ -f "$BIN_SOURCE" ]; then
    TEMP_ZIP_DIR=$(mktemp -d -t agentic-zip-XXXXXX)
    PACKAGE_ROOT="$TEMP_ZIP_DIR/agentic-native-hub-v0.2.3-linux-x86_64"
    mkdir -p "$PACKAGE_ROOT"

    cp "$BIN_SOURCE" "$PACKAGE_ROOT/agentic-native-hub"
    chmod +x "$PACKAGE_ROOT/agentic-native-hub"
    cp "$SRC_DIR/agentic-native-hub.desktop" "$PACKAGE_ROOT/"
    cp "$SRC_DIR/src-tauri/icons/128x128.png" "$PACKAGE_ROOT/icon.png"

    cat << 'EOF' > "$PACKAGE_ROOT/run.sh"
#!/bin/sh
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
exec "$SCRIPT_DIR/agentic-native-hub" "$@"
EOF
    chmod +x "$PACKAGE_ROOT/run.sh"

    cat << 'EOF' > "$PACKAGE_ROOT/README.txt"
Agentic Native Hub - Portable Release (v0.2.3)
==============================================

Cara Menjalankan:
1. Pastikan file run.sh dan agentic-native-hub memiliki izin eksekusi:
   chmod +x run.sh agentic-native-hub
2. Jalankan aplikasi:
   ./run.sh
   atau
   ./agentic-native-hub

Integrasi Desktop Menu (Opsional):
- Salin agentic-native-hub.desktop ke ~/.local/share/applications/
- Salin icon.png ke ~/.local/share/icons/hicolor/128x128/apps/agentic-native-hub.png
EOF

    cd "$TEMP_ZIP_DIR"
    ZIP_NAME="agentic-native-hub-v0.2.3-linux-x86_64.zip"
    zip -r "$ZIP_NAME" "agentic-native-hub-v0.2.3-linux-x86_64"

    cp "$ZIP_NAME" "$RELEASE_DIR/"
    cp "$ZIP_NAME" "$MIRROR_RELEASE_DIR/"
    rm -rf "$TEMP_ZIP_DIR"
    echo "Arsip .zip berhasil dibuat: $ZIP_NAME"
fi

# 8. Hitung Checksums SHA256
echo "8. Menghasilkan file checksums SHA256..."
cd "$RELEASE_DIR"
sha256sum * > SHA256SUMS.txt
cp SHA256SUMS.txt "$MIRROR_RELEASE_DIR/"

echo "=== Pemaketan Rilis Berhasil Selesai! ==="
echo "Daftar file rilis di $RELEASE_DIR:"
ls -lh "$RELEASE_DIR"
