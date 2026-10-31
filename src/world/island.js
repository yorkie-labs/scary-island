import * as THREE from 'three';
import { heightAt, ridgeAt, pathAt, regionAt, slopeAt, noise, WORLD_HALF, SEA_LEVEL, REGIONS } from './map.js';

// Low-poly island ground: one flat colour per face, chosen by what the face
// is (sand, turf, forest floor, rock, road, cobbles), like the catalogue's own
// terrains. Region colours follow the GDD palette (§10.2).
const COLORS = {
  seabed: new THREE.Color('#c9b98a'),
  sand: new THREE.Color('#f0d9a0'),
  wetSand: new THREE.Color('#d8bf86'),
  grass: new THREE.Color('#79b85a'),
  grassLight: new THREE.Color('#93c76a'),
  forest: new THREE.Color('#3f7a4c'),
  forestMoss: new THREE.Color('#4f6f8f'),
  rock: new THREE.Color('#8d8378'),
  rockDark: new THREE.Color('#6d655d'),
  path: new THREE.Color('#b98d5a'),
  cobble: new THREE.Color('#a6a3a8'),
  villageGrass: new THREE.Color('#7d9a86'),
  harbor: new THREE.Color('#c6a36b'),
};

const RES = 1.5;

function faceColor(x, z, y, slope) {
  const c = new THREE.Color();
  const region = regionAt(x, z);
  const ridge = ridgeAt(x, z).k;
  const jitter = (noise(x * 0.8, z * 0.8) - 0.5) * 0.08;
  if (y < SEA_LEVEL - 0.4) c.copy(COLORS.seabed);
  else if (y < SEA_LEVEL + 0.35) c.copy(COLORS.wetSand);
  else if (ridge > 0.35 || slope > 38) c.copy(y > 14 || noise(x * 0.3, z * 0.3) > 0.5 ? COLORS.rock : COLORS.rockDark);
  else if (pathAt(x, z) > 0.5) c.copy(region === 'village' ? COLORS.cobble : COLORS.path);
  else if (y < 1.4 || (region === 'beach' && y < 2.4 && Math.hypot(x - REGIONS.beach.x, z - REGIONS.beach.z) < 30)) c.copy(COLORS.sand);
  else if (region === 'forest') c.copy(noise(x * 0.15, z * 0.15) > 0.62 ? COLORS.forestMoss : COLORS.forest);
  else if (region === 'village') c.copy(Math.hypot(x - 64, z + 4) < 16 ? COLORS.cobble : COLORS.villageGrass);
  else if (region === 'harbor') c.copy(y < 2.2 ? COLORS.sand : COLORS.harbor);
  else if (y > 16) c.copy(COLORS.rock);
  else c.copy(noise(x * 0.12, z * 0.12) > 0.55 ? COLORS.grassLight : COLORS.grass);
  return c.offsetHSL(0, 0, jitter);
}

export function createIslandMesh() {
  const n = Math.round((WORLD_HALF * 2) / RES);
  const hs = new Float32Array((n + 1) * (n + 1));
  const X = (i) => -WORLD_HALF + i * RES;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) hs[j * (n + 1) + i] = heightAt(X(i), X(j));
  const H = (i, j) => hs[j * (n + 1) + i];

  const pos = [], col = [];
  const push = (ax, az, bx, bz, cx, cz, ai, aj, bi, bj, ci, cj) => {
    const ya = H(ai, aj), yb = H(bi, bj), yc = H(ci, cj);
    pos.push(ax, ya, az, bx, yb, bz, cx, yc, cz);
    const mx = (ax + bx + cx) / 3, mz = (az + bz + cz) / 3, my = (ya + yb + yc) / 3;
    const c = faceColor(mx, mz, my, slopeAt(mx, mz, RES / 2));
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x0 = X(i), x1 = X(i + 1), z0 = X(j), z1 = X(j + 1);
      // skip deep open sea entirely
      if (Math.max(H(i, j), H(i + 1, j), H(i, j + 1), H(i + 1, j + 1)) < -6.5) continue;
      if ((i + j) % 2) {
        push(x0, z0, x0, z1, x1, z0, i, j, i, j + 1, i + 1, j);
        push(x1, z0, x0, z1, x1, z1, i + 1, j, i, j + 1, i + 1, j + 1);
      } else {
        push(x0, z0, x0, z1, x1, z1, i, j, i, j + 1, i + 1, j + 1);
        push(x0, z0, x1, z1, x1, z0, i, j, i + 1, j + 1, i + 1, j);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'island';
  mesh.receiveShadow = true;
  return mesh;
}

// A friendly sea with a slow swell; the colour fades into the fog.
export function createSea() {
  const geo = new THREE.CircleGeometry(420, 72).rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: '#3fa6c4', roughness: 0.3, metalness: 0.05, transparent: true, opacity: 0.86,
  }));
  sea.name = 'sea';
  sea.position.y = SEA_LEVEL;
  sea.receiveShadow = true;
  sea.userData.tick = (t) => { sea.position.y = SEA_LEVEL + Math.sin(t * 0.7) * 0.07; };
  return sea;
}
