import { RIDGES, GATES, heightAt, shoreRadius, regionAt } from './map.js';
import { place } from './models.js';
import { rng } from './scatter.js';

// Invisible walls along each ridge crest, so no amount of jumping gets a
// player over a ridge and past a gate. Each wall stops exactly GATE_CLEAR from
// a gate: every gate's own blocker (pillars, vines, a slab, the barrier) is at
// least that wide, so a shut gate has no gap beside it, and an open one
// leaves a 6 m way through. (Dropping whole pieces near a gate left holes.)
export const GATE_CLEAR = 3.0;
export function ridgeWallPieces({ step = 3, gateClear = GATE_CLEAR } = {}) {
  const pieces = [];
  const gates = Object.values(GATES);
  for (const r of RIDGES) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const dx = (bx - ax) / len, dz = (bz - az) / len;
      // where this stretch passes within gateClear of a gate: [from, to] along it
      const cuts = [];
      for (const g of gates) {
        const t = (g.x - ax) * dx + (g.z - az) * dz, d = Math.abs((g.x - ax) * dz - (g.z - az) * dx);
        if (d < gateClear) { const h = Math.sqrt(gateClear ** 2 - d ** 2); cuts.push([t - h, t + h]); }
      }
      let runs = [[0, len]];
      for (const [c0, c1] of cuts) {
        runs = runs.flatMap(([s0, s1]) => (c1 <= s0 || c0 >= s1 ? [[s0, s1]] : [[s0, c0], [c1, s1]].filter(([u, w]) => w - u > 0.05)));
      }
      const atGap = (u) => cuts.some(([c0, c1]) => Math.abs(u - c0) < 1e-6 || Math.abs(u - c1) < 1e-6);
      for (const [s0, s1] of runs) {
        const n = Math.max(1, Math.ceil((s1 - s0) / step));
        for (let k = 0; k < n; k++) {
          // pieces overlap a little where they meet, but never reach into a gap
          let u = s0 + ((s1 - s0) * k) / n, w = s0 + ((s1 - s0) * (k + 1)) / n;
          if (!atGap(u)) u -= 0.3;
          if (!atGap(w)) w += 0.3;
          const m = (u + w) / 2, x = ax + dx * m, z = az + dz * m;
          if (Math.hypot(x, z) > shoreRadius(x, z) + 10) continue; // deep sea does the job out there
          pieces.push({ x, z, y: heightAt(x, z), len: w - u, ry: Math.atan2(bx - ax, bz - az) });
        }
      }
    }
  }
  return pieces;
}

export function buildRidgeWalls(G) {
  // 5 m above the crest is plenty against jumping over a 3 m bank, and a low
  // wall stays out of the way of the camera and of mouse clicks. They are also
  // listed as invisible so clicks on the ground beyond look straight through.
  G.invisibleColliders ??= new Set();
  for (const p of ridgeWallPieces()) {
    const body = G.physics.addCuboid(p.x, p.y + 1.5, p.z, 0.8, 3.5, p.len / 2, p.ry);
    G.invisibleColliders.add(body.collider(0).handle);
  }
}

// Big rocks along the low banks so the edge of an area reads at a glance,
// picked to suit the region (sea stacks by the beach, mossy boulders in the
// forest, spires elsewhere). Visual only: the invisible walls block.
const ROCKS = {
  beach: ['coastalBoulder', 'seaStack', 'coastalBoulder'],
  harbor: ['coastalBoulder', 'seaStack', 'coastalBoulder'],
  forest: ['mossBoulder', 'rockSpire', 'mossBoulder'],
  default: ['rockSpire', 'coastalBoulder', 'mossBoulder'],
};
export function decorateRidges(G, { spacing = 5.5 } = {}) {
  const rand = rng(77);
  for (const r of RIDGES) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      for (let d = spacing / 2; d < len; d += spacing * (0.7 + rand() * 0.6)) {
        const x = ax + ((bx - ax) * d) / len + (rand() - 0.5) * 1.5;
        const z = az + ((bz - az) * d) / len + (rand() - 0.5) * 1.5;
        if (Object.values(GATES).some((g) => Math.hypot(x - g.x, z - g.z) < 7)) continue;
        if (Math.hypot(x, z) > shoreRadius(x, z) + 6) continue;
        const set = ROCKS[regionAt(x, z)] ?? ROCKS.default;
        const key = set[Math.floor(rand() * set.length)];
        place(G, key, x, z, { y: heightAt(x, z) - 0.4, ry: rand() * Math.PI * 2, s: 1.2 + rand() * 0.7, body: 'none' });
      }
    }
  }
}
