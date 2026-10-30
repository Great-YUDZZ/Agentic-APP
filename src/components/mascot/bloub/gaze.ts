import type { Look } from './engine'
import type { ExpressionId } from './expressions'
import { clamp, easings } from './math'

/**
 * Logika arah tatapan mata saat mengikuti posisi kursor pengguna.
 * Posisi kursor dinormalisasi (-1 hingga 1) agar perhitungan independen dari DOM.
 */

/**
 * Batas sudut rotasi kepala dalam derajat.
 * Menjaga mata tetap berada di dalam permukaan bola tanpa meluncur keluar siluet.
 */
export const YAW_MAX = 16
export const PITCH_MAX = 13

/**
 * Ketinggian default tatapan saat kursor berada di tengah.
 * Sedikit di atas garis ekuator agar avatar tampak fokus dan hidup.
 */
export const PITCH = 10

/**
 * Sudut putaran kepala saat membuka panel pengaturan (melirik ke kiri).
 */
export const TURN = 26

/**
 * Rotasi penuh (360 derajat) yang ditempuh saat animasi berputar.
 */
export const SPIN = 360

/**
 * Durasi transisi putaran tatapan (dalam detik).
 */
export const TURN_TIME = 1.1

/**
 * Kumpulan ekspresi wajah yang digunakan saat mengikuti kursor.
 */
export const HUMEURS: readonly ExpressionId[] = [
  'surpris',
  'heureux',
  'hilare',
  'excite',
  'fier',
  'blase'
]

/**
 * Tipe fungsi tatapan terprogram (scripted gaze function).
 */
export type GazeScript = (t: number) => Look

/**
 * Durasi rotasi putaran penuh 360 derajat.
 */
export const TOUR_TIME = 1.5

export const tourLook: GazeScript = (t) => ({
  yaw: 0,
  pitch: 0,
  mix: 0,
  spin: SPIN * (1 - easings.easeInOutCubic(clamp(t / TOUR_TIME))),
  wander: 1
})

export interface Aim {
  /** Jarak horizontal kursor dari tengah maskot, -1 hingga 1 (kanan positif) */
  nx: number
  /** Jarak vertikal kursor dari tengah maskot, -1 hingga 1 (bawah positif) */
  ny: number
  /** Progres transisi putaran, 0 hingga 1 */
  tour: number
  /** Status ketersediaan posisi kursor (true jika kursor terdeteksi) */
  pointer: boolean
}

/**
 * Menghitung parameter target tatapan kepala dan mata maskot.
 */
export function lookTarget({ nx, ny, tour, pointer }: Aim): Look {
  return {
    yaw: -TURN + nx * YAW_MAX,
    pitch: PITCH - ny * PITCH_MAX,
    mix: tour,
    spin: SPIN * (1 - tour),
    wander: pointer ? 0 : 1
  }
}
