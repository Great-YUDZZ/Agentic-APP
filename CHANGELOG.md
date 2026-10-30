# Changelog

Semua perubahan penting pada proyek Autonomous AI Native Hub dicatat dalam dokumen ini.

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
