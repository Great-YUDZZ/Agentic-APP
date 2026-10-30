import type { Look } from './engine'
import type { ExpressionId } from './expressions'

/**
 * Logika arah tatapan mata saat mengikuti posisi kursor pengguna.
 * Posisi kursor dinormalisasi (-1 hingga 1) berpusat pada maskot.
 */

/**
 * Batas sudut rotasi kepala dalam derajat.
 * Menjaga mata tetap berada di dalam permukaan bola tanpa meluncur keluar siluet.
 */
export const YAW_MAX = 22
export const PITCH_MAX = 16

/**
 * Durasi transisi kembalinya tatapan ke posisi normal (dalam detik).
 */
export const TURN_TIME = 0.4

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

export interface Aim {
  /** Jarak horizontal kursor dari tengah maskot, -1 hingga 1 (kanan positif) */
  nx: number
  /** Jarak vertikal kursor dari tengah maskot, -1 hingga 1 (bawah positif) */
  ny: number
  /** Progres transisi putaran, 0 hingga 1 */
  tour?: number
  /** Status ketersediaan posisi kursor (true jika kursor terdeteksi) */
  pointer: boolean
}

/**
 * Menghitung parameter target tatapan kepala dan mata maskot.
 * Arah mata 100% simetris, responsif, dan akurat mengikuti posisi relatif kursor dari maskot:
 * - nx = 0, ny = 0: mata menatap lurus ke depan ke arah pengguna.
 * - kursor ke kanan (nx > 0): mata melirik ke kanan (yaw positif).
 * - kursor ke kiri (nx < 0): mata melirik ke kiri (yaw negatif).
 * - kursor ke atas (ny < 0): mata menatap ke atas (pitch positif).
 * - kursor ke bawah (ny > 0): mata menatap ke bawah (pitch negatif).
 */
export function lookTarget({ nx, ny, pointer }: Aim): Look {
  return {
    yaw: nx * YAW_MAX,
    pitch: -ny * PITCH_MAX,
    mix: pointer ? 1 : 0,
    spin: 0,
    wander: pointer ? 0 : 1
  }
}
