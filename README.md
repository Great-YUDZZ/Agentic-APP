# Agentic Native Hub

> **Autonomous AI Native Hub**: Platform desktop modern untuk orkestrasi agen AI mandiri, kolaborasi multi-agent squad, dan antarmuka percakapan AI berkecepatan tinggi yang dibangun dengan **Tauri 2.0**, **React 19**, dan **Rust Tokio Async Engine**.

---

## Tentang Aplikasi Ini

**Agentic Native Hub** adalah ruang kerja (*workspace*) AI lokal yang dirancang untuk menjembatani interaksi manusia dengan berbagai model kecerdasan buatan (LLM) secara aman, terisolasi, dan berkinerja tinggi. 

Aplikasi ini bukan sekadar aplikasi chat biasa, melainkan sebuah **studio rekayasa multi-agen otonom**. Pengguna dapat mendelegasikan tugas rumit (seperti riset arsitektur kode, penulisan program, audit keamanan sistem, hingga eksekusi perintah terminal terkontrol) kepada tim agen AI spesialis yang dapat berdiskusi dan bekerja sama secara paralel.

### Masalah yang Diselesaikan:
1. **Ketergantungan Ekosistem Tertutup**: Banyak platform AI mengunci pengguna pada satu penyedia. Agentic Native Hub mendukung multi-provider: Google Gemini, OpenAI, Anthropic Claude, model lokal Ollama, hingga custom OpenAI-compatible proxy endpoint.
2. **Ketiadaan Pengawasan Keamanan (HITL)**: Menjalankan agen AI yang memiliki akses ke terminal atau berkas sering kali berisiko. Agentic Native Hub menerapkan kebijakan **Human-in-the-Loop (HITL)** dengan gerbang persetujuan manual serta **Path Confinement Sandbox** di lapisan Rust native untuk mencegah eksfiltrasi berkas di luar ruang kerja.
3. **Kolaborasi Paralel Nyata**: Menyediakan ruang diskusi tim agen di mana arsitek, programmer, dan tester bertukar pesan secara bergantian (*turn-taking*) untuk menyelesaikan tujuan proyek bersama.

---

## 3 Mode Utama Aplikasi

### 1. Mode Clean Chatbot
- Antarmuka obrolan bersih, cepat, dan responsif.
- Deteksi dinamis model AI dari endpoint aktif tanpa perlu konfigurasi ulang.
- Dukungan streaming response token-by-token dengan rendering sintaksis kode Markdown.
- Penyematan konteks berkas (teks, kode sumber, gambar) langsung melalui tombol plus (+).

### 2. Mode Autonomous Single Agent
- Menjalankan satu agen AI spesialis untuk mengeksekusi tujuan spesifik (*project goal*).
- Transparansi penalaran (*Chain of Thought*) dengan akordeon penalaran dan token meter.
- **Human-in-the-Loop Gate**: Eksekusi perintah shell, manipulasi file, dan pemanggilan tool eksternal dapat diatur ke mode persetujuan manual (*Ask for approval*) atau *Strict*.

### 3. Mode Build Studio (Multi-Agent Squad Room)
- **Multi-Agent Discussion**: Ruang kolaborasi di mana beberapa agen spesialis berdiskusi secara bergantian (*turn-taking*) menyusun rencana, membagi tugas, dan mengevaluasi hasil kerja tim.
- **Agent Hierarchy DAG Tree**: Visualisasi struktur hierarki agen dan subagen dengan status operasional langsung.
- **Task Kanban Board**: Papan tugas visual 4 kolom (Backlog, In Progress, In Review, Done) yang diperbarui secara reaktif oleh agen.
- **Interactive Terminal Drawer**: Terminal bash terintegrasi untuk melihat log eksekusi, menjalankan perintah langsung, dan memantau status sistem.
- **Code Review & Diff Viewer**: Peninjau perbedaan kode sebelum dan sesudah modifikasi dengan opsi terapkan langsung ke berkas fisik (*Apply to File*).

---

## Filosofi Desain & Standar Visual (Flat Design)

Antarmuka dibangun dengan mengadopsi standar **Flat Design Minimalist**:
- **True Solid Surfaces**: Latar kanvas utama `#212121`, Sidebar `#171717`, dan Kartu/Dock `#2f2f2f`.
- **Anti-AI Slop**: Tanpa gradien warna-warni ungu-biru, tanpa blur layar penuh (*no full-screen blur abuse*), dan tanpa bayangan tebal. Struktur visual murni dibangun dengan kontras permukaan solid dan garis batas 1px.
- **Floating Input Dock 2-Tingkat**: Input obrolan mengapung di bagian bawah dengan radius `rounded-3xl` dan tombol aksi berukuran seragam 32px (`h-8`).
- **Collapsible Squad Room**: Panel tim agen dapat disembunyikan (*hide ke atas*) agar kanvas percakapan memiliki ruang pandang yang lega.
- **4 Boundary States**: Setiap modul dinamis dilengkapi dengan *Loading Skeleton*, *Empty State*, *Error Boundary*, dan *Toast Feedback*.

---

## Arsitektur Teknis

```
Agentic/
├── src-tauri/                     # Rust Native Backend (Tauri 2.0)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── db/                    # Persistensi SQLite thread-safe lokal
│       ├── providers/             # Client bridge Gemini, OpenAI, Claude, Ollama
│       ├── engine/                # Tokio async orchestrator & sandbox tool runner
│       └── ipc/                   # Tauri IPC command bridge
└── src/                           # Frontend React 19 + Vite
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── components/
        │   ├── chatbot/           # Mode Chatbot & Model Pill Selector
        │   ├── agent/             # Mode Single Agent & HITL Clearance
        │   ├── build/             # Mode Build Studio, Kanban, DAG Tree, Diff Viewer
        │   ├── layout/            # TitleBar & Sidebar navigasi
        │   ├── terminal/          # Terminal drawer interaktif (bash)
        │   ├── skills/            # Modal Hub manajemen skills agen
        │   └── common/            # 4 Boundary States & Attachment Chips
        └── store/                 # State management reaktif menggunakan Zustand
```

---

## Petunjuk Menjalankan Aplikasi

### Prasyarat Sistem:
- **Node.js**: Versi 18 ke atas dan npm
- **Rust Toolchain**: `cargo` dan `rustc` versi 1.78 ke atas
- **Dependensi Linux** (untuk kompilasi Tauri):
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
  ```

### Menjalankan Mode Pengembangan:
```bash
# 1. Pasang dependensi frontend
npm install

# 2. Jalankan preview frontend browser
npm run dev

# 3. Jalankan aplikasi desktop native penuh (Tauri + Rust)
npm run tauri dev
```

### Membangun Paket Biner Rilis (Production Build):
```bash
npm run tauri build
```
Biner aplikasi desktop siap pakai dan paket instalasi `.deb` akan dihasilkan pada direktori `src-tauri/target/release/bundle/`.

---

## Lisensi

Didistribusikan di bawah lisensi [MIT](LICENSE).

Hak Cipta (c) [Great-YUDZZ](https://github.com/Great-YUDZZ).
