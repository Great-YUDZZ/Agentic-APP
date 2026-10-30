import { TAU, lerp, r2 } from './math'
import { PROFILES, PROFILE_SAMPLES, type ProfileName } from './profiles'

export interface Point {
  x: number
  y: number
}

/**
 * Siluet: profil radial r(theta) ditambah pose.
 *
 * Semua bentuk diproses melalui profil yang disampel pada jumlah sudut yang sama.
 * Dua bentuk sembarang memiliki titik-titik yang berkorespondensi satu per satu,
 * sehingga morphing disederhanakan menjadi interpolasi linear jari-jari (radii).
 * Pendekatan ini membuat transisi sangat halus dan efisien tanpa pustaka morphing eksternal.
 */
export interface Silhouette {
  radii: number[]
  /** rotasi profil, dalam radian */
  rot: number
  /** pergeseran pusat, dalam satuan radius bola */
  cx: number
  cy: number
  /** squash & stretch, diterapkan pada koordinat layar (setelah rotasi) */
  sx: number
  sy: number
}

const ANGLES = Array.from({ length: PROFILE_SAMPLES }, (_, i) => (i / PROFILE_SAMPLES) * TAU)
const COS = ANGLES.map(Math.cos)
const SIN = ANGLES.map(Math.sin)

export function silhouette(name: ProfileName, pose: Partial<Silhouette> = {}): Silhouette {
  return {
    radii: [...PROFILES[name]],
    rot: 0,
    cx: 0,
    cy: 0,
    sx: 1,
    sy: 1,
    ...pose
  }
}

/** Lingkaran sempurna: berfungsi sebagai basis netral (titik, gelembung, target transisi). */
export function circle(radius: number, pose: Partial<Silhouette> = {}): Silhouette {
  return {
    radii: new Array(PROFILE_SAMPLES).fill(radius),
    rot: 0,
    cx: 0,
    cy: 0,
    sx: 1,
    sy: 1,
    ...pose
  }
}

/** Interpolasi dua siluet. Objek `out` digunakan kembali untuk menghindari alokasi memori pada 60 fps. */
export function blend(a: Silhouette, b: Silhouette, t: number, out?: Silhouette): Silhouette {
  const dst = out ?? { radii: new Array<number>(PROFILE_SAMPLES), rot: 0, cx: 0, cy: 0, sx: 1, sy: 1 }
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    dst.radii[i] = lerp(a.radii[i] ?? 1, b.radii[i] ?? 1, t)
  }
  // Rotasi melalui jalur terpendek: mencegah putaran penuh saat berpindah dari +170 deg ke -170 deg.
  let dRot = b.rot - a.rot
  while (dRot > Math.PI) dRot -= TAU
  while (dRot < -Math.PI) dRot += TAU
  dst.rot = a.rot + dRot * t
  dst.cx = lerp(a.cx, b.cx, t)
  dst.cy = lerp(a.cy, b.cy, t)
  dst.sx = lerp(a.sx, b.sx, t)
  dst.sy = lerp(a.sy, b.sy, t)
  return dst
}

/** Proyeksikan siluet ke titik-titik koordinat layar. `scale` = radius bola dalam unit viewBox. */
export function toPoints(s: Silhouette, scale: number, out: Point[] = []): Point[] {
  const cr = Math.cos(s.rot)
  const sr = Math.sin(s.rot)
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    const r = s.radii[i] ?? 1
    const x = r * (COS[i] ?? 0)
    const y = r * (SIN[i] ?? 0)
    // Rotasi lalu squash pada koordinat layar, diikuti translasi
    const rx = x * cr - y * sr
    const ry = x * sr + y * cr
    const p = out[i] ?? { x: 0, y: 0 }
    p.x = (rx * s.sx + s.cx) * scale
    p.y = (ry * s.sy + s.cy) * scale
    out[i] = p
  }
  out.length = PROFILE_SAMPLES
  return out
}

/**
 * Poliline tertutup -> kurva kubik Catmull-Rom.
 *
 * Dengan 64 titik sampel, tangen berpusat sudah sangat memadai: kontur tampak
 * halus hingga tingkat sub-piksel bahkan pada ukuran tampilan 600 px.
 */
export function closedPath(pts: Point[], tension = 1 / 6): string {
  const n = pts.length
  if (n < 3) return ''
  const first = pts[0]!
  let d = `M${r2(first.x)} ${r2(first.y)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!
    const p1 = pts[i]!
    const p2 = pts[(i + 1) % n]!
    const p3 = pts[(i + 2) % n]!
    const c1x = p1.x + (p2.x - p0.x) * tension
    const c1y = p1.y + (p2.y - p0.y) * tension
    const c2x = p2.x - (p3.x - p1.x) * tension
    const c2y = p2.y - (p3.y - p1.y) * tension
    d += `C${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(p2.x)} ${r2(p2.y)}`
  }
  return `${d}Z`
}

/**
 * Poligon sembarang -> profil radial melalui ray casting dari titik pusat `center`.
 *
 * Digunakan untuk membentuk geometri yang tidak mudah dinyatakan dalam fungsi analitik r(theta),
 * seperti batang tanda seru ("!"). Dihitung satu kali saat inisialisasi, tidak pernah pada render loop.
 */
export function profileFromPolygon(poly: Point[], cx: number, cy: number): number[] {
  const radii = new Array<number>(PROFILE_SAMPLES).fill(0)
  const n = poly.length
  for (let k = 0; k < PROFILE_SAMPLES; k++) {
    const dx = COS[k] ?? 0
    const dy = SIN[k] ?? 0
    let best = 0
    for (let i = 0; i < n; i++) {
      const a = poly[i]!
      const b = poly[(i + 1) % n]!
      const ex = b.x - a.x
      const ey = b.y - a.y
      const den = dx * ey - dy * ex
      if (Math.abs(den) < 1e-9) continue
      const px = a.x - cx
      const py = a.y - cy
      const t = (px * ey - py * ex) / den // Jarak sepanjang sinar
      const u = (px * dy - py * dx) / den // Posisi pada segmen garis
      if (t > best && u >= 0 && u <= 1) best = t
    }
    radii[k] = best
  }
  return radii
}

/** Convex hull dari dua lingkaran: membentuk geometri batang tanda seru ("!") vertikal. */
export function hullOfCircles(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2v: number,
  steps = 96
): Point[] {
  const dx = x2 - x1
  const dy = y2 - y1
  const dist = Math.hypot(dx, dy) || 1e-6
  // Sudut garis singgung eksternal bersama
  const base = Math.atan2(dy, dx)
  const spread = Math.acos(Math.max(-1, Math.min(1, (r1 - r2v) / dist)))
  const pts: Point[] = []
  // Busur lingkaran besar
  for (let i = 0; i <= steps / 2; i++) {
    const a = base + spread + ((TAU - 2 * spread) * i) / (steps / 2)
    pts.push({ x: x1 + Math.cos(a) * r1, y: y1 + Math.sin(a) * r1 })
  }
  // Busur lingkaran kecil
  for (let i = 0; i <= steps / 2; i++) {
    const a = base - spread + ((2 * spread) * i) / (steps / 2)
    pts.push({ x: x2 + Math.cos(a) * r2v, y: y2 + Math.sin(a) * r2v })
  }
  return pts
}

/**
 * Jari-jari profil dalam arah sudut sembarang melalui interpolasi dua sampel bertetangga.
 *
 * Menyelaraskan elemen yang menempel pada tubuh maskot (seperti mata atau lencana notifikasi)
 * ketika siluet bukan lingkaran sempurna. Menghindari pemotongan elemen oleh batas siluet.
 */
export function radiusAtAngle(radii: number[], angle: number): number {
  const n = radii.length
  const t = ((((angle / TAU) % 1) + 1) % 1) * n
  const i = Math.floor(t)
  return lerp(radii[i % n] ?? 1, radii[(i + 1) % n] ?? 1, t - i)
}

/**
 * Profil Superelips: |x/sx|^n + |y/sy|^n = 1.
 * Nilai n = 2 menghasilkan elips murni, sedangkan n mendekati 4 menghasilkan squircle halus.
 */
export function superellipseProfile(n: number, sx = 1, sy = 1): number[] {
  return ANGLES.map((_, i) => {
    const c = Math.abs((COS[i] ?? 0) / sx) ** n
    const s = Math.abs((SIN[i] ?? 0) / sy) ** n
    return (c + s) ** (-1 / n)
  })
}

/**
 * Profil radial penggabungan (union) beberapa lingkaran:
 * r(theta) = titik potong terluar sinar dengan kumpulan lingkaran.
 * Menghasilkan kontur awan atau tetesan secara analitik tanpa operasi boolean path yang berat.
 */
export function unionOfCirclesProfile(circles: Array<{ x: number; y: number; r: number }>): number[] {
  const out = new Array<number>(PROFILE_SAMPLES).fill(0)
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    const dx = COS[i] ?? 0
    const dy = SIN[i] ?? 0
    let best = 0
    for (const c of circles) {
      const b = dx * c.x + dy * c.y
      const disc = b * b - (c.x * c.x + c.y * c.y - c.r * c.r)
      if (disc < 0) continue
      const t = b + Math.sqrt(disc)
      if (t > best) best = t
    }
    out[i] = best
  }
  return out
}

/**
 * Poligon dengan sudut membulat melalui penjumlahan Minkowski dengan lingkaran:
 * Setiap rusuk digeser sejauh `rc` ke arah luar, dan setiap sudut digantikan dengan busur radius `rc`.
 * Mengharapkan koordinat poligon searah jarum jam (sistem koordinat layar, sumbu y mengarah ke bawah).
 */
function roundedPolygon(verts: Point[], rc: number, arcSteps = 10): Point[] {
  const n = verts.length
  const out: Point[] = []
  const normal = (a: Point, b: Point) => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    // Searah jarum jam + y mengarah ke bawah: vektor normal keluar adalah (dy, -dx)
    return Math.atan2(-dx / len, dy / len)
  }
  for (let i = 0; i < n; i++) {
    const prev = verts[(i - 1 + n) % n]!
    const cur = verts[i]!
    const next = verts[(i + 1) % n]!
    const a0 = normal(prev, cur)
    const a1 = normal(cur, next)
    let d = a1 - a0
    while (d > Math.PI) d -= TAU
    while (d < -Math.PI) d += TAU
    for (let k = 0; k <= arcSteps; k++) {
      const a = a0 + (d * k) / arcSteps
      out.push({ x: cur.x + Math.cos(a) * rc, y: cur.y + Math.sin(a) * rc })
    }
  }
  return out
}

/** Poligon reguler dengan sudut membulat, berada di dalam batas radius yang ditentukan. */
export function regularPolygonProfile(
  sides: number,
  radius: number,
  rc: number,
  rotationDeg = 0
): number[] {
  const rot = (rotationDeg * Math.PI) / 180
  const verts = Array.from({ length: sides }, (_, i) => {
    // Searah jarum jam pada layar: theta bertambah seiring y mengarah ke bawah
    const a = rot + (i / sides) * TAU
    return { x: Math.cos(a) * (radius - rc), y: Math.sin(a) * (radius - rc) }
  })
  return profileFromPolygon(roundedPolygon(verts, rc), 0, 0)
}

/** Jalur poliline tertutup eksak: menjaga segmen garis lurus presisi. */
export function polyPath(pts: Point[], scale = 1): string {
  if (pts.length < 3) return ''
  let d = ''
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    d += `${i === 0 ? 'M' : 'L'}${r2(p.x * scale)} ${r2(p.y * scale)}`
  }
  return `${d}Z`
}

/** Jalur bentuk kapsul berpusat di titik asal: geometri presisi untuk mata maskot. */
export function capsulePath(w: number, h: number): string {
  const hw = Math.max(w, 0.01) / 2
  const hh = Math.max(h, 0.01) / 2
  const r = Math.min(hw, hh)
  return (
    `M${r2(-hw)} ${r2(-hh + r)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(-hw + r)} ${r2(-hh)}` +
    `L${r2(hw - r)} ${r2(-hh)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(hw)} ${r2(-hh + r)}` +
    `L${r2(hw)} ${r2(hh - r)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(hw - r)} ${r2(hh)}` +
    `L${r2(-hw + r)} ${r2(hh)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(-hw)} ${r2(hh - r)}Z`
  )
}
