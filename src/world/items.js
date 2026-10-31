import * as THREE from 'three';
import { createHammer } from '../entities/yorkie.js';

// Small hand-built models for things the catalogue has no match for: gems,
// treats, tools and ship parts. Same flat-shaded low-poly style.

const cache = new Map();
export function mat(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.6, ...extra }));
  return cache.get(key);
}
export function part(geo, color, o = {}, extra = {}) {
  const m = new THREE.Mesh(geo, mat(color, extra));
  m.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  m.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
  if (o.s) m.scale.setScalar(o.s);
  if (o.sx || o.sy || o.sz) m.scale.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
  m.castShadow = true;
  return m;
}
const group = (...children) => { const g = new THREE.Group(); children.forEach((c) => g.add(c)); return g; };

const glow = (color, i = 0.6) => ({ emissive: color, emissiveIntensity: i, roughness: 0.2, metalness: 0.1 });

export function diamond(size = 0.18, color = '#7fe3ff') {
  const g = group(
    part(new THREE.ConeGeometry(size, size * 1.1, 6), color, { y: -size * 0.55, rx: Math.PI }, glow(color, 0.5)),
    part(new THREE.CylinderGeometry(size * 0.6, size, size * 0.4, 6), '#c8f6ff', { y: size * 0.2 }, glow('#c8f6ff', 0.5)),
  );
  g.userData.spin = true;
  return g;
}

// A bone-shaped dog biscuit (the hidden treats, GDD §8.3).
export function treat() {
  const c = '#e8b06a';
  return group(
    part(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 6), c, { rz: Math.PI / 2 }),
    ...[-1, 1].flatMap((s) => [
      part(new THREE.IcosahedronGeometry(0.06, 0), c, { x: s * 0.16, y: 0.04 }),
      part(new THREE.IcosahedronGeometry(0.06, 0), c, { x: s * 0.16, y: -0.04 }),
    ]),
  );
}

export function potion() {
  return group(
    part(new THREE.IcosahedronGeometry(0.13, 1), '#ff5d8f', { y: 0.12 }, glow('#ff5d8f', 0.4)),
    part(new THREE.CylinderGeometry(0.04, 0.05, 0.08, 6), '#ffd6e3', { y: 0.27 }),
    part(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 6), '#8a5a3c', { y: 0.32 }),
  );
}

// A heart that heals on touch (food in the GDD: an apple-heart snack).
export function heartSnack() {
  const g = group(
    part(new THREE.IcosahedronGeometry(0.1, 1), '#ff4d6d', { x: -0.06, y: 0.05 }, glow('#ff4d6d', 0.3)),
    part(new THREE.IcosahedronGeometry(0.1, 1), '#ff4d6d', { x: 0.06, y: 0.05 }, glow('#ff4d6d', 0.3)),
    part(new THREE.ConeGeometry(0.14, 0.18, 6), '#ff4d6d', { y: -0.06, rx: Math.PI }, glow('#ff4d6d', 0.3)),
  );
  g.userData.spin = true;
  return g;
}

export function key(color = '#ffd34d') {
  const g = group(
    part(new THREE.TorusGeometry(0.08, 0.025, 6, 10), color, { y: 0.18 }, glow(color, 0.4)),
    part(new THREE.BoxGeometry(0.035, 0.22, 0.035), color, { y: 0 }, glow(color, 0.4)),
    part(new THREE.BoxGeometry(0.07, 0.03, 0.035), color, { x: 0.035, y: -0.07 }, glow(color, 0.4)),
    part(new THREE.BoxGeometry(0.05, 0.03, 0.035), color, { x: 0.025, y: -0.02 }, glow(color, 0.4)),
  );
  g.userData.spin = true;
  return g;
}

export function scissors() {
  return group(
    part(new THREE.TorusGeometry(0.06, 0.018, 6, 10), '#ff6b6b', { x: -0.06, y: -0.05 }),
    part(new THREE.TorusGeometry(0.06, 0.018, 6, 10), '#ff6b6b', { x: 0.06, y: -0.05 }),
    part(new THREE.BoxGeometry(0.03, 0.3, 0.015), '#d9dde3', { x: -0.02, y: 0.13, rz: 0.15 }, { metalness: 0.6, roughness: 0.3 }),
    part(new THREE.BoxGeometry(0.03, 0.3, 0.015), '#d9dde3', { x: 0.02, y: 0.13, rz: -0.15 }, { metalness: 0.6, roughness: 0.3 }),
  );
}

export function flashlight() {
  return group(
    part(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 8), '#ffcc33', { rz: Math.PI / 2 }),
    part(new THREE.CylinderGeometry(0.08, 0.05, 0.08, 8), '#ffcc33', { x: 0.16, rz: Math.PI / 2 }),
    part(new THREE.CylinderGeometry(0.07, 0.07, 0.01, 8), '#fffbe0', { x: 0.205, rz: Math.PI / 2 }, glow('#fffbe0', 1)),
  );
}

export function hammerPickup() {
  const h = createHammer();
  h.rotation.z = 0.5;
  return h;
}

export function enginePart() {
  const g = group(
    part(new THREE.BoxGeometry(0.42, 0.3, 0.3), '#6c7a89', { y: 0.15 }, { metalness: 0.5, roughness: 0.4 }),
    part(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 10), '#e0a020', { x: 0.25, y: 0.18, rz: Math.PI / 2 }, { metalness: 0.5 }),
    part(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 6), '#3d4650', { y: 0.38 }),
  );
  return g;
}

export function fuelCan() {
  return group(
    part(new THREE.BoxGeometry(0.3, 0.42, 0.16), '#d63c2f', { y: 0.21 }),
    part(new THREE.CylinderGeometry(0.03, 0.04, 0.1, 6), '#2d2d2d', { x: 0.1, y: 0.46, rz: -0.4 }),
    part(new THREE.TorusGeometry(0.06, 0.02, 4, 8, Math.PI), '#2d2d2d', { x: -0.05, y: 0.43 }),
  );
}

export function generatorPart() {
  return group(
    part(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 8), '#b87333', { y: 0.15 }, { metalness: 0.6, roughness: 0.35 }),
    part(new THREE.TorusGeometry(0.13, 0.025, 4, 12), '#e8c070', { y: 0.08, rx: Math.PI / 2 }, { metalness: 0.6 }),
    part(new THREE.TorusGeometry(0.13, 0.025, 4, 12), '#e8c070', { y: 0.22, rx: Math.PI / 2 }, { metalness: 0.6 }),
  );
}

export function energyCrystal(size = 0.35) {
  const g = group(
    part(new THREE.OctahedronGeometry(size, 0), '#ff7be5', { y: size, sy: 1.6 }, glow('#ff7be5', 0.9)),
    part(new THREE.OctahedronGeometry(size * 0.45, 0), '#9fe8ff', { x: size * 0.7, y: size * 0.6, rz: 0.5, sy: 1.5 }, glow('#9fe8ff', 0.8)),
    part(new THREE.OctahedronGeometry(size * 0.4, 0), '#9fe8ff', { x: -size * 0.6, y: size * 0.5, rz: -0.6, sy: 1.5 }, glow('#9fe8ff', 0.8)),
  );
  g.userData.spin = true;
  return g;
}

export function shipKey() {
  const g = key('#ff9f1c');
  g.scale.setScalar(1.6);
  return g;
}

// A rock with diamonds growing out of it: hit it with the hammer to mine.
export function oreRock(color = '#7fe3ff', size = 1) {
  const g = new THREE.Group();
  const rock = part(new THREE.DodecahedronGeometry(0.55 * size, 0), '#8b8f99', { y: 0.35 * size, sy: 0.75 });
  g.add(rock);
  const gems = new THREE.Group();
  gems.name = 'gems';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const gem = part(new THREE.OctahedronGeometry(0.13 * size, 0), color,
      { x: Math.cos(a) * 0.32 * size, y: (0.55 + (i % 2) * 0.15) * size, z: Math.sin(a) * 0.32 * size, rz: Math.cos(a) * 0.6, rx: Math.sin(a) * 0.6, sy: 1.7 }, glow(color, 0.6));
    gems.add(gem);
  }
  g.add(gems);
  return g;
}

// A bush to hide in (GDD §7.3 "숨기"): tall, round and leafy.
export function hideBush() {
  const g = new THREE.Group();
  const greens = ['#4f9a48', '#5fae52', '#3f8a40'];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = i === 0 ? 0 : 0.6;
    g.add(part(new THREE.IcosahedronGeometry(i === 0 ? 0.9 : 0.65, 0), greens[i % 3],
      { x: Math.cos(a) * r, y: i === 0 ? 0.85 : 0.55, z: Math.sin(a) * r }));
  }
  // little flowers so it reads as friendly
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7;
    g.add(part(new THREE.IcosahedronGeometry(0.08, 0), i % 2 ? '#ffd1e8' : '#fff3a6', { x: Math.cos(a) * 0.8, y: 0.9 + (i % 2) * 0.3, z: Math.sin(a) * 0.8 }));
  }
  return g;
}

// Sparkle marker floating over important pickups.
export function sparkle(color = '#fff6b0') {
  const s = part(new THREE.OctahedronGeometry(0.08, 0), color, {}, glow(color, 1.2));
  s.castShadow = false;
  s.userData.spin = true;
  return s;
}
