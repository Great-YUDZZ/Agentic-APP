# Changelog

Semua perubahan penting pada proyek Autonomous AI Native Hub dicatat dalam dokumen ini.

---

## [v0.4.5] - 2026-11-03

### Perbaikan Tampilan & Retensi Scroll Pengaturan
- **Perbaikan Retensi Posisi Scroll Tab Pengaturan (Scroll Reset & Remount)**:
  - Menyelesaikan masalah visual di mana konten bagian atas terpotong atau terdorong ke atas saat berpindah antar-tab di menu Pengaturan.
  - Menambahkan pengaturan ulang posisi scroll otomatis (`scrollTop = 0`) melalui ref kontainer setiap kali tab utama atau sub-tab model berganti.
  - Menerapkan kunci dinamis React (`key`) pada kontainer scroll agar komponen melakukan remounting bersih, memaksa engine WebKitGTK merender ulang seluruh layout kanvas tanpa menyisakan ruang kosong hitam.
  - Menetapkan warna latar belakang kanvas eksplisit (`bg-[#212121]`) pada kontainer scroll untuk mencegah tembus pandang kontras saat tema OLED aktif.
- **Sinkronisasi Versi Rilis Lengkap**:
  - Memperbarui seluruh konfigurasi paket instalasi, metadata Tauri, fallback UI, serta tautan rilis ke versi resmi v0.4.5.

---

## [v0.4.3] - 2026-11-03

### Perbaikan & Penyesuaian Dinamis
- **Pembacaan Versi Aplikasi Dinamis (Dynamic App Version)**:
  - Menggantikan string statis pada menu Pengaturan (sub-menu Application) dengan pemanggilan dinamis API resmi Tauri `getVersion()`.
  - Mengintegrasikan konstanta kompilasi `__APP_VERSION__` melalui Vite define dari `package.json` untuk inisialisasi instan sebelum pemanggilan asinkron selesai.
  - Memastikan teks versi dan notifikasi pengecekan pembaruan selalu akurat dan sinkron otomatis dengan versi rilis aplikasi tanpa risiko kelupaan edit manual.

---

## [v0.4.2] - 2026-11-03

### Peningkatan & Pengaturan Model Lokal
- **Penghapusan Runtime Ollama Bawaan**:
  - Aplikasi tidak lagi mengunduh atau menyertakan biner Ollama portabel secara otomatis di latar belakang.
  - Sistem beralih sepenuhnya ke integrasi bersih dengan layanan Ollama yang telah terpasang di sistem komputer pengguna (port 11434).
- **Menu Unduh Model Lokal Mandiri (Local Models Manager)**:
  - Penambahan sub-tab baru "Model Lokal (Offline)" pada menu Pengaturan (tab Models).
  - Kartu spesifikasi Liquid Foundation Model (LFM3 1.7B GGUF Q4_K_M, ~1.1 GB) dengan informasi fitur offline, penalaran, dan tanpa kunci API.
  - Tombol pengunduhan eksplisit atas kendali penuh pengguna lengkap dengan progress bar persentase streaming real-time.
  - Tombol penghapusan model terpasang untuk membebaskan ruang penyimpanan disk komputer secara instan.
  - Pemindai dan penampil model lokal lain yang terpasang pada instance Ollama sistem.
- **Perlindungan Chat dari Unduhan Latar Belakang Tanpa Izin**:
  - Mengirim pesan dengan model lokal yang belum terinstal kini tidak lagi mengunduh model secara diam-diam, melainkan menampilkan pesan panduan agar pengguna mengunduhnya terlebih dahulu melalui menu Pengaturan.

---

## [v0.4.1] - 2026-11-03

### Fitur Baru
- **Developer Activity Heatmap & Profile Statistics (GitHub Classic Green)**:
  - Menggantikan kurva garis ringkasan pada sub-tab Overview di menu Pengaturan (Usage & Analytics) dengan visualisasi kontribusi harian 365 hari bergaya GitHub.
  - Kisi matriks kontribusi 52 minggu x 7 hari yang responsif dengan palet hijau otentik GitHub (`#21262d`, `#0e4429`, `#006d32`, `#26a641`, `#39d353`), label bulan dinamis, indikator hari dalam seminggu (Sen, Rab, Jum), serta legenda Less hingga More.
  - Floating hover tooltip yang menyajikan jumlah token, jumlah permintaan, dan tanggal lengkap secara interaktif.
  - 5 Kartu Statistik Utama di bagian atas:
    - Total Tokens dalam setahun terakhir (format ringkas rb/jt).
    - Peak Day (rekor token tertinggi harian beserta tanggal kejadiannya).
    - Messages (total request dan interaksi percakapan setahun terakhir).
    - Current Streak (jumlah hari aktif berturut-turut saat ini beserta tanggal mulai).
    - Longest Streak (rekor rentang hari aktif berturut-turut terpanjang).
  - Bagian Insights & Most Active Teammates:
    - Insights: provider paling sering digunakan beserta persentase kontribusinya, model terfavorit, serta hari tersibuk dalam seminggu.
    - Most active teammates: papan peringkat konsumsi token per peran agen (Chatbot, Lead Architect, Coder Agent, dsb.) dengan badge inisial dan format token bersih.
- **Overhaul Pelacakan Penggunaan Token Menyeluruh (Unified Token Tracking)**:
  - Mengatasi keterbatasan penghitung token parsial dengan estimasi payload lengkap yang mencakup system prompt, riwayat percakapan, berkas lampiran, memori kontekstual, dan skema deklarasi tools.
  - Ekstraksi penggunaan token resmi (*ground truth*) dari objek respon streaming provider (Gemini usageMetadata, OpenAI/Ollama usage).
  - Skema SQLite `usage_history` diperluas dengan field `request_id`, `session_id`, `agent_role`, `cache_creation_tokens`, `cache_read_tokens`, dan `is_local`.
  - Penjaminan idempoten pencatatan token via `request_id` untuk mencegah penghitungan ganda saat terjadi retry.
- **Validasi Kunci API Nyata (Real API Key Ping & Validation)**:
  - Pengujian koneksi API key tidak lagi mengandalkan ping domain kosong.
  - Setiap provider (Gemini, OpenAI, Claude, DeepSeek, Groq, Mistral, OpenRouter, Ollama) diverifikasi secara nyata ke endpoint autentikasi resmi masing-masing.

---

## [v0.3.5] - 2026-11-03

### Perbaikan Bug & Peningkatan
- **Pembersihan Render Markdown AST**:
  - Penguraian token Markdown komprehensif pada gelembung percakapan (`FormattedMessage.tsx`) untuk mencegah bocornya karakter format mentah.
- **Penanganan Model Penalaran Lokal (Thinking Models)**:
  - Penangkapan multi-delta blok penalaran (`thinking` / `reasoning_content`) serta penyelesaian loop berpikir tanpa hang pada model lokal.

---

## [v0.3.4] - 2026-11-03

### Perbaikan Bug & Peningkatan Keandalan
- **Perbaikan Bug Upload Berkas Dokumen Word (.docx) & Pencegahan UI Freeze**:
  - Menyelesaikan masalah layar freeze/lag dan tampilan gelembung chat yang berubah menjadi kotak abu-abu raksasa kosong saat melampirkan berkas dokumen `.docx`.
  - Mengimplementasikan modul ekstraksi teks dokumen Word mandiri tanpa dependensi (`extractDocxText`) berbasis Web Standards (`DecompressionStream('deflate-raw')`):
    - Membedah struktur arsip PKZip internal dokumen Word secara langsung melalui Central Directory.
    - Mengekstrak teks murni, paragraf (`<w:p>`), pemisah baris/tab, serta tabel Word (`<w:tbl>`, `<w:tr>`, `<w:tc>`) menjadi format tabel Markdown terstruktur rapi.
    - Menguraikan entitas XML (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`) secara akurat.
- **Dukungan Dokumen Multi-Format Aman & Sanitasi Konten Biner**:
  - Ekstraksi teks spreadsheet Excel (`.xlsx`) langsung dari string bersama (`xl/sharedStrings.xml`).
  - Ekstraksi teks aman untuk dokumen PDF (`.pdf`) dari stream teks ASCII/UTF-8 tanpa menyuntikkan byte null atau data biner rusak.
  - Pemblokiran dan isolasi cerdas berkas arsip/biner murni (`.zip`, `.tar`, `.exe`, `.bin`, `.iso`, dll.): sistem tidak lagi memuat karakter biner mentah ke prompt model, melainkan memberikan penanda metadata berkas yang aman.
  - Pembatasan panjang karakter aman (maksimal 80.000 karakter per berkas) untuk mencegah token overflow dan lonjakan memori.
- **Komponen Tampilan Pesan Pengguna Modern (UserMessageBubble)**:
  - Menggantikan render teks mentah panjang dengan komponen terstruktur `UserMessageBubble`.
  - Menampilkan teks instruksi pengguna secara bersih, diikuti kapsul badge lampiran kompak (`[proposal.docx · 120 KB]`).
  - Menyediakan tombol pratinjau teks lampiran yang dapat dilipat (*collapsible preview*) dengan area gulir terisolasi (`max-h-48`) sehingga tidak merusak tata letak gelembung chat.
  - Diterapkan secara seragam di Mode Chatbot (`ChatContainer.tsx`), Mode Agent (`AgentWorkspace.tsx`), dan Mode Build Studio (`MultiAgentDiscussion.tsx`).

---

## [v0.3.2] - 2026-11-03

### Fitur Baru
- **Pemantau Penggunaan Token & Analitik (Usage & Analytics)**:
  - Tab baru "Usage & Tokens" di dalam modal Pengaturan dengan arsitektur dua sub-tab: Overview dan Details.
  - Sub-tab Overview menyajikan 4 kartu metrik utama (Total Requests, Total Input Tokens, Cached Tokens, Output Tokens), Peta Topologi Provider Aktif (diagram simpul visual antar hub dan provider), serta tabel Recent Requests lengkap dengan status keberhasilan, nama model, indikator token masuk/keluar panah naik-turun, dan penghitung waktu relatif.
  - Sub-tab Details menyajikan grafik garis/area interaktif berbasis SVG kurva halus (Bezier) dengan penyesuaian rentang waktu (Today, 24h, 7D, 30D, 60D, All), toggle metrik Tokens/Requests, serta tabel rincian konsumsi per model dengan fitur pencarian dan pengurutan multi-kolom.
  - Arsitektur rollup harian SQLite mandiri (tabel `usage_history` dan `usage_daily`) yang terhubung langsung ke aliran streaming chat tanpa estimasi biaya uang.
- **Background Local Engine & LFM3 Model Downloader**:
  - Penyiapan otomatis engine Ollama lokal di latar belakang tanpa memblokir antarmuka pengguna.
  - Pengunduh terintegrasi untuk model Liquid Foundation Model (LFM3 1.7B) dengan verifikasi hash dan peluncuran engine otomatis.

---

## [v0.2.7] - 2026-10-30

### Fitur Baru
- **Penghentian Aliran Respon (Stop Generating)**:
  - Tombol stop dinamis berbentuk lingkaran dengan ikon kotak fill di dock prompt yang menggantikan tombol kirim ketika asisten sedang memproses respon teks.
  - Penanganan pembatalan stream (AbortController) yang elegan tanpa memicu toast error atau gelembung galat palsu.
  - Dukungan pintasan keyboard tombol Esc untuk menghentikan respon aktif seketika.
- **Revert dan Regenerasi Percakapan (Coba Lagi dan Edit Prompt)**:
  - Tombol aksi "Coba Lagi" di bawah pesan asisten untuk membatalkan giliran percakapan terakhir dan mengulang permintaan ke model AI.
  - Tombol "Edit" saat mengarahkan kursor ke pesan pengguna untuk mengembalikan teks pertanyaan ke dock input dan memotong riwayat pesan setelahnya.
- **Seleksi Teks Kursor Bebas dan Tombol Salin Cepat**:
  - Menghapus aturan seleksi kaku sehingga teks di seluruh area chat dan editor dapat disorot menggunakan kursor mouse secara alami.
  - Penambahan tombol "Salin" di bawah bubble output AI pada Mode 1 (Clean Chat) dan Mode 2 (Agent Workspace) lengkap dengan umpan balik visual "Tersalin!".
- **Injeksi System Prompt Percakapan Alami Manusiawi**:
  - Menggantikan aturan baku CSS frontend dengan persona percakapan komprehensif pada Mode 1 Chatbot.
  - Menginstruksikan seluruh model bahasa besar untuk selalu berkomunikasi dalam bahasa Indonesia yang ramah, hangat, menggunakan format Markdown terstruktur, dan melarang notasi telegrafis mesin (seperti -> skipped: ...).

### Peningkatan dan Perbaikan
- **Penyelesaian Masalah Duplikasi Avatar Maskot**:
  - Menghapus rendering avatar ganda saat proses pengiriman pesan.
  - Mengintegrasikan indikator loading dan status animasi berpikir maskot langsung ke dalam gelembung pesan asisten pertama secara mulus sejak awal proses dispatch.
- **Minimalisme Kanvas Chat dan Pembersihan Telemetri**:
  - Menghapus bar estimasi token di atas dock input chat untuk menjaga tampilan ruang kerja tetap lapang, tenang, dan bersih sesuai filosofi flat design ChatGPT.

---

## [v0.2.6] - 2026-10-30

### Fitur Baru
- **Integrasi Engine Maskot Bloub (React 19)**:
  - Memporting engine matematika resmi Bloub ke komponen React 19 `BloubBot.tsx`.
  - Sistem pemotongan mata berbasis SVG mask (`<mask id="...">`) asli: mata terpotong secara geometris saat melirik ke tepi tubuh siluet.
  - 10 bentuk tubuh analitik siluet: lingkaran, kotak membulat, galet, kapsul, segitiga, heksagon, awan, tetesan, pentagon, dan bintang.
  - 12 pilihan warna solid Bloub resmi serta pemilih warna hex bebas.
  - 10 ekspresi wajah bawaan: netral, fokus, terkejut, bersemangat, bahagia, tertawa, marah, sedih, takut, dan penasaran.
  - 14 status animasi morfisme kontinu: idle, thinking, wink, wide, alert, notify, exclaim, sleep, egg, hexagon, play, orbit, burst, comet, dan swirl.
- **Sistem Reaksi Event Aplikasi**:
  - Pemetaan reaktif event aplikasi (`on_idle`, `on_thinking`, `on_error`, `on_approval`, `on_success`) ke salah satu dari 14 status animasi maskot untuk setiap peran agen.
- **Halaman Pengaturan Maskot Simetris**:
  - Menu kustomisasi maskot terpusat dengan tata letak kontainer simetris (`w-full max-w-4xl xl:max-w-5xl mx-auto`).
  - Kartu preview interaktif dengan kontrol saklar pelacakan kursor mouse dan galeri pengujian 14 animasi.

### Peningkatan & Perbaikan
- **Kalibrasi Presisi Arah Lirikan Mata (Gaze Tracking & Rest Gaze)**:
  - Menghapus offset bias keras ke arah kiri (-26 derajat) dan elevasi buatan bawaan repositori asal.
  - Menyetel tatapan diam (`REST_GAZE`) ke posisi simetris menatap lurus ke depan ke arah pengguna (`yaw: 0, pitch: 0, roll: 0`).
  - Pelacakan kursor mouse kini 100% simetris, responsif, dan akurat mengikuti posisi relatif kursor dengan radius respon taktil 220px.
  - Menyambungkan prop pelacakan kursor pada preview pengaturan secara reaktif ke saklar pengaturan pengguna.
- **Peningkatan Ukuran Avatar Maskot pada Seluruh Mode Chat**:
  - Mode 1 (Clean Chat): Avatar pesan asisten diperbesar dari 28px (`size={26}`) menjadi 40px (`size={40}`, `w-10 h-10`). Avatar layar kosong diperbesar ke 92px.
  - Mode 2 (Agent Workspace): Avatar pesan riwayat agen diperbesar menjadi 36px (`w-9 h-9`), dan kartu agen aktif diperbesar menjadi 48px (`size={46}`).
  - Mode 3 (Multi-Agent Studio): Avatar bubble pesan tim agen dan kartu status berpikir diperbesar menjadi 36px (`w-9 h-9`).
- **Lokalisasi Komentar Teknis**:
  - Seluruh 13 file engine matematika maskot di `src/components/mascot/bloub/` diterjemahkan secara komprehensif dari bahasa Prancis ke bahasa Indonesia yang bersih dan rapi.

---

## [v0.2.5] - 2026-10-29

### Fitur Baru
- Kontainer scroll percakapan penuh (*full-width scroll container*).
- Ikon terminal kompak dan penataan ulang tombol aksi header editor kode.
- Pemilih proyek otomatis pada mode studio build.

---

## [v0.2.4] - 2026-10-28

### Fitur Baru
- Integrasi auto-updater lintas platform dengan penanganan rilis Windows dan Linux.
- Mitigasi ghosting Wayland DMA-BUF pada sistem operasi Linux.

---

## [v0.2.3] - 2026-10-27

### Peningkatan
- Isolasi file picker dan penyempurnaan palet warna netral flat design.
