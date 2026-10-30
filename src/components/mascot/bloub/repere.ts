/**
 * Koordinat acuan rendering engine maskot.
 *
 * Nilai koordinat output dari engine.sample() menggunakan satuan viewBox SVG.
 * Seluruh ukuran elemen dinyatakan dalam rasio terhadap konstanta acuan ini.
 */

/**
 * Radius bola saat istirahat (idle) dalam satuan viewBox (skala acuan = 100).
 * Semua ukuran lain dinyatakan sebagai fraksi dari radius ini.
 */
export const RAYON = 100

/**
 * Setengah ukuran sisi viewBox SVG (158).
 * Margin di luar radius bola 100 menampung cincin orbit dan partikel partikel terluar.
 */
export const DEMI_VIEWBOX = 158
