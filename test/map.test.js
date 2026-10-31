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

import { ridgeWallPieces } from '../src/world/walls.js';
describe('ridge walls', () => {
  const pieces = ridgeWallPieces();
  it('leave every gate open', () => {
    for (const [name, g] of Object.entries(GATES)) {
      const near = pieces.filter((p) => Math.hypot(p.x - g.x, p.z - g.z) < 3.6);
      expect(near, name).toEqual([]);
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
