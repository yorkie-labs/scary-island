// The island map: regions, the ridges that wall them off, the passes (gates)
// through those ridges, paths, and the ground height everywhere. Pure maths,
// no three.js, so it is testable and shared by terrain, layout and minimap.
//
// Coordinates: metres, X east, Z south (three.js default), Y up. Sea at y = 0.

export const SEA_LEVEL = 0;
export const ISLAND_RADIUS = 104;
export const WORLD_HALF = 135; // terrain mesh spans [-WORLD_HALF, WORLD_HALF]

export const REGIONS = {
  beach: { name: 'Lost Beach', ko: '잃어버린 해변', x: 0, z: 78, r: 30, stage: 1 },
  camp: { name: 'Central Camp', ko: '중앙 캠프', x: 0, z: 18, r: 18, stage: 0 },
  forest: { name: 'Whispering Forest', ko: '속삭이는 숲', x: -62, z: 6, r: 34, stage: 2 },
  mine: { name: 'Diamond Mine', ko: '다이아몬드 광산', x: 0, z: -52, r: 16, stage: 3 },
  village: { name: 'Statue Village', ko: '동상 마을', x: 64, z: -4, r: 30, stage: 4 },
  harbor: { name: 'Escape Harbor', ko: '탈출 항구', x: 62, z: 70, r: 22, stage: 5 },
};

// Gates sit in the gaps of the ridges. `ry` turns the gate to face along the road.
export const GATES = {
  stoneDoor: { x: 0, z: 50, ry: 0, between: ['beach', 'camp'] },
  vines: { x: -32, z: 12, ry: Math.PI / 2, between: ['camp', 'forest'] },
  mineDoor: { x: 0, z: -30, ry: 0, between: ['camp', 'mine'] },
  villageDoor: { x: 32, z: 2, ry: Math.PI / 2, between: ['camp', 'village'] },
  sealBarrier: { x: 66, z: 40, ry: 0, between: ['village', 'harbor'] },
};
const GAP_RADIUS = 3.2;

// Ridges as polylines; they run out past the coast so nobody walks round them.
// Low, steep rock banks (Diablo-style low walls): about 3 m, so the top-down
// camera sees over them; invisible walls along the crest do the real blocking.
export const RIDGE_H = 3.2;
export const RIDGES = [
  // beach | camp, gap at the stone door
  { h: RIDGE_H, pts: [[-125, 70], [-60, 56], [-20, 51], [0, 50], [20, 51], [34, 52]] },
  // beach | harbor
  { h: RIDGE_H, pts: [[34, 52], [36, 80], [34, 125]] },
  // camp | forest, gap at the vines
  { h: RIDGE_H, pts: [[-34, 54], [-32, 30], [-32, 12], [-31, -10], [-26, -34]] },
  // camp | village, gap at the village door
  { h: RIDGE_H, pts: [[34, 52], [32, 26], [32, 2], [31, -20], [24, -34]] },
  // camp | mine yard, gap at the mine door
  { h: RIDGE_H, pts: [[-26, -34], [-12, -31], [0, -30], [12, -31], [24, -34]] },
  // village | harbor, gap at the seal barrier
  { h: RIDGE_H, pts: [[34, 52], [50, 44], [66, 40], [90, 38], [130, 32]] },
  // forest north and village north into the sea
  { h: RIDGE_H, pts: [[-26, -34], [-60, -50], [-125, -60]] },
  { h: RIDGE_H, pts: [[24, -34], [60, -48], [125, -55]] },
];

// Dirt roads, for colour and a gentle levelling.
export const PATHS = [
  [[-3, 90], [2, 72], [0, 56], [0, 44], [0, 22]],
  [[0, 22], [-16, 14], [-32, 12], [-50, 8], [-64, 4], [-78, -6]],
  [[0, 22], [0, 4], [0, -24], [0, -40]],
  [[0, 22], [16, 6], [32, 2], [48, -2], [64, -4]],
  [[64, -4], [66, 20], [66, 40], [64, 56], [62, 70]],
];

// Level pads: [x, z, radius, height]
export const PADS = [
  [0, 18, 14, 3.2], // camp
  [64, -4, 22, 5.5], // village plateau
  [62, 66, 16, 1.6], // harbor yard
  [0, -42, 9, 4.5], // mine yard
  [-70, -14, 7, 3], // forest hut clearing
];

// Mountain over the mine.
const MOUNTAIN = { x: 0, z: -82, h: 34, r: 26 };

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Cheap deterministic value noise.
function hash(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => noise(x, z) * 0.5 + noise(x * 2.1, z * 2.1) * 0.3 + noise(x * 4.3, z * 4.3) * 0.2;

export function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
export function distToPolyline(px, pz, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    d = Math.min(d, distToSegment(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  }
  return d;
}

// 0..1, how much of the ridge stands here (0 inside a gate gap).
export function ridgeAt(x, z) {
  let best = 0, h = 0;
  for (const r of RIDGES) {
    const d = distToPolyline(x, z, r.pts);
    const k = 1 - smooth(1.6, 4.0, d + (fbm(x * 0.3, z * 0.3) - 0.5) * 1.5);
    if (k > best) { best = k; h = r.h; }
  }
  if (best <= 0) return { k: 0, h: 0 };
  // headlands: the ridge runs a little way out to sea, then sinks
  best *= 1 - smooth(shoreRadius(x, z) + 4, shoreRadius(x, z) + 16, Math.hypot(x, z));
  let gap = 1;
  for (const g of Object.values(GATES)) gap = Math.min(gap, smooth(GAP_RADIUS, GAP_RADIUS + 4, Math.hypot(x - g.x, z - g.z)));
  return { k: best * gap, h };
}

export function pathAt(x, z) {
  let d = Infinity;
  for (const p of PATHS) d = Math.min(d, distToPolyline(x, z, p));
  return 1 - smooth(1.4, 2.6, d);
}

// The island outline: a wobbly circle, so the coast is not a compass.
export function shoreRadius(x, z) {
  const a = Math.atan2(z, x);
  return ISLAND_RADIUS + Math.sin(a * 3 + 1) * 6 + Math.sin(a * 7) * 3 + (noise(Math.cos(a) * 3 + 9, Math.sin(a) * 3) - 0.5) * 8;
}

// Ground height before ridges and pads.
// Height across the coast by distance inland from the shoreline (d > 0 inland):
// deep sea, a gentle sandy beach, then rolling turf.
export function coastProfile(d) {
  if (d < -20) return -7;
  if (d < -4) return -7 + (6.2 * (d + 20)) / 16; // -7 .. -0.8
  if (d < 6) return -0.8 + (1.8 * (d + 4)) / 10; // -0.8 .. 1.0 beach
  if (d < 20) return 1 + (1.5 * (d - 6)) / 14; // 1.0 .. 2.5
  return 2.5;
}

function baseHeight(x, z) {
  const r = Math.hypot(x, z);
  const d = shoreRadius(x, z) - r;
  let h = coastProfile(d);
  const inland = smooth(4, 20, d);
  h += inland * (fbm(x * 0.045, z * 0.045) - 0.5) * 3.5;
  // the beach: low and smooth
  const beach = 1 - smooth(18, 34, Math.hypot(x - REGIONS.beach.x, z - REGIONS.beach.z));
  if (h > 0) h = h * (1 - beach * 0.4);
  // mountain
  const md = Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z);
  h += MOUNTAIN.h * Math.exp(-((md / MOUNTAIN.r) ** 2)) * (0.85 + fbm(x * 0.12, z * 0.12) * 0.3);
  // forest rolls a little more
  const fd = Math.hypot(x - REGIONS.forest.x, z - REGIONS.forest.z);
  h += (1 - smooth(20, 38, fd)) * (fbm(x * 0.09 + 5, z * 0.09) - 0.4) * 3;
  return h;
}

export function heightAt(x, z) {
  let h = baseHeight(x, z);
  // pads level their ground toward a target height
  for (const [px, pz, pr, ph] of PADS) {
    const k = 1 - smooth(pr * 0.75, pr + 6, Math.hypot(x - px, z - pz));
    if (k > 0) h += (ph - h) * k;
  }
  // roads are gentle
  const p = pathAt(x, z);
  if (p > 0) h -= p * 0.15;
  // ridges
  const { k, h: rh } = ridgeAt(x, z);
  if (k > 0) h = Math.max(h, h + k * rh * (0.85 + fbm(x * 0.2, z * 0.2) * 0.3));
  return h;
}

// Monsters may not walk through a gate's gap: together with the ridge walls
// this keeps each one inside its own area (and out of the camp).
export function inGateGap(x, z, r = 5) {
  return Object.values(GATES).some((g) => Math.hypot(x - g.x, z - g.z) < r);
}

// Which region a point belongs to (nearest centre, weighted by radius).
export function regionAt(x, z) {
  let best = 'camp', bd = Infinity;
  for (const [key, r] of Object.entries(REGIONS)) {
    const d = Math.hypot(x - r.x, z - r.z) / r.r;
    if (d < bd) { bd = d; best = key; }
  }
  return best;
}

export function slopeAt(x, z, e = 0.5) {
  const hx = heightAt(x + e, z) - heightAt(x - e, z);
  const hz = heightAt(x, z + e) - heightAt(x, z - e);
  return Math.atan(Math.hypot(hx, hz) / (2 * e)) * (180 / Math.PI);
}
