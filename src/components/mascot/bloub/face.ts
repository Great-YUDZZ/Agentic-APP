import { clamp, createRng, loopNoise } from './math'

/**
 * Model proyeksi mata pada permukaan bola 3D.
 *
 * Menggunakan proyeksi ortografis bola: setiap mata menerima matriks tangen
 * bidang bola, sehingga efek kompresi perspektif dan kemiringan terbentuk
 * otomatis saat mata bergeser ke tepi siluet.
 */

type Vec3 = [number, number, number]

/** Setengah jarak pemisah kedua mata pada bola dalam derajat (~31 derajat total) */
export const EYE_SPLIT = 15.46
/** Ukuran mata saat diam dalam satuan radius bola */
export const EYE_W = 0.186
export const EYE_H = 0.412

/** Orientasi kepala saat diam (idle gaze) */
export const REST_GAZE: HeadGaze = { yaw: 28.49, pitch: 28.62, roll: -13 }

export interface EyePose {
  x: number
  y: number
  /** Matriks tangen 2x2: [a b c d] sesuai standar SVG matrix(a,b,c,d,e,f) */
  a: number
  b: number
  c: number
  d: number
  /** Komponen z normal permukaan: > 0 menandakan sisi yang terlihat */
  depth: number
}

export interface HeadGaze {
  /** Yaw (lacet) dalam derajat, nilai positif = menoleh ke kanan */
  yaw: number
  /** Pitch (tangage) dalam derajat, nilai positif = menatap ke atas */
  pitch: number
  /** Roll (roulis) dalam derajat, sudut kemiringan kepala */
  roll: number
}

const deg = (d: number) => (d * Math.PI) / 180

/** Memutar dua vektor basis ortonormal di bidang bersamanya */
function spin(u: Vec3, v: Vec3, angle: number): [Vec3, Vec3] {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [
    [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s],
    [v[0] * c - u[0] * s, v[1] * c - u[1] * s, v[2] * c - u[2] * s]
  ]
}

/**
 * Menghitung orientasi kepala dan pose kedua mata.
 * Indeks 0 adalah mata bagian dalam, indeks 1 mata bagian luar.
 */
export function eyePoses(gaze: HeadGaze, scale: number, split = EYE_SPLIT): [EyePose, EyePose] {
  let f: Vec3 = [0, 0, 1]
  let right: Vec3 = [1, 0, 0]
  let down: Vec3 = [0, 1, 0]

  // Yaw: rotasi horizontal forward ke arah kanan
  ;[f, right] = spin(f, right, deg(gaze.yaw))
  // Pitch: rotasi vertikal forward ke arah atas
  ;[down, f] = spin(down, f, deg(gaze.pitch))
  // Roll: kemiringan kepala pada bidangnya
  ;[right, down] = spin(right, down, deg(gaze.roll))

  const build = (side: number): EyePose => {
    const [ef, er] = spin(f, right, deg(split * side))
    return {
      x: ef[0] * scale,
      y: ef[1] * scale,
      a: er[0],
      b: er[1],
      c: down[0],
      d: down[1],
      depth: ef[2]
    }
  }

  return [build(-1), build(1)]
}

/**
 * Animasi hidup alami saat istirahat: pergeseran tatapan lembut, nafas, dan kedipan mata.
 * Merupakan fungsi matematika deterministik dari waktu.
 */
export interface Liveliness {
  dYaw: number
  dPitch: number
  dRoll: number
  /** 1 = mata terbuka penuh, 0 = tertutup */
  lid: number
  driftX: number
  driftY: number
  breath: number
}

const BLINK_RNG = createRng(0x5eed)
/** Jadwal interval kedipan deterministik */
const BLINKS: number[] = (() => {
  const out: number[] = []
  let t = 1.4
  while (t < 900) {
    out.push(t)
    t += 1.9 + BLINK_RNG() * 2.7
    if (BLINK_RNG() < 0.18) {
      out.push(t)
      t += 0.24
    }
  }
  return out
})()

const BLINK_DUR = 0.18

function blinkLid(t: number): number {
  for (let i = 0; i < BLINKS.length; i++) {
    const start = BLINKS[i]!
    if (t < start) break
    const k = (t - start) / BLINK_DUR
    if (k >= 0 && k <= 1) {
      return k < 0.45 ? 1 - k / 0.45 : (k - 0.45) / 0.55
    }
  }
  return 1
}

export interface LivelinessOptions {
  wander?: number
  blink?: boolean
  float?: boolean
}

export function liveliness(t: number, opt: LivelinessOptions = {}): Liveliness {
  const { wander = 1, blink = true, float = true } = opt

  return {
    dYaw: (loopNoise(t, 11.3, 0.4) * 5.5 + loopNoise(t, 3.7, 2.1) * 1.6) * wander,
    dPitch: (loopNoise(t, 9.1, 1.3) * 4.2 + loopNoise(t, 4.3, 0.7) * 1.3) * wander,
    dRoll: loopNoise(t, 13.7, 3.2) * 2.2 * wander,
    lid: blink ? blinkLid(t) : 1,
    driftX: float ? loopNoise(t, 7.9, 1.9) * 0.006 : 0,
    driftY: float ? loopNoise(t, 5.3, 0.3) * 0.007 : 0,
    breath: float ? 1 + Math.sin((t / 3.4) * Math.PI * 2) * 0.005 : 1
  }
}

/** Skala kompresi vertikal saat berkedip */
export function blinkScale(lid: number): number {
  return 0.06 + 0.94 * clamp(lid)
}
