/**
 * Penempatan dan penyesuaian posisi wajah pada berbagai bentuk kustom.
 *
 * Mata maskot berada pada permukaan bola acuan, dan `radiusAtAngle` menyelaraskannya
 * ke kontur bentuk riil secara proporsional sesuai radius lokal.
 * Modul ini menghitung tabel pergeseran (offset table) secara deterministik saat inisialisasi
 * untuk mencegah kalkulasi berat di setiap frame render (60 fps).
 */

import { EXPRESSIONS, type BotExpression } from './expressions'
import { eyePoses } from './face'
import { radiusAtAngle, toPoints, type Point } from './shape'
import { SHAPES } from './skins'
import { STATES, type Pose, type StateDef, type StateId } from './states'

/** Radius referensi solver. Pergeseran yang dihasilkan dalam unit radius ini. */
const R = 100

/**
 * Batas amplitudo gerakan saat diam (liveliness) berdasarkan nilai loop noise.
 */
const DERIVE_YAW = 5.5 + 1.6
const DERIVE_PITCH = 4.2 + 1.3
/** Fluktuasi titik pusat, dalam satuan radius bola. */
const DERIVE_X = 0.006
const DERIVE_Y = 0.007

/** Parameter wajah pose untuk perhitungan geometri mata. */
interface Visage {
  gaze: Pose['gaze']
  split: number
  eyes: Pose['eyes']
}

/**
 * Jejak kapsul mata untuk pengukuran batas kontur dan penyesuaian margin.
 */
interface Empreinte {
  /** Titik pusat, dalam satuan viewBox */
  x: number
  y: number
  /** Vektor separuh sumbu */
  ax: number
  ay: number
  /** Radius lingkaran lokal sebelum transformasi */
  r: number
  /** Kolom matriks tangen untuk kalkulasi batas elips */
  m: [number, number, number, number]
}

/**
 * Jejak kedua mata pada profil bentuk tertentu.
 */
function empreintes(visage: Visage, sil: Pose['sil'], radii: number[]): Empreinte[] {
  const out: Empreinte[] = []
  const poses = eyePoses(visage.gaze, R, visage.split)
  for (let i = 0; i < 2; i++) {
    const e = poses[i]!
    if (e.depth <= 0.02) continue
    const cfg = visage.eyes[i]!
    const phi = ((cfg.tilt ?? 0) * Math.PI) / 180
    const cp = Math.cos(phi)
    const sp = Math.sin(phi)
    const ax = e.a * cp + e.c * sp
    const ay = e.b * cp + e.d * sp
    const cx = -e.a * sp + e.c * cp
    const cy = -e.b * sp + e.d * cp

    const hw = Math.max(cfg.w * R, 0.01) / 2
    const hh = Math.max(cfg.h * R, 0.01) / 2
    const r = Math.min(hw, hh)
    // Sumbu mengikuti dimensi terpanjang
    const long = hh > hw
    const demi = long ? hh - r : hw - r
    // Proporsi radius lokal seperti pada engine
    const fit = radiusAtAngle(radii, Math.atan2(e.y, e.x) - sil.rot)
    out.push({
      x: e.x * fit,
      y: e.y * fit,
      ax: (long ? cx : ax) * demi,
      ay: (long ? cy : ay) * demi,
      r,
      m: [ax, ay, cx, cy]
    })
  }
  return out
}

/**
 * Menghitung jarak terpendek antara kontur dan segmen garis serta arah vektor pemisahnya.
 */
function approche(pts: Point[], x0: number, y0: number, x1: number, y1: number) {
  const sx = x1 - x0
  const sy = y1 - y0
  const len2 = sx * sx + sy * sy
  let best = Infinity
  let vx = 0
  let vy = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    let t = len2 > 0 ? ((p.x - x0) * sx + (p.y - y0) * sy) / len2 : 0
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const ex = x0 + t * sx - p.x
    const ey = y0 + t * sy - p.y
    const d2 = ex * ex + ey * ey
    if (d2 < best) {
      best = d2
      vx = ex
      vy = ey
    }
  }
  const d = Math.sqrt(best)
  return { d, ux: d > 1e-9 ? vx / d : 0, uy: d > 1e-9 ? vy / d : 0 }
}

/** Kasus uji: kapsul mata yang harus berada di dalam batas kontur. */
interface Epreuve {
  empreintes: Empreinte[]
  reference: Empreinte[]
  contour: Point[]
  calContour: Point[]
}

/** Fluktuasi titik pusat dalam satuan viewBox. */
const FLOTTEMENT = Math.hypot(DERIVE_X, DERIVE_Y) * R

/** Margin mata paling sempit dan arah pergeseran yang optimal. */
function pire(pts: Point[], emps: Empreinte[], tx: number, ty: number) {
  let marge = Infinity
  let ux = 0
  let uy = 0
  for (const e of emps) {
    const x = e.x + tx
    const y = e.y + ty
    const a = approche(pts, x - e.ax, y - e.ay, x + e.ax, y + e.ay)
    // Fungsi batas elips searah pendekatan
    const [m0, m1, m2, m3] = e.m
    const rayon =
      e.r * Math.hypot(m0 * a.ux + m1 * a.uy, m2 * a.ux + m3 * a.uy) + FLOTTEMENT
    if (a.d - rayon < marge) {
      marge = a.d - rayon
      ux = a.ux
      uy = a.uy
    }
  }
  return { marge, ux, uy }
}

/** Parameter pencarian arah dan iterasi biseksi. */
const DIRECTIONS = 12
const DICHOTOMIE = 8

/**
 * Menghitung pergeseran offset optimal untuk kedua mata pada bentuk, pose, dan ekspresi tertentu.
 */
function resous(epreuves: Epreuve[]): { x: number; y: number } {
  if (!epreuves.length) return { x: 0, y: 0 }

  /** Margin terkecil dari seluruh kasus uji pada translasi tertentu. */
  const marge = (tx: number, ty: number) => {
    let m = Infinity
    for (const ep of epreuves) m = Math.min(m, pire(ep.contour, ep.empreintes, tx, ty).marge)
    return m
  }

  // Margin target minimum yang diizinkan profil asal
  let requis = Infinity
  for (const ep of epreuves) {
    requis = Math.min(requis, pire(ep.calContour, ep.reference, 0, 0).marge)
  }

  let mx = 0
  let my = 0
  const emps = epreuves[0]!.empreintes
  for (const e of emps) {
    mx -= e.x / emps.length
    my -= e.y / emps.length
  }
  const course = Math.max(0.35 * R, Math.hypot(mx, my) * 1.25)

  requis = Math.min(requis, marge(mx, my))

  const depart = marge(0, 0)
  if (depart >= requis && depart >= 0) return { x: 0, y: 0 }
  const cible = Math.max(requis, 0)

  let meilleurX = 0
  let meilleurY = 0
  let meilleureNorme = Infinity
  let secoursX = 0
  let secoursY = 0
  let secours = depart

  for (let d = 0; d < DIRECTIONS; d++) {
    const a = (d / DIRECTIONS) * Math.PI * 2
    const ux = Math.cos(a)
    const uy = Math.sin(a)
    if (marge(ux * course, uy * course) < cible) {
      for (const k of [0.3, 0.6, 1]) {
        const m = marge(ux * course * k, uy * course * k)
        if (m > secours) {
          secours = m
          secoursX = ux * course * k
          secoursY = uy * course * k
        }
      }
      continue
    }
    let bas = 0
    let haut = course
    for (let i = 0; i < DICHOTOMIE; i++) {
      const mid = (bas + haut) / 2
      if (marge(ux * mid, uy * mid) >= cible) haut = mid
      else bas = mid
    }
    if (haut < meilleureNorme) {
      meilleureNorme = haut
      meilleurX = ux * haut
      meilleurY = uy * haut
    }
  }

  const x = meilleureNorme === Infinity ? secoursX : meilleurX
  const y = meilleureNorme === Infinity ? secoursY : meilleurY
  // Kembalikan dalam unit radius bola (R)
  return { x: +(x / R).toFixed(6), y: +(y / R).toFixed(6) }
}

/** Menentukan konfigurasi wajah berdasarkan status apakah mendukung ekspresi kustom. */
function visageDe(def: StateDef, pose: Pose, expr: BotExpression | null): Visage {
  if (def.baseFace && expr) return { gaze: expr.gaze, split: expr.split, eyes: expr.eyes }
  return { gaze: pose.gaze, split: pose.split, eyes: pose.eyes }
}

/** Sampel waktu dalam status animasi: cukup satu titik jika pose statis. */
function dates(def: StateDef): number[] {
  const signature = (p: Pose) =>
    JSON.stringify([p.gaze, p.split, p.eyes, p.sil.rot, p.sil.cx, p.sil.cy, p.sil.sx, p.sil.sy])
  if (signature(def.pose(0)) === signature(def.pose(def.duration))) return [0]
  const n = 3
  return Array.from({ length: n }, (_, i) => (i / (n - 1)) * def.duration)
}

/** Menghitung offset bentuk untuk status dan ekspresi tertentu. */
function decalagePour(
  def: StateDef,
  radii: number[],
  expr: BotExpression | null
): { x: number; y: number } {
  const epreuves: Epreuve[] = []
  for (const t of dates(def)) {
    const pose = def.pose(t)
    const contour = toPoints({ ...pose.sil, radii }, R)
    const calContour = toPoints(pose.sil, R)
    const v = visageDe(def, pose, expr)
    const coins: Visage[] = []
    for (const dy of [-DERIVE_YAW, DERIVE_YAW]) {
      for (const dp of [-DERIVE_PITCH, DERIVE_PITCH]) {
        coins.push({
          ...v,
          gaze: { yaw: v.gaze.yaw + dy, pitch: v.gaze.pitch + dp, roll: v.gaze.roll }
        })
      }
    }
    for (const c of coins) {
      epreuves.push({
        empreintes: empreintes(c, pose.sil, radii),
        reference: empreintes(c, pose.sil, pose.sil.radii),
        contour,
        calContour
      })
    }
  }
  return resous(epreuves)
}

/** Nilai offset nol untuk kondisi netral tanpa koreksi posisi. */
const NUL = { x: 0, y: 0 } as const

/** Kunci entri tabel: gabungan status dan ekspresi. */
const clef = (state: StateId, expr: string | null) => `${state}|${expr ?? ''}`

/**
 * Membangun tabel lookup offset posisi mata secara deterministik.
 */
function batir(): Map<number[], Map<string, { x: number; y: number }>> {
  return new Map(
    SHAPES.map((forme) => {
      const par = new Map<string, { x: number; y: number }>()
      for (const def of STATES) {
        if (!def.baseBody) continue
        const expressions = def.baseFace ? [null, ...EXPRESSIONS] : [null]
        for (const expr of expressions) {
          par.set(clef(def.id, expr?.id ?? null), decalagePour(def, forme.radii, expr))
        }
      }
      return [forme.radii, par]
    })
  )
}

const DECALAGES = batir()

/**
 * Pergeseran yang diterapkan pada kedua mata untuk bentuk dan status animasi ini.
 * Mengembalikan offset dalam satuan radius bola.
 */
export function decalageDesYeux(
  radii: number[] | null,
  state: StateId,
  expr: string | null
): { x: number; y: number } {
  if (!radii) return NUL
  const par = DECALAGES.get(radii)
  if (!par) return NUL
  return par.get(clef(state, expr)) ?? par.get(clef(state, null)) ?? NUL
}

/** Utilitas pengujian verifikasi tabel. */
export const POUR_TESTS = { batir }
