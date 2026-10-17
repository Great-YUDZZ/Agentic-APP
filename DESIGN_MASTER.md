# Flat Design System Master Guide (ChatGPT-Inspired)

Dokumen ini adalah **Design Master Specification** untuk seluruh antarmuka aplikasi. Mengadopsi filosofi **Modern Flat Minimalism** yang terinspirasi langsung dari antarmuka ChatGPT: bersih, tanpa efek blur/glow berlebihan (*anti-slop*), rasio kontras tinggi, tata letak bernapas (*spacious breathing room*), dan hierarki visual yang tegas.

---

## 1. Core Design Philosophy

1. **True Flat & Clean Solid Surfaces**
   - Tidak ada gradien warna-warni murah (*no cheap rainbow / blue-purple AI gradients*).
   - Tidak ada efek blur penuh layar (*no backdrop-blur abuse*).
   - Menggunakan warna padat (*solid surfaces*) dengan tingkat kontras halus antar tingkat kedalaman (elevation).

2. **Border Hierarchy & Separation**
   - Batas pemisah (*borders*) menggunakan garis tipis 1px dengan opasitas rendah (`#262626` hingga `#383838`).
   - Elemen interaktif diberi fokus border yang jelas (`#4f4f4f` hingga `#5e5e5e`), bukan bayangan tebal.

3. **Declutter & Content-First**
   - Sembunyikan atau gabungkan elemen kontrol berulang.
   - Hindari redundansi informasi (misalnya: jika model sudah tertera di dock input, jangan tampilkan lagi di header).
   - Input dock terpusat di bagian bawah (*fixed bottom dock*) dengan radius kurva halus (*rounded-3xl*).

4. **Micro-Interactions & Tactile Feedback**
   - Transisi cepat dan terukur: `150ms - 200ms ease-out`.
   - Hover state yang halus tanpa animasi memantul (*bouncy*) berlebihan.
   - Ikon proporsional dan minimalis (Lucide Icons, stroke width 1.5 - 2).

---

## 2. Color Palette Specification

### Dark Mode Palette (ChatGPT Standard)

| Peran Token | Nilai Hex | Tailwind Class Rekomendasi | Penggunaan Utama |
| :--- | :--- | :--- | :--- |
| **Canvas Background** | `#212121` | `bg-[#212121]` | Latar belakang kanvas utama, area chat, ruang workspace. |
| **Sidebar / Drawer** | `#171717` | `bg-[#171717]` | Sidebar navigasi, modal backdrop, panel header atas. |
| **Surface Card / Input Dock** | `#2f2f2f` | `bg-[#2f2f2f]` | Kapsul input chat, modal card, panel card utama. |
| **Surface Hover / Subtle Pill** | `#262626` / `#383838` | `bg-[#262626]` / `bg-[#383838]` | Hover state tombol, pill tombol aksi sekunder, input inner. |
| **Primary Text** | `#ececec` | `text-[#ececec]` | Judul utama, teks pesan chat, label aktif. |
| **Secondary Text** | `#b4b4b4` | `text-[#b4b4b4]` | Teks sekunder, deskripsi, placeholder sekunder. |
| **Muted / Placeholder Text** | `#707070` | `text-[#707070]` | Placeholder textarea, timestamp, shortcut hint. |
| **Primary Border** | `#303030` / `#383838` | `border-[#303030]` / `border-[#383838]` | Border card, kapsul dock, pemisah section. |
| **Divider Line** | `#262626` | `border-[#262626]` | Garis pemisah tipis horizontal/vertikal. |
| **Focus Border** | `#4f4f4f` | `border-[#4f4f4f]` | Border saat elemen aktif/fokus (*focus-within*). |
| **Active / Accent Pill** | `#404040` | `bg-[#404040]` | Tab aktif, pill terseleksi. |

### Status & Accent Tokens

| Status | Latar (Subtle) | Border | Teks |
| :--- | :--- | :--- | :--- |
| **Success / Active** | `bg-emerald-500/10` | `border-emerald-500/30` | `text-emerald-400` |
| **Strict / Warning** | `bg-amber-500/15` | `border-amber-500/30` | `text-amber-300` |
| **Error / Halt** | `bg-red-500/15` | `border-red-500/30` | `text-red-400` |
| **Info / Running** | `bg-blue-500/10` | `border-blue-500/30` | `text-blue-400` |

---

## 3. Typography & Font Pairing

- **Primary Font Family:** `Inter`, `system-ui`, `-apple-system`, `sans-serif` (bersih, neutral grotesque, sangat terbaca di layar monitor resolusi tinggi).
- **Code & Identifier Font:** `JetBrains Mono`, `Fira Code`, `ui-monospace`, `monospace` (digunakan pada nama model, path berkas, terminal logs, dan code syntax block).

### Skala Tipografi
- **Headline / Greeting:** `text-2xl` / `text-3xl`, `font-semibold` (`tracking-tight`), warna `#ececec`.
- **Card Title / Section Header:** `text-sm` / `text-base`, `font-medium`, warna `#ececec`.
- **Body / Chat Message:** `text-sm`, `leading-relaxed`, warna `#ececec`.
- **Secondary Caption / Roster Role:** `text-xs`, warna `#b4b4b4`.
- **Micro Badges / Mono Status:** `text-[10px]` / `text-[11px]`, `font-mono`, warna `#707070` atau `#b4b4b4`.

---

## 4. Component Patterns

### 1. Kapsul Input Dock (The Iconic 2-Tier Capsule)
Kapsul input mengapung di bagian bawah layar tanpa menempel kasar pada tepi bawah:
```tsx
<div className="p-4 bg-gradient-to-t from-[#212121] via-[#212121] to-transparent shrink-0">
  <div className="max-w-3xl mx-auto">
    <div className="relative rounded-3xl bg-[#2f2f2f] border border-[#383838] p-3.5 focus-within:border-[#4f4f4f] transition-colors">
      <textarea
        className="w-full bg-transparent border-none text-[#ececec] placeholder-[#707070] text-sm focus:outline-none resize-none px-2 py-1 leading-relaxed"
        placeholder="Ketik pesan..."
        rows={2}
      />
      <div className="flex items-center justify-between pt-2.5 border-t border-[#383838] mt-1 flex-wrap gap-2">
        {/* Tombol aksi kiri: Plus, Selector pill, Mode Approval */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button className="w-7 h-7 rounded-full bg-[#212121] hover:bg-[#262626] border border-[#383838] flex items-center justify-center text-[#ececec]">
            <Plus className="w-3.5 h-3.5" />
          </button>
          ...
        </div>
        {/* Tombol aksi kanan: Model selector pill, Mic, Tombol kirim bulat */}
        <div className="flex items-center gap-2">
          ...
          <button className="w-8 h-8 rounded-full bg-[#ececec] text-[#171717] flex items-center justify-center hover:bg-white">
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
```

### 2. Tab Navigation & Mode Switchers
Menggunakan pill kapsul dengan warna kontras halus:
- **Container:** `bg-[#2f2f2f]` berborder `border-[#383838]` dengan `rounded-xl` atau `rounded-full`.
- **Active Tab:** `bg-[#404040] text-[#ececec] shadow-none`.
- **Inactive Tab:** `text-[#b4b4b4] hover:text-[#ececec]`.

### 3. Approval Mode Indicator (HITL vs Strict)
- **Ask for approval (Aman):** `bg-[#212121] border-[#383838] text-[#ececec]` dengan ikon tangan (`Hand`).
- **Strict (Otomatis):** `bg-amber-500/15 border-amber-500/30 text-amber-300` dengan ikon kilat (`Zap`).

---

## 5. Do's and Don'ts (Pedoman Kepatuhan)

### Lakukan (DO)
1. **Gunakan warna solid:** Selalu gunakan `#212121` untuk body, `#171717` untuk sidebar/header, dan `#2f2f2f` untuk card/input.
2. **Jaga kelonggaran kanvas:** Berikan ruang lega (*breathing room*) minimal padding 16px - 24px di sekeliling konten percakapan.
3. **Posisikan input di bawah:** Area input harus berada di bagian bawah (`fixed bottom dock`) agar konsisten dengan kebiasaan pengguna.
4. **Fasilitasi navigasi keyboard:** Berikan indikator visual halus saat elemen menerima fokus keyboard.

### Hindari (DON'T)
1. **Dilarang memakai gradien warna-warni murah:** Jangan gunakan gradien ungu-biru (*purple-to-blue gradient slop*).
2. **Dilarang menggunakan shadow tebal:** Hindari `shadow-2xl` atau colored neon shadows. Struktur kedalaman harus ditentukan oleh kontras warna permukaan dan border 1px.
3. **Dilarang menaruh tombol redundan:** Jangan letakkan tombol aksi ganda di header jika fungsi yang sama telah ada di dalam kapsul input.
4. **Dilarang teks berlapis-lapis:** Hindari header yang menumpuk lebih dari dua baris info; ringkas badge dan status ke dalam satu baris horizontal.

---

## 6. Template Integrasi Tailwind CSS

Gunakan snippet konfigurasi berikut jika menambahkan modul baru ke dalam proyek:

```js
// tailwind.config.js / theme extension
colors: {
  flat: {
    bg: '#212121',        // Canvas Background
    sidebar: '#171717',   // Sidebar / Deep Surface
    surface: '#2f2f2f',   // Cards & Input Dock
    surfaceHover: '#383838',
    border: '#303030',    // Soft separator
    borderLight: '#383838',
    borderFocus: '#4f4f4f',
    textMain: '#ececec',  // Primary Text
    textMuted: '#b4b4b4', // Secondary Text
    textSub: '#707070',   // Placeholder & Hints
  }
}
```

---

*Master file ini berfungsi sebagai acuan baku visual untuk pengembangan seluruh komponen antarmuka Autonomous AI Native Hub.*
