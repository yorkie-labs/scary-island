// Yorkie's look (tasks/20261106-cozy-look-todo.md): the eyes are decals on
// the face (on the fur ball's surface, never bulging past it), the coat is
// black and tan where a Yorkshire terrier's is, and the ears and the tail
// lag behind the pose on springs that settle.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createYorkie, createYorkieAnimator } from '../src/entities/yorkie.js';

const SKULL = { r: 0.25, sx: 1.08, sy: 0.97, sz: 0.98, amp: 0.06 }; // (createYorkie's head ball, its fur noise)

describe('the eyes', () => {
  const yorkie = createYorkie();
  const { head, eyes } = yorkie.userData.rig;
  it('are two decals on the front of the face, lying on the fur ball (no bulge, no gap)', () => {
    expect(eyes).toHaveLength(2);
    for (const eye of eyes) {
      const decal = eye.children.find((c) => c.isMesh);
      const pos = decal.geometry.attributes.position;
      expect(pos.count).toBeGreaterThan(12);
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).add(eye.position); // (head space)
        expect(v.z).toBeGreaterThan(0.1); // the front of the face
        // on the ball's surface: within its fur noise (the face is calmer, a little recessed)
        const k = Math.hypot(v.x / (SKULL.r * SKULL.sx), v.y / (SKULL.r * SKULL.sy), v.z / (SKULL.r * SKULL.sz));
        expect(k).toBeLessThanOrEqual(1 + SKULL.amp + 0.01);
        expect(k).toBeGreaterThan(0.9);
      }
    }
  });
  it('sit side by side, mirrored, an eye’s width apart', () => {
    const [l, r] = eyes;
    expect(l.position.x).toBeCloseTo(-r.position.x, 9);
    expect(l.position.y).toBeCloseTo(r.position.y, 9);
    expect(r.position.x - l.position.x).toBeGreaterThan(0.15);
  });
  it('have no outline (it would read as lashes) and cast no shadow', () => {
    for (const eye of eyes) {
      const decal = eye.children.find((c) => c.isMesh);
      expect(decal.children.some((c) => c.userData.isOutline)).toBe(false);
      expect(decal.castShadow).toBe(false);
    }
    expect(head.children.length).toBeGreaterThan(0);
  });
});

describe('the coat', () => {
  const yorkie = createYorkie();
  const skull = yorkie.userData.rig.head.children.find((c) => c.isMesh && c.geometry.attributes.color);
  const pos = skull.geometry.attributes.position, col = skull.geometry.attributes.color;
  // the vertex nearest a direction from the head's centre, and how bright its colour is
  const at = (x, y, z) => {
    const d = new THREE.Vector3(x, y, z).normalize(), v = new THREE.Vector3();
    let best = -2, i0 = 0;
    for (let i = 0; i < pos.count; i++) { const k = v.fromBufferAttribute(pos, i).normalize().dot(d); if (k > best) { best = k; i0 = i; } }
    return { r: col.getX(i0), g: col.getY(i0), b: col.getZ(i0), lum: 0.2126 * col.getX(i0) + 0.7152 * col.getY(i0) + 0.0722 * col.getZ(i0) };
  };
  it('is black over the crown and the back of the head, tan on the lower face and the cheeks', () => {
    for (const black of [at(0, 1, 0), at(0, 0.3, -1), at(0.6, 0.3, -0.6)]) expect(black.lum).toBeLessThan(0.06);
    for (const tan of [at(0, -0.2, 1), at(0.7, -0.4, 0.4), at(-0.7, -0.4, 0.4)]) {
      expect(tan.lum).toBeGreaterThan(0.15);
      expect(tan.r).toBeGreaterThan(tan.b * 2); // (warm)
    }
  });
  it('has a tan spot over each eye', () => {
    for (const side of [-1, 1]) expect(at(side * 0.42, 0.5, 0.76).lum).toBeGreaterThan(0.15);
    expect(at(0, 0.5, 0.86).lum).toBeLessThan(0.06); // (and black between them)
  });
});

describe('the ear and tail springs', () => {
  const setup = () => {
    const yorkie = createYorkie();
    const animate = createYorkieAnimator(yorkie);
    return { r: yorkie.userData.rig, animate };
  };
  const pose = (r) => [...r.ears.flatMap((e) => [e.rotation.x, e.rotation.z]), r.tail.rotation.x];
  it('a pose held still (dt 0) is the rest pose: no lag', () => {
    const { r, animate } = setup();
    const z0 = r.ears.map((e) => e.rotation.z);
    for (let i = 0; i < 30; i++) animate(1 / 60, { speed: 4.6 }); // running: the springs lag
    animate(0, { speed: 0 });
    r.ears.forEach((e, i) => expect(e.rotation.z).toBeCloseTo(z0[i], 9));
    expect(r.tail.rotation.x).toBeCloseTo(0, 9);
  });
  it('lag behind a run and a hop, then settle when Yorkie stands still', () => {
    const { r, animate } = setup();
    const z0 = r.ears.map((e) => e.rotation.z);
    let moved = 0;
    for (let i = 0; i < 60; i++) {
      animate(1 / 60, { speed: 4.6 });
      moved = Math.max(moved, ...r.ears.map((e, k) => Math.abs(e.rotation.z - z0[k])), Math.abs(r.tail.rotation.x));
    }
    expect(moved).toBeGreaterThan(0.01);
    for (let i = 0; i < 240; i++) animate(1 / 60, { speed: 0 });
    r.ears.forEach((e, i) => expect(Math.abs(e.rotation.z - z0[i])).toBeLessThan(0.02));
    expect(Math.abs(r.tail.rotation.x)).toBeLessThan(0.05);
  });
  it('stay bounded and finite through every action, at slow frame rates too', () => {
    for (const dt of [1 / 60, 0.1]) {
      const { r, animate } = setup();
      for (const name of ['swing', 'roll', 'bark', 'sniff', 'hurt', 'interact', 'cheer']) {
        const action = { name, t: 0, duration: 0.6 };
        for (let t = 0; t < 0.6; t += dt) { action.t = t; animate(dt, { speed: 2, action }); }
        for (const v of pose(r)) {
          expect(Number.isFinite(v)).toBe(true);
          expect(Math.abs(v)).toBeLessThan(1.2);
        }
      }
      animate(dt, { grounded: false, vy: 3 });
      for (const v of pose(r)) expect(Number.isFinite(v)).toBe(true);
    }
  });
});
