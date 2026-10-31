import { RIDGES, GATES, heightAt, shoreRadius, regionAt } from './map.js';
import { place } from './models.js';
import { rng } from './scatter.js';

// Invisible walls along each ridge crest, so no amount of jumping gets a
// player over a ridge and past a gate. Gaps are left at the gates.
export function ridgeWallPieces({ step = 3, gateClear = 5 } = {}) {
  const pieces = [];
  for (const r of RIDGES) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.ceil(len / step));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        if (Object.values(GATES).some((g) => Math.hypot(x - g.x, z - g.z) < gateClear)) continue;
        if (Math.hypot(x, z) > shoreRadius(x, z) + 10) continue; // deep sea does the job out there
        pieces.push({ x, z, y: heightAt(x, z), len: len / n + 0.6, ry: Math.atan2(bx - ax, bz - az) });
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
