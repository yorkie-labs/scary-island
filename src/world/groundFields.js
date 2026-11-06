// What the ground is made of, per vertex of the island's render grid (pure,
// no Three), for the ground shader (island.js). Each kind of ground is a 0/1
// mask blurred over a few metres, so the shader can cut it at 0.5 with a
// little noise: soft, wavy borders instead of the old per-triangle colour
// picks (a saw-tooth along every border). The land under the masks (meadow,
// forest floor, village green, harbor sand) is one colour per vertex, also
// blurred, so the regions fade into each other.
import { heightAt, ridgeAt, pathAt, regionAt, slopeAt, WORLD_HALF, REGIONS } from './map.js';

export const RES = 1.5; // m between grid vertices (the collider uses the same grid)

/** The land's colour by region (sRGB 0..1; the shader adds patches and flecks). */
export const LAND = {
  grass: [0.475, 0.722, 0.353], // #79b85a
  forest: [0.247, 0.478, 0.298], // #3f7a4c
  village: [0.49, 0.604, 0.525], // #7d9a86
  harbor: [0.776, 0.639, 0.42], // #c6a36b
};

/** One vertex's raw (unblurred) values at world (x, z), height y. */
export function groundAt(x, z, y = heightAt(x, z)) {
  const region = regionAt(x, z);
  const ridge = ridgeAt(x, z).k;
  const slope = slopeAt(x, z, RES / 2);
  const beach = region === 'beach' && y < 2.4 && Math.hypot(x - REGIONS.beach.x, z - REGIONS.beach.z) < 30;
  const sand = y < 1.4 || beach || (region === 'harbor' && y < 2.2) ? 1 : 0;
  const rock = ridge > 0.35 || slope > 38 || (y > 16 && region !== 'forest') ? 1 : 0;
  const path = pathAt(x, z) > 0.5 ? 1 : 0;
  const cobble = region === 'village' && (path || Math.hypot(x - 64, z + 4) < 16) ? 1 : 0;
  const land = LAND[region] ?? LAND.grass;
  return { sand, rock, path, cobble, land };
}

/** Box blur (radius `r` cells) of an n×n field in place, twice: a soft bell over ~2r cells each way. */
export function blur(f, n, r, passes = 2) {
  const tmp = new Float32Array(f.length);
  for (let pass = 0; pass < passes; pass++) {
    for (const [src, dst, dx, dy] of [[f, tmp, 1, 0], [tmp, f, 0, 1]]) {
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          let s = 0, c = 0;
          for (let k = -r; k <= r; k++) {
            const ii = i + k * dx, jj = j + k * dy;
            if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
            s += src[jj * n + ii]; c++;
          }
          dst[j * n + i] = s / c;
        }
      }
    }
  }
  return f;
}

/**
 * The whole grid: `n` vertices a side from -WORLD_HALF, their heights and
 * the blurred fields: `mask` (sand, rock, path, cobble: 4 per vertex) and
 * `land` (RGB, 3 per vertex).
 */
export function groundFields() {
  const n = Math.round((WORLD_HALF * 2) / RES) + 1;
  const X = (i) => -WORLD_HALF + i * RES;
  const heights = new Float32Array(n * n);
  const sand = new Float32Array(n * n), rock = new Float32Array(n * n), path = new Float32Array(n * n), cobble = new Float32Array(n * n);
  const lr = new Float32Array(n * n), lg = new Float32Array(n * n), lb = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i, x = X(i), z = X(j), y = heightAt(x, z);
      heights[k] = y;
      if (y < -6.5) { sand[k] = 1; lr[k] = LAND.grass[0]; lg[k] = LAND.grass[1]; lb[k] = LAND.grass[2]; continue; } // (open sea: never seen)
      const g = groundAt(x, z, y);
      sand[k] = g.sand; rock[k] = g.rock; path[k] = g.path; cobble[k] = g.cobble;
      [lr[k], lg[k], lb[k]] = g.land;
    }
  }
  // borders over ~3 m (paths narrower: they are only ~4 m wide), the regions' land over ~9 m
  for (const f of [sand, rock, cobble]) blur(f, n, 1);
  blur(path, n, 1, 1);
  for (const f of [lr, lg, lb]) blur(f, n, 3);
  const mask = new Float32Array(n * n * 4), land = new Float32Array(n * n * 3);
  for (let k = 0; k < n * n; k++) {
    mask.set([sand[k], rock[k], path[k], cobble[k]], k * 4);
    land.set([lr[k], lg[k], lb[k]], k * 3);
  }
  return { n, step: RES, heights, mask, land };
}
