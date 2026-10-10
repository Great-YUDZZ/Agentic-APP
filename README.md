# Agentic Native Hub

> **Autonomous AI Native Hub**: Platform desktop modern untuk orkestrasi agen AI mandiri, kolaborasi tim multi-agen (*multi-agent squad*), dan asisten rekayasa kode pintar yang dibangun dengan **Tauri 2.0**, **React 19**, dan **Rust Tokio Async Engine**.

---

## Tentang Aplikasi Ini

**Agentic Native Hub** adalah ruang kerja (*workspace*) desktop AI yang dirancang sebagai pusat kendali untuk mengoperasikan berbagai model kecerdasan buatan (LLM) secara mandiri, terstruktur, dan aman di lingkungan lokal komputer Anda.

Aplikasi ini melampaui antarmuka obrolan konvensional dengan menghadirkan **studio rekayasa multi-agen otonom**. Anda dapat mendelegasikan tugas perangkat lunak yang kompleks (seperti perencanaan arsitektur, pembuatan kode program, pengujian bug, peninjauan perbedaan kode, hingga eksekusi perintah terminal) kepada agen-agen AI spesialis yang dapat berdiskusi dan berkoordinasi secara otomatis untuk menuntaskan tujuan proyek (*project goal*).

Aplikasi ini mendukung berbagai penyedia model AI secara fleksibel: **Google Gemini**, **OpenAI**, **Anthropic Claude**, model lokal offline via **Ollama**, serta endpoint kustom mandiri (*OpenAI-compatible proxy*).

---

## Fitur Utama Aplikasi

### 1. Mode Clean Chatbot (Asisten Percakapan Cepat)
Mode percakapan langsung untuk tanya jawab cepat, brainstorming, atau analisis teks dan kode:
- **Deteksi Model Otomatis**: Mendeteksi seluruh daftar model AI yang tersedia dari endpoint aktif secara dinamis tanpa perlu memasukkan konfigurasi manual berulang kali.
- **Dynamic Model Selector Pill**: Pemilih model interaktif yang terpasang rapi di atas kolom chat, dilengkapi kotak pencarian instan untuk beralih antar-model dalam hitungan detik.
- **Streaming Response**: Menampilkan jawaban kata per kata secara halus (token-by-token) dengan perender sintaksis Markdown dan blok kode terformat rapi.
- **Penyematan Berkas & Gambar (Context Attachment)**: Unggah dokumen teks, berkas kode sumber, atau gambar langsung via tombol Plus (+) dengan pratinjau chip visual sebelum dikirimkan ke model.

---

### 2. Mode Autonomous Single Agent (Agen Mandiri & HITL)
Mode kerja otonom di mana satu agen spesialis fokus memecahkan target proyek langkah demi langkah:
- **Rantai Penalaran Transparan (Chain of Thought)**: Panel akordeon interaktif yang menampilkan proses berpikir agen, langkah logis yang diambil, serta indikator penggunaan token secara transparan.
- **Human-in-the-Loop (HITL) Clearance Gate**: Mekanisme pengamanan di mana aksi sensitif agen (seperti menjalankan perintah terminal atau memodifikasi berkas) wajib mendapatkan persetujuan pengguna terlebih dahulu melalui alert khusus sebelum dieksekusi.
- **Mode Eksekusi Bertingkat**: Pilihan fleksibel antara mode *Ask for approval* (meminta izin untuk aksi berbahaya) atau mode *Strict* (otonomi penuh terkontrol).
- **Custom Agent Creator**: Formulir pembuatan agen khusus dengan nama, peran unik, instruksi sistem kustom, dan pembagian keahlian (*skills*).

---

### 3. Mode Build Studio (Multi-Agent Squad Room)
Studio kolaborasi paralel di mana sekelompok agen spesialis bekerja bersama layaknya tim rekayasa perangkat lunak:
- **Multi-Agent Group Discussion**: Ruang diskusi kolaboratif di mana agen (misalnya Arsitek, Coder, Reviewer, dan Tester) berbicara secara bergantian (*turn-taking*) merumuskan solusi, membagi tugas, dan saling meninjau hasil sebelum kode ditulis.
- **Visual DAG Hierarchy Tree**: Diagram hierarki visual interaktif yang menampilkan rantai komando dari Lead Architect hingga subagen pekerja, lengkap dengan cincin status operasional (Idle, Thinking, Working, Complete).
- **Task Kanban Board**: Papan manajemen tugas 4 kolom (*Backlog*, *In Progress*, *In Review*, *Done*) yang diperbarui otomatis secara real-time berdasarkan progres kerja tim agen.
- **Interactive Terminal Drawer**: Laci terminal bash bawaan yang memungkinkan Anda menjalankan perintah shell secara langsung, melihat log eksekusi agen dengan badge berwarna (INFO, EXEC, WARN), multi-tab, riwayat perintah, dan fitur auto-scroll.
- **Code Review & Diff Viewer**: Peninjau visual perbedaan kode (side-by-side dan unified diff) yang otomatis membedah blok kode dari hasil diskusi agen, dilengkapi tombol satu-klik **Apply to File** untuk langsung memperbarui berkas proyek fisik.
- **Collapsible Squad Panel**: Panel daftar agen (*squad room*) dapat disembunyikan (*hide ke atas*) untuk memberikan ruang kerja kanvas obrolan yang jauh lebih luas dan bebas distraksi.

---

### 4. Ekosistem Pendukung & Alat Produktivitas
- **Skills Hub Management**: Pusat pengelolaan keahlian agen untuk memasang, mengaktifkan, atau mengimpor modul keterampilan (*skills*) baru, baik dalam cakupan lokal proyek maupun global sistem.
- **Interactive Slash Commands (`/`)**: Menu pintasan cepat yang muncul saat mengetik garis miring di kolom input (seperti `/plan`, `/review`, `/test`, `/terminal`, `/skills`, `/clear`, `/help`) dengan navigasi keyboard penuh.
- **Multi-Provider & API Key Manager**: Pengelola kredensial mandiri untuk menyimpan kunci API Gemini, OpenAI, Claude, DeepSeek, dan Ollama secara aman pada basis data SQLite lokal, dilengkapi fitur uji latensi koneksi (*Ping Tester*).
- **Sandbox Path Confinement**: Mesin eksekutor di lapisan Rust native yang mengisolasi seluruh operasi baca/tulis berkas agar tetap terkunci di dalam direktori kerja proyek, mencegah directory traversal ke berkas sistem di luar izin.
- **Project Picker & Workspace Selector**: Pengalih direktori kerja aktif dengan pemindaian otomatis proyek lokal pada sistem penyimpanan Anda.

---

## Struktur Direktori Proyek

```
Agentic/
├── src-tauri/                     # Backend Desktop Native (Tauri 2.0 & Rust Tokio)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── db/                    # Persistensi SQLite thread-safe lokal
│       ├── providers/             # Jembatan API provider (Gemini, Claude, OpenAI, Ollama)
│       ├── engine/                # Mesin orkestrasi multi-agen & sandbox runner aman
│       └── ipc/                   # Jembatan perintah Tauri IPC
└── src/                           # Frontend Antarmuka (React 19 + TypeScript + Tailwind)
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── components/
        │   ├── chatbot/           # Modul Chatbot & Dynamic Model Pill Selector
        │   ├── agent/             # Modul Single Agent & Approval Alert HITL
        │   ├── build/             # Modul Build Studio (Discussion, Kanban, DAG Tree, Diff Viewer)
        │   ├── layout/            # Komponen TitleBar & Sidebar navigasi
        │   ├── terminal/          # Terminal drawer interaktif (bash)
        │   ├── skills/            # Modal Hub manajemen skills agen
        │   └── common/            # State boundary (Skeleton, Empty State, Error, Toast)
        └── store/                 # Pengelola state reaktif (Zustand)
```

---

## Lisensi

Didistribusikan di bawah ketentuan lisensi [MIT](LICENSE).

Hak Cipta (c) [Great-YUDZZ](https://github.com/Great-YUDZZ).
