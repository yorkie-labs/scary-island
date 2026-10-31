import { heightAt, ridgeAt, pathAt, regionAt, slopeAt } from './map.js';

// Deterministic random points inside a region, off roads and ridges, away
// from the spots a layout keeps clear. Pure: same seed, same forest.
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function scatterIn(region, n, { seed = 1, spacing = 4, keepClear = [], minY = 0.8, maxSlope = 25, bounds = null } = {}) {
  const rand = rng(seed);
  const out = [];
  for (let k = 0; k < n * 40 && out.length < n; k++) {
    const b = bounds ?? { x0: -130, x1: 130, z0: -130, z1: 130 };
    const x = b.x0 + rand() * (b.x1 - b.x0), z = b.z0 + rand() * (b.z1 - b.z0);
    if (region && regionAt(x, z) !== region) continue;
    if (heightAt(x, z) < minY || ridgeAt(x, z).k > 0.05 || pathAt(x, z) > 0.05) continue;
    if (slopeAt(x, z) > maxSlope) continue;
    if (keepClear.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r)) continue;
    if (out.some((p) => Math.hypot(p.x - x, p.z - z) < spacing)) continue;
    out.push({ x, z, ry: rand() * Math.PI * 2, r: rand() });
  }
  return out;
}
