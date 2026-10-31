import * as THREE from 'three';

// Where Yorkie can walk, and how to get there, the way Diablo's click-to-move
// works: a click only ever means a spot on walkable ground, and Yorkie finds a
// way around trees, houses and cliffs instead of walking into them.
//
// The world is sampled lazily on a 1 m grid. A cell is walkable when a
// downward ray finds ground there, that ground is above the sea, and a small
// ball at hip height fits without touching anything solid. Moving between
// neighbouring cells is allowed only for small height changes, so tree tops,
// roofs, ridge crests and the invisible ridge walls are never reachable.

export const CELL = 1;
// metres of rise between neighbouring 1 m cells: matches what the character
// controller climbs (46° slopes plus a 0.3 m autostep), so every ledge Yorkie
// can really walk up is clickable; tree tops and walls are still metres up.
export const MAX_STEP = 1.1;
const MAX_NODES = 9000;

// Small binary heap keyed on f.
function heap() {
  const a = [];
  const up = (i) => { while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } };
  const down = (i) => {
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let m = i;
      if (l < a.length && a[l].f < a[m].f) m = l;
      if (r < a.length && a[r].f < a[m].f) m = r;
      if (m === i) break;
      [a[m], a[i]] = [a[i], a[m]]; i = m;
    }
  };
  return {
    push(n) { a.push(n); up(a.length - 1); },
    pop() { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; down(0); } return top; },
    get size() { return a.length; },
  };
}

// Pure A* over a cell function: cell(ix, iz) -> { y } | null.
export function astar(cell, start, goalTest, heuristic, { maxNodes = MAX_NODES, maxStep = MAX_STEP } = {}) {
  const key = (x, z) => `${x},${z}`;
  const open = heap(), came = new Map(), g = new Map(), closed = new Set();
  g.set(key(start.ix, start.iz), 0);
  open.push({ ix: start.ix, iz: start.iz, f: heuristic(start.ix, start.iz) });
  let visited = 0, best = null, bestH = Infinity;
  while (open.size && visited < maxNodes) {
    const cur = open.pop();
    const ck = key(cur.ix, cur.iz);
    if (closed.has(ck)) continue;
    closed.add(ck);
    visited++;
    const h = heuristic(cur.ix, cur.iz);
    if (h < bestH) { bestH = h; best = cur; }
    if (goalTest(cur.ix, cur.iz)) return rebuild(came, cur, key);
    const here = cell(cur.ix, cur.iz);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      const nx = cur.ix + dx, nz = cur.iz + dz;
      const nk = key(nx, nz);
      if (closed.has(nk)) continue;
      const there = cell(nx, nz);
      if (!there || Math.abs(there.y - here.y) > maxStep) continue;
      // no cutting corners past a blocked cell
      if (dx && dz && (!cell(cur.ix + dx, cur.iz) || !cell(cur.ix, cur.iz + dz))) continue;
      const cost = g.get(ck) + (dx && dz ? Math.SQRT2 : 1) + Math.abs(there.y - here.y);
      if (cost >= (g.get(nk) ?? Infinity)) continue;
      g.set(nk, cost);
      came.set(nk, cur);
      open.push({ ix: nx, iz: nz, f: cost + heuristic(nx, nz) });
    }
  }
  return best ? { partial: true, ...rebuild(came, best, key) } : null;
}

function rebuild(came, end, key) {
  const cells = [end];
  let cur = end;
  while (came.has(key(cur.ix, cur.iz))) { cur = came.get(key(cur.ix, cur.iz)); cells.push(cur); }
  return { cells: cells.reverse() };
}

// Straight-line walk across the grid: true when every cell on the way is
// walkable with gentle steps (used to smooth paths and for short moves).
export function lineWalkable(cell, a, b, maxStep = MAX_STEP) {
  const dist = Math.hypot(b.ix - a.ix, b.iz - a.iz);
  const n = Math.max(1, Math.ceil(dist * 2));
  let prev = cell(a.ix, a.iz);
  if (!prev) return false;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const c = cell(Math.round(a.ix + (b.ix - a.ix) * t), Math.round(a.iz + (b.iz - a.iz) * t));
    if (!c || Math.abs(c.y - prev.y) > maxStep) return false;
    prev = c;
  }
  return true;
}

export function smooth(cell, cells) {
  if (cells.length <= 2) return cells;
  const out = [cells[0]];
  let anchor = 0;
  for (let i = 2; i < cells.length; i++) {
    if (!lineWalkable(cell, cells[anchor], cells[i])) { out.push(cells[i - 1]); anchor = i - 1; }
  }
  out.push(cells[cells.length - 1]);
  return out;
}

export function createNav(G) {
  const { RAPIER, world } = G.physics;
  const cache = new Map();
  const flags = RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS;
  const ball = new RAPIER.Ball(0.3);
  const rot = { x: 0, y: 0, z: 0, w: 1 };
  const down = { x: 0, y: -1, z: 0 };
  const toIx = (v) => Math.round(v / CELL);

  // gates open, doors slide away: forget what we knew (only for flags that
  // open a way; anything else leaves the map as it was)
  const OPENS = new Set(['doorOpen', 'vinesCut', 'mineDoorOpen', 'villageDoorOpen', 'ancientGateOpen', 'sealReleased', 'cartDone']);
  G.on('flag', (name) => { if (OPENS.has(name)) cache.clear(); });
  // the ridge walls are solid but never ground to stand on
  const solid = (c) => !G.invisibleColliders?.has(c.handle);

  function sample(ix, iz) {
    const x = ix * CELL, z = iz * CELL;
    const cave = x > 400;
    const top = cave ? 4.4 : 60;
    // probe the middle and four points near the corners: a cell is walkable
    // only if they all find dry ground at about the same height, so a cell half
    // on a dock and half over water (or half on a ledge) is not
    const probe = (px, pz) => {
      const hit = world.castRay(new RAPIER.Ray({ x: px, y: top, z: pz }, down), top + 30, true, flags, undefined, undefined, undefined, solid);
      if (!hit) return null;
      const py = top - (hit.timeOfImpact ?? hit.toi);
      // the sea, even ankle-deep: paths never wade (from the water a dock is a
      // wall, and a child clicking the dock must walk to its steps instead)
      if (!cave && py < G.seaLevelAt(px, pz) + 0.15) return null;
      return py;
    };
    const y = probe(x, z);
    if (y === null) return null;
    const e = CELL * 0.4;
    for (const [dx, dz] of [[e, e], [-e, e], [e, -e], [-e, -e]]) {
      const cy = probe(x + dx, z + dz);
      if (cy === null || Math.abs(cy - y) > 0.5) return null;
    }
    if (world.intersectionWithShape({ x, y: y + 0.7, z }, rot, ball, flags)) return null; // something solid here
    return { y };
  }
  const cell = (ix, iz) => {
    const k = `${ix},${iz}`;
    if (!cache.has(k)) cache.set(k, sample(ix, iz));
    return cache.get(k);
  };

  const at = (c) => new THREE.Vector3(c.ix * CELL, cell(c.ix, c.iz)?.y ?? 0, c.iz * CELL);

  // Nearest walkable cell to a point (search outward in rings).
  function nearestWalkable(p, maxR = 4) {
    const cx = toIx(p.x), cz = toIx(p.z);
    for (let r = 0; r <= maxR; r++) {
      let best = null, bd = Infinity;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const c = cell(cx + dx, cz + dz);
        if (!c) continue;
        const d = Math.hypot(dx, dz) + Math.abs(c.y - p.y) * 0.5;
        if (d < bd) { bd = d; best = { ix: cx + dx, iz: cz + dz }; }
      }
      if (best) return best;
    }
    return null;
  }

  // A path of world points from `from` toward `to`. `near`: stop that close to
  // `to` (for monsters and objects that stand on unwalkable cells themselves).
  function findPath(from, to, { near = 0.5 } = {}) {
    const start = nearestWalkable(from, 2);
    if (!start) return null;
    const tx = to.x / CELL, tz = to.z / CELL;
    const reach = Math.max(near / CELL, 0.75);
    const goal = (ix, iz) => Math.hypot(ix - tx, iz - tz) <= reach;
    const h = (ix, iz) => Math.hypot(ix - tx, iz - tz);
    if (Math.hypot(start.ix - tx, start.iz - tz) > 120) return null;
    const res = astar(cell, start, goal, h);
    if (!res) return null;
    const pts = smooth(cell, res.cells).map(at);
    pts.shift(); // we are already standing on the first cell
    return { points: pts, partial: !!res.partial };
  }

  // Walk the straight line from `from` toward `to` as far as the ground lets a
  // small dog go (no gaps, no big steps): Diablo's "as far as you can that way".
  function lineReach(from, to) {
    const d = Math.hypot(to.x - from.x, to.z - from.z);
    let prev = cell(toIx(from.x), toIx(from.z));
    let last = null;
    for (let t = 0.5; t <= d; t += 0.5) {
      const x = from.x + ((to.x - from.x) * t) / d, z = from.z + ((to.z - from.z) * t) / d;
      const c = cell(toIx(x), toIx(z));
      if (!c || (prev && Math.abs(c.y - prev.y) > MAX_STEP)) break;
      last = new THREE.Vector3(x, c.y, z);
      prev = c;
    }
    return last;
  }

  return { cell, sample, nearestWalkable, findPath, lineReach, at, toIx, get cacheSize() { return cache.size; } };
}
