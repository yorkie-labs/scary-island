import { describe, it, expect } from 'vitest';
import { astar, smooth, lineWalkable } from '../src/systems/nav.js';

// A 20 x 20 field with a wall at x = 10 that has a gap at z = 15,
// and a tall "tree top" at (5, 5) that is walkable but 3 m up.
const cell = (ix, iz) => {
  if (ix < 0 || iz < 0 || ix >= 20 || iz >= 20) return null;
  if (ix === 10 && iz !== 15) return null;
  if (ix === 5 && iz === 5) return { y: 3 };
  return { y: 0 };
};
const h = (tx, tz) => (ix, iz) => Math.hypot(ix - tx, iz - tz);

describe('A* click-to-move paths', () => {
  it('goes through the gap instead of the wall', () => {
    const res = astar(cell, { ix: 2, iz: 2 }, (x, z) => x === 18 && z === 2, h(18, 2));
    expect(res.partial).toBeFalsy();
    expect(res.cells.some((c) => c.ix === 10 && c.iz === 15)).toBe(true);
  });
  it('never climbs onto a tree top', () => {
    const res = astar(cell, { ix: 2, iz: 2 }, (x, z) => x === 5 && z === 5, h(5, 5), { maxNodes: 400 });
    expect(res.partial).toBe(true); // gets as close as it can
    expect(res.cells.at(-1)).not.toEqual({ ix: 5, iz: 5 });
  });
  it('smoothing keeps only the corners', () => {
    const res = astar(cell, { ix: 2, iz: 2 }, (x, z) => x === 18 && z === 2, h(18, 2));
    const s = smooth(cell, res.cells);
    expect(s.length).toBeLessThan(res.cells.length);
    for (let i = 0; i < s.length - 1; i++) expect(lineWalkable(cell, s[i], s[i + 1])).toBe(true);
  });
});
