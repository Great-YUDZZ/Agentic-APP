# Mandatory Workspace Rule: Flat Design Standard (ChatGPT-Inspired)

<EXTREMELY_IMPORTANT>
Setiap AI assistant / subagent yang beroperasi di workspace ini WAJIB mematuhi spesifikasi desain baku berikut setiap kali diminta membuat, mengembangkan, memodifikasi, atau merevisi antarmuka pengguna (UI/UX) atau kode frontend:

## 1. Filosofi Desain & Anti-Slop (Flat Solid Surfaces)
- **True Solid Surfaces**:
  - Background kanvas utama: `#212121`
  - Sidebar & Deep Panel: `#171717`
  - Card & Input Dock Surface: `#2f2f2f`
  - Hover / Pill Sekunder: `#262626` atau `#383838`
- **Zero AI Slop**:
  - Dilarang keras menggunakan gradien warna-warni murah (seperti gradien ungu-biru slop).
  - Dilarang menggunakan backdrop-blur penuh layar (*no full-screen blur abuse*).
  - Dilarang menggunakan bayangan tebal (*no shadow-2xl / heavy neon glow*). Struktur kedalaman visual murni dibangun lewat kontras solid surface dan border 1px.

## 2. Hirarki Border & Kontras Teks
- **Teks**:
  - Teks Utama: `#ececec`
  - Teks Sekunder: `#b4b4b4`
  - Muted / Placeholder / Hints: `#707070`
- **Border**:
  - Border Card & Dock: `#303030` atau `#383838` (1px tipis halus)
  - Divider Line: `#262626`
  - Focus Border: `#4f4f4f`

## 3. Ergonomi Tata Letak & Kolom Chat
- **Fixed Bottom Input Dock**:
  - Kolom chat / input selalu diletakkan di bagian bawah layar mengapung (*fixed bottom dock*) dengan radius `rounded-3xl` dan background `#2f2f2f` border `#383838`.
- **Harmonisasi Tombol Aksi**:
  - Seluruh tombol di dalam kapsul chat memiliki tinggi seragam **32px (`h-8`)** dan border radius `rounded-full`.
  - Tombol Plus (`+`), Mic, dan Tombol Kirim bulat kontras tinggi (`#ececec` text `#171717`).
  - Pill selector `@ Tim`, mode approval (`Ask for approval` / `Strict`), dan Model Selector memiliki tinggi, border, dan padding yang sejajar rapi.
- **Declutter & Kelonggaran Kanvas**:
  - Hindari tombol/teks redundan di header (jika model aktif sudah tertera di dock input, jangan tampilkan lagi di header).
  - Area squad room / roster wajib mendukung mode collapsible (dapat di-hide ke atas) agar kanvas chat memiliki *breathing room* yang luas.

## 4. Kualitas Rekayasa & Standar Teknis
- **React 19 + TypeScript**: Ketat, tanpa unused imports, dan zero error TypeScript.
- **4 Boundary States**: Setiap view dinamis wajib mengimplementasikan *Loading Skeleton*, *Empty State*, *Error Boundary + Retry*, dan *Success Toast/Feedback*.
- Rujukan detail token dan komponen terdapat di [`DESIGN_MASTER.md`](./DESIGN_MASTER.md).
</EXTREMELY_IMPORTANT>
