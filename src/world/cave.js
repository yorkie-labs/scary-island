import * as THREE from 'three';
import { noise } from './map.js';

// Builds an underground cave from a grid of walkable cells: floor and ceiling
// quads per cell, a rocky wall wherever a walkable cell meets solid rock.
// Colliders are a floor slab, a ceiling slab and merged wall runs.

export const CELL = 2;
const mod3 = (n) => ((n % 3) + 3) % 3;

// rects: [x0, z0, x1, z1] in cells (inclusive), relative to the cave origin.
export function cellsFromRects(rects) {
  const cells = new Set();
  for (const [x0, z0, x1, z1] of rects) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) cells.add(`${x},${z}`);
  return cells;
}

const colors = {
  floor: [new THREE.Color('#5a4f63'), new THREE.Color('#4b4256'), new THREE.Color('#665a6e')],
  wall: [new THREE.Color('#463d58'), new THREE.Color('#3b3350'), new THREE.Color('#52476a')],
  ceil: new THREE.Color('#2b2438'),
};

export function buildCave(G, { origin, rects, height = 5 }) {
  const cells = cellsFromRects(rects);
  const has = (x, z) => cells.has(`${x},${z}`);
  // two meshes: the floor and the lowest course of wall, and everything above
  // it (upper walls, ceiling), which the top-down view hides
  const low = { pos: [], col: [] }, high = { pos: [], col: [] };
  const quad = (a, b, c, d, color, buf = low) => {
    buf.pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) buf.col.push(color.r, color.g, color.b);
  };
  const jitter = (x, y, z) => {
    const n = noise(x * 0.7 + 3, z * 0.7 + y * 0.5) - 0.5;
    return [x + n * 0.5, y, z + (noise(z * 0.7, x * 0.7 + y) - 0.5) * 0.5];
  };
  const walls = []; // [x, z, horizontal?] edge runs for colliders
  const ox = origin.x, oy = origin.y, oz = origin.z;

  for (const key of cells) {
    const [cx, cz] = key.split(',').map(Number);
    const x0 = ox + cx * CELL, x1 = x0 + CELL, z0 = oz + cz * CELL, z1 = z0 + CELL;
    const fc = colors.floor[mod3(cx * 7 + cz * 3)];
    quad([x0, oy, z0], [x0, oy, z1], [x1, oy, z1], [x1, oy, z0], fc);
    const top = oy + height;
    quad([x0, top, z0], [x1, top, z0], [x1, top, z1], [x0, top, z1], colors.ceil, high);
    // walls toward solid neighbours, built from 3 rows so they look carved
    const sides = [
      [0, -1, [x0, z0], [x1, z0]],
      [0, 1, [x1, z1], [x0, z1]],
      [-1, 0, [x0, z1], [x0, z0]],
      [1, 0, [x1, z0], [x1, z1]],
    ];
    for (const [dx, dz, a, b] of sides) {
      if (has(cx + dx, cz + dz)) continue;
      walls.push({ cx, cz, dx, dz });
      const rows = 3;
      for (let r = 0; r < rows; r++) {
        const y0 = oy + (height * r) / rows, y1 = oy + (height * (r + 1)) / rows;
        const wc = colors.wall[mod3(cx + cz + r)];
        quad(jitter(a[0], y0, a[1]), jitter(a[0], y1, a[1]), jitter(b[0], y1, b[1]), jitter(b[0], y0, b[1]), wc, r === 0 ? low : high);
      }
    }
  }
  const meshOf = (buf, name) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(buf.col, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, side: THREE.DoubleSide }));
    m.receiveShadow = true;
    m.castShadow = false; // the sun must not black out the cave
    m.name = name;
    G.scene.add(m);
    return m;
  };
  const mesh = meshOf(low, 'cave');
  G.groundMeshes?.push(mesh);
  const upper = meshOf(high, 'caveUpper');
  G.caveUpper = upper;

  // colliders: floor + ceiling slabs over the bounding box, one thin box per wall edge
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const key of cells) {
    const [cx, cz] = key.split(',').map(Number);
    minX = Math.min(minX, cx); maxX = Math.max(maxX, cx); minZ = Math.min(minZ, cz); maxZ = Math.max(maxZ, cz);
  }
  const cxm = ox + ((minX + maxX + 1) / 2) * CELL, czm = oz + ((minZ + maxZ + 1) / 2) * CELL;
  const hx = ((maxX - minX + 1) / 2) * CELL + 2, hz = ((maxZ - minZ + 1) / 2) * CELL + 2;
  // The ceiling and the cave walls are drawn low (or not at all) in the
  // top-down view, so for clicks and sight lines they count as invisible.
  G.invisibleColliders ??= new Set();
  const hide = (body) => G.invisibleColliders.add(body.collider(0).handle);
  G.physics.addCuboid(cxm, oy - 0.5, czm, hx, 0.5, hz);
  hide(G.physics.addCuboid(cxm, oy + height + 0.5, czm, hx, 0.5, hz));
  for (const w of walls) {
    const wx = ox + w.cx * CELL + CELL / 2 + w.dx * CELL / 2, wz = oz + w.cz * CELL + CELL / 2 + w.dz * CELL / 2;
    const horizontal = w.dz !== 0;
    hide(G.physics.addCuboid(wx + w.dx * 0.25, oy + height / 2, wz + w.dz * 0.25, horizontal ? CELL / 2 + 0.05 : 0.25, height / 2, horizontal ? 0.25 : CELL / 2 + 0.05));
  }
  // Bedrock: from above, everything that is not tunnel is solid dark rock at
  // the top of the visible wall course, like a Diablo dungeon, instead of an
  // empty void showing the evening sky.
  {
    const capY = oy + height / 3;
    const rock = { pos: [], col: [] };
    const tones = [new THREE.Color('#2e2740'), new THREE.Color('#262036'), new THREE.Color('#342c48')];
    const M = 16;
    for (let cx = minX - M; cx <= maxX + M; cx++) {
      for (let cz = minZ - M; cz <= maxZ + M; cz++) {
        if (has(cx, cz)) continue;
        const x0 = ox + cx * CELL, x1 = x0 + CELL, z0 = oz + cz * CELL, z1 = z0 + CELL;
        const j = (x, z) => capY + (noise(x * 0.9, z * 0.9) - 0.5) * 0.35;
        quad([x0, j(x0, z0), z0], [x0, j(x0, z1), z1], [x1, j(x1, z1), z1], [x1, j(x1, z0), z0], tones[mod3(cx * 5 + cz * 7)], rock);
      }
    }
    const cap = meshOf(rock, 'caveRock');
    // and far beyond, one dark plane so no sky ever shows below the camera
    const far = new THREE.Mesh(new THREE.CircleGeometry(260, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#1c1728' }));
    far.position.set(cxm, oy - 0.3, czm); // below the floor: only shows past the rock cap
    far.name = 'caveRock';
    G.scene.add(far);
    cap.userData.noFade = far.userData.noFade = true;
  }

  return { mesh, upper, cells, has, toWorld: (cx, cz) => new THREE.Vector3(ox + cx * CELL + CELL / 2, oy, oz + cz * CELL + CELL / 2) };
}
