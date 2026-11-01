import { describe, it, expect } from 'vitest';
import { heightAt, ridgeAt, GATES, REGIONS, PADS, slopeAt } from '../src/world/map.js';
import { BEACH_SPAWN } from '../src/world/regions/beach.js';

describe('island map', () => {
  it('every gate is a walkable gap in its ridge', () => {
    for (const [name, g] of Object.entries(GATES)) {
      expect(ridgeAt(g.x, g.z).k, name).toBeLessThan(0.05);
      expect(heightAt(g.x, g.z), name).toBeGreaterThan(0.3);
    }
  });
  it('region centres are dry land', () => {
    for (const [name, r] of Object.entries(REGIONS)) expect(heightAt(r.x, r.z), name).toBeGreaterThan(0.5);
  });
  it('the beach spawn is dry and gentle', () => {
    expect(heightAt(BEACH_SPAWN.x, BEACH_SPAWN.z)).toBeGreaterThan(0.2);
    expect(slopeAt(BEACH_SPAWN.x, BEACH_SPAWN.z)).toBeLessThan(15);
  });
  it('ridges are low banks the camera sees over, but steep at their faces', () => {
    const g = GATES.stoneDoor;
    const rise = heightAt(g.x + 12, g.z) - heightAt(g.x + 12, g.z + 8);
    expect(rise).toBeGreaterThan(1.8);
    expect(rise).toBeLessThan(5);
    expect(slopeAt(g.x + 12, g.z + 2.6)).toBeGreaterThan(40);
  });
  it('pads are level', () => {
    for (const [x, z, r, h] of PADS) expect(Math.abs(heightAt(x, z) - h)).toBeLessThan(0.6);
  });
});

import { ridgeWallPieces, GATE_CLEAR } from '../src/world/walls.js';
import { RIDGES, shoreRadius } from '../src/world/map.js';
describe('ridge walls', () => {
  const pieces = ridgeWallPieces();
  // a piece is a box: len along ry, 0.8 m to each side
  const covers = (p, x, z) => {
    const ax = Math.sin(p.ry), az = Math.cos(p.ry);
    const along = (x - p.x) * ax + (z - p.z) * az, across = (x - p.x) * az - (z - p.z) * ax;
    return Math.abs(along) <= p.len / 2 + 1e-6 && Math.abs(across) <= 0.8;
  };
  it('leave every gate open (nothing within GATE_CLEAR of one)', () => {
    for (const [name, g] of Object.entries(GATES)) {
      for (let a = 0; a < Math.PI * 2; a += 0.1) {
        for (let d = 0; d < GATE_CLEAR - 0.05; d += 0.25) {
          const x = g.x + Math.sin(a) * d, z = g.z + Math.cos(a) * d;
          expect(pieces.some((p) => covers(p, x, z)), `${name} at ${d.toFixed(2)} m`).toBe(false);
        }
      }
    }
  });
  it('leave no hole beside a gate (every point of a ridge is walled or within a gate)', () => {
    for (const r of RIDGES) {
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        for (let s = 0; s <= len; s += 0.2) {
          const x = ax + ((bx - ax) * s) / len, z = az + ((bz - az) * s) / len;
          if (Math.hypot(x, z) > shoreRadius(x, z) + 6) continue; // out at sea
          if (Object.values(GATES).some((g) => Math.hypot(x - g.x, z - g.z) < GATE_CLEAR + 0.01)) continue;
          expect(pieces.some((p) => covers(p, x, z)), `hole at ${x.toFixed(1)}, ${z.toFixed(1)}`).toBe(true);
        }
      }
    }
  });
  it('cover the ridges between the gates', () => {
    expect(pieces.length).toBeGreaterThan(60);
  });
});

// Hand-placed things that must stand on dry land (the full in-game scan is
// scripts/scenarios/dryland.js, which also checks walkability).
describe('placements are on dry land', () => {
  const spots = {
    'harbor chest': [80, 52], 'harbor treat a': [72, 72], 'harbor treat b': [48, 58], 'harbor treat c': [76, 46],
    'forest treat c': [-90, -8], 'forest chest': [-86, -30], 'beach chest': [-33, 93], 'village chest': [88, 12],
  };
  for (const [name, [x, z]] of Object.entries(spots)) {
    it(name, () => expect(heightAt(x, z)).toBeGreaterThan(0.3));
  }
});
