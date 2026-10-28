<div align="center">

# Autonomous AI Desktop Platform

### Multi-Agent Orchestration & Universal Context Workspace

[![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8D8?logo=tauri&logoColor=white)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-Tokio_Async-DEA584?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Windows-0078D6)](https://github.com/Great-YUDZZ/Agentic-APP)
[![License](https://img.shields.io/badge/License-MIT-4ade80)](LICENSE)

*Aplikasi desktop modern, aman, dan ringan untuk orkestrasi agen AI mandiri, kolaborasi tim multi-agen paralel, dan manajemen basis pengetahuan universal berbasis markdown.*

</div>

---

## Unduh dan Rilis Siap Pakai (v0.2.0)

Paket instalasi dan berkas binari mandiri untuk Linux dan Windows tersedia secara langsung pada rilis resmi. Anda dapat mengunduh berkas yang sesuai dengan sistem operasi yang digunakan:

| Sistem Operasi | Tipe Berkas | Deskripsi | Tautan Unduh |
| :--- | :--- | :--- | :--- |
| **Linux (Debian/Ubuntu/Mint)** | `.deb` | Paket instalasi native berbasis Debian (4.8 MB) | [Unduh .deb](https://github.com/Great-YUDZZ/Agentic-APP/releases/download/v0.2.0/Agentic.Native.Hub_0.2.0_amd64.deb) |
| **Linux (Universal Portable)** | `.AppImage` | Berkas mandiri tanpa perlu instalasi, langsung jalan (109 MB) | [Unduh .AppImage](https://github.com/Great-YUDZZ/Agentic-APP/releases/download/v0.2.0/Agentic.Native.Hub_0.2.0_amd64.AppImage) |
| **Linux (Binari Arsip)** | `.zip` | Arsip binari stripped dengan desktop launcher (4.7 MB) | [Unduh .zip](https://github.com/Great-YUDZZ/Agentic-APP/releases/download/v0.2.0/agentic-native-hub-v0.2.0-linux-x86_64.zip) |
| **Windows (x64)** | `.exe` | Installer wizard mandiri berbasis NSIS | [Unduh .exe](https://github.com/Great-YUDZZ/Agentic-APP/releases/download/v0.2.0/Agentic-Native-Hub_0.2.0_x64-setup.exe) |
| **Windows (x64)** | `.msi` | Paket instalasi Windows Installer MSI | [Unduh .msi](https://github.com/Great-YUDZZ/Agentic-APP/releases/download/v0.2.0/Agentic-Native-Hub_0.2.0_x64_en-US.msi) |
| **Semua Platform** | GitHub Releases | Halaman daftar rilis lengkap dengan catatan versi | [Buka Rilis v0.2.0](https://github.com/Great-YUDZZ/Agentic-APP/releases/tag/v0.2.0) |

### Petunjuk Instalasi dan Menjalankan

#### 1. Linux Debian / Ubuntu / Mint (.deb)
```bash
# Instal paket deb menggunakan dpkg
sudo dpkg -i Agentic.Native.Hub_0.2.0_amd64.deb

# Jika ada dependensi sistem yang belum terpenuhi, perbaiki dengan perintah berikut:
sudo apt-get install -f
```

#### 2. Linux AppImage (Portabel Universal)
```bash
# Berikan izin eksekusi pada berkas AppImage
chmod +x Agentic.Native.Hub_0.2.0_amd64.AppImage

# Jalankan aplikasi langsung
./Agentic.Native.Hub_0.2.0_amd64.AppImage
```

#### 3. Linux Binari Zip
```bash
# Ekstrak arsip zip
unzip agentic-native-hub-v0.2.0-linux-x86_64.zip -d agentic-native-hub
cd agentic-native-hub

# Jalankan binari
./agentic-native-hub
```

#### 4. Windows Installer (.exe)
Unduh berkas `Agentic-Native-Hub_0.1.0_x64-setup.exe`, klik dua kali untuk membuka wizard instalasi, lalu ikuti petunjuk pemasangan hingga selesai.

### Verifikasi Integritas Berkas (SHA-256)

Untuk memastikan berkas yang diunduh lengkap dan tidak mengalami modifikasi, bandingkan nilai checksum berikut:

```
e4b041590ea3d3837964e7bab7b62e21306c236d581e32c399f98c4777fddefc  Agentic Native Hub_0.1.0_amd64.AppImage
f326f5bb842b8f2b2bbf6152f990e1ef6b20f02854050d3b9e39b62380da0604  Agentic Native Hub_0.1.0_amd64.deb
31c9758d1b8db2c47ea26ccf264c2bbb9e1e301f6d67ba077e8c5a5ab03acb85  agentic-native-hub-v0.1.0-linux-x86_64.zip
```

Perintah verifikasi di terminal Linux:
```bash
sha256sum -c SHA256SUMS.txt
```

---

## 1. Gambaran Umum

Aplikasi ini dirancang dari kebutuhan nyata akan sebuah pusat kerja desktop yang mampu mengoperasikan berbagai model kecerdasan buatan secara mandiri, terstruktur, dan tetap berada dalam kendali penuh pengguna di lingkungan komputer lokal.

Saat ini interaksi dengan model bahasa besar sering kali terbatas pada kolom obrolan konvensional yang pasif, di mana pengguna harus menyalin hasil kode, mengeksekusinya secara manual di terminal, dan bolak-balik memeriksa kesalahan sintaksis. Aplikasi ini hadir untuk menjembatani keterbatasan tersebut dengan menghadirkan studio rekayasa perangkat lunak mandiri. Di dalamnya, beberapa agen AI spesialis dapat bekerja secara simultan, merumuskan perencanaan bersama, menulis kode, memvalidasi perbedaan perubahan berkas, hingga menjalankan perintah terminal secara aman melalui mekanisme izin bertingkat.

Selain kemampuan eksekusi kode, aplikasi ini mengintegrasikan sistem basis pengetahuan berbasis markdown dengan filosofi Universal Context Vault, sehingga setiap catatan, konteks instruksi, dan dokumentasi arsitektur proyek dapat saling terhubung dan terbaca oleh AI tanpa kehilangan konteks kerja.

---

## 2. Tiga Mode Kerja Utama

Aplikasi ini membagi alur kerja ke dalam tiga mode terpadu yang dapat diakses langsung dari antarmuka:

### Mode 1: Clean Chatbot (Asisten Percakapan Cepat)
Mode ini difokuskan untuk tanya jawab kilat, analisis teks, atau eksplorasi ide tanpa beban konfigurasi yang rumit:
- **Deteksi Model Otomatis**: Mendeteksi seluruh model yang tersedia dari endpoint aktif secara dinamis, baik dari penyedia layanan cloud maupun server lokal.
- **Dynamic Model Selector**: Pemilih model interaktif yang terpasang di atas kolom input dengan fitur pencarian instan, memudahkan peralihan antar-model tanpa harus masuk ke menu pengaturan.
- **Streaming Token Halus**: Jawaban dari model ditampilkan kata per kata dengan perender format Markdown dan blok kode bersintaksis rapi.
- **Penyematan Konteks**: Mendukung penambahan dokumen teks, berkas kode sumber, serta gambar secara langsung melalui tombol lampiran sebelum pesan dikirimkan.

### Mode 2: Autonomous Agent (Agen Mandiri dengan Human-in-the-Loop)
Mode kerja otonom yang mendelegasikan satu target spesifik kepada satu agen khusus:
- **Rantai Penalaran Transparan**: Akordeon penalaran yang memperlihatkan alur berpikir agen, langkah teknis yang direncanakan, dan kalkulasi penggunaan token.
- **Gerbang Keamanan Human-in-the-Loop**: Tindakan sensitif seperti penulisan berkas baru atau eksekusi perintah shell wajib melewati persetujuan eksplisit pengguna sebelum benar-benar dijalankan.
- **Mode Eksekusi Bertingkat**: Pengguna dapat memilih mode meminta izin untuk tindakan berisiko atau mode otonom penuh bagi lingkungan pengujian yang terisolasi.
- **Pembuat Agen Kustom**: Fasilitas untuk merancang agen khusus dengan peran, instruksi sistem, dan keterampilan unik sesuai kebutuhan spesifik proyek.

### Mode 3: Build Studio (Multi-Agent Squad Room)
Studio kolaborasi rekayasa perangkat lunak paralel di mana beberapa agen bekerja bersama layaknya sebuah tim developer:
- **Diskusi Tim Multi-Agen**: Ruang kolaborasi di mana Lead Architect, Coder Agent, Reviewer Agent, dan Tester Subagent berdiskusi secara bergiliran menyusun rencana, membagi tugas ke dalam subtugas, dan saling mengaudit hasil kerja.
- **Hierarki Pohon Visual DAG**: Representasi grafis visual yang menampilkan garis komando orkestrator dan status operasional masing-masing agen pekerja.
- **Papan Manajemen Tugas Kanban**: Papan pemantauan tugas empat kolom (Backlog, In Progress, In Review, Done) yang bergerak secara otomatis mengikuti kemajuan kerja tim.
- **Terminal Shell Interaktif**: Laci terminal terintegrasi berbasis shell lokal untuk meninjau log keluaran agen dan menjalankan perintah verifikasi secara langsung.
- **Peninjau Kode & Diff Viewer**: Penampil perbedaan kode berdampingan (side-by-side diff) yang memungkinkan pengguna meninjau baris kode yang diubah sebelum menerapkan perubahan fisik ke berkas proyek.

---

## 3. Fitur Unggulan: Universal Context Vault

Konsep basis pengetahuan universal yang mengadopsi standar keterhubungan wikilink ala Obsidian untuk mengelola seluruh memori dan konteks proyek:

- **Visualisasi D3 Wikilink Graph**: Kanvas graf interaktif berkecepatan tinggi yang memetakan jejaring relasi antar-catatan markdown dan tag, dilengkapi pengelompokan warna semantik (Hub, Arsitektur, UI, Safety, Multi-Agent, Vault) serta pengungkapan judul bertahap yang hanya muncul saat pengguna memperbesar tampilan (zoom in).
- **Jejak Audit Berkas (.audit.jsonl)**: Pencatatan otomatis setiap kali berkas dibuat, dimodifikasi, dipindahkan, atau dihapus oleh agen, memberikan transparansi riwayat mutasi berkas secara kronologis.
- **Tempat Sampah (.trash/) & Kebijakan Retensi**: Berkas yang disetujui untuk dihapus tidak langsung dimusnahkan secara permanen dari sistem berkas, melainkan dipindahkan ke folder sampah terisolasi dan dapat dipulihkan kapan saja.
- **Panel Persetujuan Hapus (Approval Panel)**: Panel verifikasi khusus untuk meninjau permintaan penghapusan berkas dari agen AI, lengkap dengan pratinjau isi dokumen dan alasan penghapusan.
- **Navigasi Sisi Kiri Terpadu**: Seluruh menu navigasi Context Vault diletakkan pada bilah sisi kiri vertikal, menjaga area kanvas di atas tetap bersih dan lapang.

---

## 4. Arsitektur Teknis & Standar Rekayasa

Pengembangan aplikasi ini mengedepankan aspek keandalan, efisiensi konsumsi memori, dan keamanan eksekusi lokal:

- **Desktop Runtime**: Menggunakan framework Tauri 2.0 yang memanfaatkan webview native sistem operasi, menghasilkan ukuran binari yang sangat kecil dan konsumsi memori RAM yang jauh lebih hemat dibandingkan platform berbasis Chromium tradisional.
- **Mesin Backend Rust & Tokio**: Seluruh penanganan proses latar belakang, koneksi jaringan asinkron, pemantauan sistem berkas, dan komunikasi antar-proses (IPC) dikelola menggunakan bahasa Rust dengan runtime Tokio.
- **Isolasi Keamanan Sandbox**: Jalur akses berkas dibatasi secara ketat di dalam ruang lingkup direktori kerja proyek (workspace confinement), secara aktif mencegah upaya manipulasi direktori keluar dari batas yang diizinkan (directory traversal).
- **Frontend Modern & Anti-Slop Design**: Dibangun menggunakan React 19, TypeScript, dan Tailwind CSS dengan mematuhi prinsip Flat Design Master. Tampilan menggunakan permukaan solid dengan kontras netral yang rapi, tanpa gradien warna-warni yang berlebihan, tanpa efek blur layar penuh yang memberatkan kartu grafis, dan tanpa bayangan tebal.
- **Persistensi Data SQLite Lokal**: Seluruh sesi percakapan, kunci API terenkripsi, catatan riwayat tugas, dan konfigurasi preferensi pengguna disimpan pada basis data SQLite thread-safe di komputer lokal pengguna.

---

## 5. Struktur Direktori Proyek

```
Agentic/
├── src-tauri/                     # Lapisan Backend Desktop Native (Rust & Tokio)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── db/                    # Skema basis data SQLite dan kueri persistensi
│       ├── providers/             # Klien penyedia API (Gemini, Claude, OpenAI, Ollama)
│       ├── engine/                # Runtime orkestrasi agen, sandbox tools, dan IPC
│       └── vault/                 # Modul audit, graf wikilink, dan pengelola trash
└── src/                           # Lapisan Antarmuka Pengguna (React 19 + TypeScript)
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── components/
        │   ├── chatbot/           # Antarmuka Chatbot dan pemilih model dinamis
        │   ├── agent/             # Antarmuka Single Agent dengan panel HITL
        │   ├── build/             # Antarmuka Build Studio (Diskusi, Kanban, Pohon DAG, Diff)
        │   ├── vault/             # Komponen Context Vault (Grafik D3, Audit, Trash, Approvals)
        │   ├── layout/            # Bilah TitleBar dan Sidebar navigasi vertikal
        │   ├── terminal/          # Panel laci terminal interaktif
        │   ├── settings/          # Pengaturan sistem dan pengelola kunci API
        │   └── common/            # Empat status batas (Skeleton, Empty, Error, Toast)
        ├── store/                 # Pengelola state aplikasi reaktif (Zustand)
        └── types/                 # Definisi tipe TypeScript yang ketat
```

---

## 6. Catatan Rekayasa & Keseimbangan Desain

Dalam membangun platform rekayasa berbasis AI native seperti ini, selalu ada titik keseimbangan yang perlu dijaga antara tingkat otonomi agen dan kepastian kontrol pengguna. Menyerahkan seluruh wewenang penulisan berkas dan eksekusi terminal secara otomatis memang mempercepat alur kerja, namun risiko kesalahan modifikasi kode juga meningkat. Oleh karena itu, arsitektur aplikasi ini sengaja menempatkan gerbang persetujuan Human-in-the-Loop dan pelindung folder tempat sampah sebagai pengaman utama, sehingga pengguna dapat menikmati kenyamanan kolaborasi agen tanpa khawatir kehilangan berkas penting atau mengalami kerusakan repositori.

---

## Lisensi

Didistribusikan di bawah lisensi resmi [MIT](LICENSE).
