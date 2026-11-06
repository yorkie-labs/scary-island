// The smooth ground (island.js, groundFields.js): the render mesh is still the
// collider's mesh (same grid, heights and diagonals), and the ground kinds are
// soft masks (no hard steps between neighbouring vertices).
import { describe, expect, it } from 'vitest';
import { createIslandMesh } from '../src/world/island.js';
import { blur, groundAt, groundFields, RES } from '../src/world/groundFields.js';
import { heightAt, PATHS, REGIONS, RIDGES, WORLD_HALF } from '../src/world/map.js';

describe('the island mesh (what the collider gets)', () => {
  const mesh = createIslandMesh();
  const pos = mesh.geometry.attributes.position, index = mesh.geometry.index;
  it('has every vertex on the 1.5 m grid at heightAt', () => {
    for (let k = 0; k < pos.count; k += 97) {
      const x = pos.getX(k), z = pos.getZ(k);
      expect(Math.abs((x + WORLD_HALF) / RES - Math.round((x + WORLD_HALF) / RES))).toBeLessThan(1e-4);
      expect(pos.getY(k)).toBeCloseTo(heightAt(x, z), 4);
    }
  });
  it('has the old triangles: two per cell, the diagonal alternating like a chequerboard, deep sea left out', () => {
    const n = Math.round((WORLD_HALF * 2) / RES);
    const X = (i) => -WORLD_HALF + i * RES;
    // the triangles as the old flat mesh built them, as sorted coordinate keys
    const key = (pts) => pts.map((p) => p.map((v) => v.toFixed(3)).join(',')).sort().join('|');
    const want = new Set();
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const P = (a, b) => [X(a), Math.fround(heightAt(X(a), X(b))), X(b)];
        if (Math.max(P(i, j)[1], P(i + 1, j)[1], P(i, j + 1)[1], P(i + 1, j + 1)[1]) < -6.5) continue;
        if ((i + j) % 2) { want.add(key([P(i, j), P(i, j + 1), P(i + 1, j)])); want.add(key([P(i + 1, j), P(i, j + 1), P(i + 1, j + 1)])); }
        else { want.add(key([P(i, j), P(i, j + 1), P(i + 1, j + 1)])); want.add(key([P(i, j), P(i + 1, j + 1), P(i + 1, j)])); }
      }
    }
    expect(index.count / 3).toBe(want.size);
    const V = (k) => [pos.getX(k), pos.getY(k), pos.getZ(k)];
    for (let t = 0; t < index.count; t += 3 * 53) {
      expect(want.has(key([V(index.getX(t)), V(index.getX(t + 1)), V(index.getX(t + 2))]))).toBe(true);
    }
  });
  it('shares its vertices (smooth normals), upward normals on flat ground', () => {
    expect(pos.count).toBeLessThan(index.count / 3); // (the old mesh had 3 per triangle)
    const nrm = mesh.geometry.attributes.normal;
    const n = Math.round((WORLD_HALF * 2) / RES) + 1;
    const k = Math.round((REGIONS.camp.z + WORLD_HALF) / RES) * n + Math.round((REGIONS.camp.x + WORLD_HALF) / RES);
    expect(nrm.getY(k)).toBeGreaterThan(0.95);
  });
});

describe('the ground fields', () => {
  const f = groundFields();
  const at = (x, z) => Math.round((z + WORLD_HALF) / RES) * f.n + Math.round((x + WORLD_HALF) / RES);
  it('keeps every mask in 0..1 and changes softly from vertex to vertex (no saw-tooth)', () => {
    let worst = 0;
    for (let j = 1; j < f.n; j++) {
      for (let i = 1; i < f.n; i++) {
        const k = j * f.n + i;
        for (let c = 0; c < 4; c++) {
          const v = f.mask[k * 4 + c];
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
          worst = Math.max(worst, Math.abs(v - f.mask[(k - 1) * 4 + c]), Math.abs(v - f.mask[(k - f.n) * 4 + c]));
        }
      }
    }
    expect(worst).toBeLessThan(0.45); // (a raw 0/1 mask steps by 1)
  });
  it('says what is where: sand on the beach, rock on a ridge, a road on a path, grass at the camp', () => {
    expect(f.mask[at(REGIONS.beach.x, REGIONS.beach.z) * 4]).toBeGreaterThan(0.9);
    const r = RIDGES[0].pts[1];
    expect(groundAt(r[0], r[1]).rock).toBe(1);
    const p = PATHS[0][1];
    expect(f.mask[at(p[0], p[1]) * 4 + 2]).toBeGreaterThan(0.5);
    const camp = at(REGIONS.camp.x + 8, REGIONS.camp.z + 8);
    expect(f.mask[camp * 4]).toBeLessThan(0.1);
    expect(f.land[camp * 3 + 1]).toBeGreaterThan(f.land[camp * 3 + 2]); // green
  });
  it('blur keeps the total and spreads a step', () => {
    const n = 9, g = new Float32Array(n * n);
    g[4 * n + 4] = 1;
    blur(g, n, 1);
    expect(g.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    expect(g[4 * n + 4]).toBeLessThan(0.5);
    expect(g[4 * n + 6]).toBeGreaterThan(0);
  });
});
