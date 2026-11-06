// Cozy look (tasks/20261106-cozy-look-todo.md, ported from secret-cave): the
// key light's direction, the shadow box that follows Yorkie (covers the view,
// snaps to texels) and the quality switch. Pure maths (render/shadowbox.js) checked against a
// real Three camera, plus the light rig (render/light.js) on Three lights.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DIST_MAX, DIST_MIN, ISO_FOV, ISO_PITCH, ISO_YAW } from '../src/player/isoCamera.js';
import { STEP, TO_KEY, lightFrame, shadowBounds, snapToTexel, toKey, viewDrop, viewGroundCorners } from '../src/render/shadowbox.js';
import { ISLAND_RIG, islandLight, keyElevation, tintColor } from '../src/render/light.js';

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const ASPECTS = { '4:3': 4 / 3, '1100×800': 1100 / 800, '16:9': 16 / 9, 'phone upright': 390 / 844 };
// the lens's distance as isoCamera sets it: the wheel's range, an upright
// window backs off by 1/sqrt(aspect) (up to 1.5×)
const lensDist = (d, aspect) => d * (aspect < 1 ? Math.min(1.5, 1 / Math.sqrt(aspect)) : 1);

describe('the key light', () => {
  const toCam = { x: Math.sin(ISO_YAW), y: 0, z: Math.cos(ISO_YAW) };
  const screenRight = { x: Math.cos(ISO_YAW), y: 0, z: -Math.sin(ISO_YAW) };
  // the key's height follows the stage's sun (day 43°, golden 26°, dusk 9°, night 40°), kept in 30–50°
  const KEYS = [TO_KEY, ...[0, 9, 26, 40, 43, 90].map((e) => toKey(keyElevation(e)))];
  it('is a unit vector, 30–50° up whatever the stage’s sun does (no shadows across the whole screen at dusk)', () => {
    expect(keyElevation(9)).toBe(30);
    expect(keyElevation(43)).toBe(43);
    expect(keyElevation(90)).toBe(50);
    for (const k of KEYS) {
      expect(Math.hypot(k.x, k.y, k.z)).toBeCloseTo(1, 9);
      const el = (Math.asin(k.y) * 180) / Math.PI;
      expect(el).toBeGreaterThanOrEqual(30 - 1e-9);
      expect(el).toBeLessThanOrEqual(50 + 1e-9);
    }
  });
  it('lights what faces the lens: a camera-facing ridge front or face gets N·L > 0.25', () => {
    for (const k of KEYS) {
      expect(dot(k, toCam)).toBeGreaterThan(0.25);
      // Yorkie's face, turned to the lens and tipped a little down (0.2 rad), is lit too
      const face = { x: toCam.x * Math.cos(0.2), y: -Math.sin(0.2), z: toCam.z * Math.cos(0.2) };
      expect(dot(k, face)).toBeGreaterThan(0.25);
    }
  });
  it('comes from the front-left: shadows fall up the screen (away from the viewer) and to the right', () => {
    for (const k of KEYS) {
      const fall = { x: -k.x, y: 0, z: -k.z };
      expect(dot(fall, toCam)).toBeLessThan(0);
      expect(dot(fall, screenRight)).toBeGreaterThan(0);
      // (not straight from behind the lens: the faces still get some modelling)
      const flat = Math.hypot(k.x, k.z);
      expect(Math.acos(dot(k, toCam) / flat) * 180 / Math.PI).toBeGreaterThan(20);
    }
  });
});

describe('shadow box texel snapping', () => {
  it('builds an orthonormal light frame, its right horizontal', () => {
    const { right, up, back } = lightFrame(TO_KEY);
    for (const v of [right, up, back]) expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(1, 9);
    expect(dot(right, up)).toBeCloseTo(0, 9);
    expect(dot(right, back)).toBeCloseTo(0, 9);
    expect(dot(up, back)).toBeCloseTo(0, 9);
    expect(right.y).toBeCloseTo(0, 9);
  });
  it('moves the centre by at most half a texel across the light, never along it', () => {
    const texel = 0.027;
    const { right, up, back } = lightFrame(TO_KEY);
    for (let i = 0; i < 200; i++) {
      const c = { x: Math.sin(i) * 140, y: -Math.abs(Math.cos(i * 1.3)) * 60, z: Math.cos(i * 0.7) * 140 };
      const s = snapToTexel(c, TO_KEY, texel);
      const d = { x: s.x - c.x, y: s.y - c.y, z: s.z - c.z };
      expect(Math.abs(dot(d, right))).toBeLessThanOrEqual(texel / 2 + 1e-9);
      expect(Math.abs(dot(d, up))).toBeLessThanOrEqual(texel / 2 + 1e-9);
      expect(Math.abs(dot(d, back))).toBeLessThan(1e-9);
    }
  });
  it('a walk inside one texel keeps the box still (no crawling edges); crossing texels moves it by whole texels', () => {
    const texel = 0.05;
    const { right, up } = lightFrame(TO_KEY);
    const base = snapToTexel({ x: 10, y: -12, z: -4 }, TO_KEY, texel);
    const a = snapToTexel({ x: base.x + right.x * 0.01, y: base.y + right.y * 0.01, z: base.z + right.z * 0.01 }, TO_KEY, texel);
    expect(Math.hypot(a.x - base.x, a.y - base.y, a.z - base.z)).toBeLessThan(1e-9);
    const b = snapToTexel({ x: base.x + right.x * 0.13, y: base.y + right.y * 0.13, z: base.z + right.z * 0.13 }, TO_KEY, texel);
    const moved = { x: b.x - base.x, y: b.y - base.y, z: b.z - base.z };
    expect(dot(moved, right) / texel).toBeCloseTo(3, 6);
    expect(dot(moved, up)).toBeCloseTo(0, 9);
    // a straight walk along the ground: every step lands the box on the same grid
    let prev = null;
    for (let k = 0; k < 60; k++) {
      const s = snapToTexel({ x: 3 + k * 0.037, y: -12, z: 8 - k * 0.021 }, TO_KEY, texel);
      const u = dot(s, right) / texel, v = dot(s, up) / texel;
      expect(Math.abs(u - Math.round(u))).toBeLessThan(1e-6);
      expect(Math.abs(v - Math.round(v))).toBeLessThan(1e-6);
      if (prev) expect(Math.abs(u - prev.u) + Math.abs(v - prev.v)).toBeLessThanOrEqual(3 + 1e-6); // (small hops only)
      prev = { u, v };
    }
  });
});

/** The view's ground corners the independent way: Three unprojects the NDC corners of a real camera. */
function threeCorners(dist, pitch, fov, aspect, level) {
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.1, 2000);
  cam.position.set(Math.sin(ISO_YAW) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(ISO_YAW) * Math.cos(pitch) * dist);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y]) => {
    const dir = new THREE.Vector3(x, y, 0.5).unproject(cam).sub(cam.position).normalize();
    const t = (level - cam.position.y) / dir.y;
    return { x: cam.position.x + dir.x * t, y: level, z: cam.position.z + dir.z * t };
  });
}

// the box as the rig builds it: the corners from the feet (0.6 m under the focus)
const fromFeet = (cs) => cs.map((c) => ({ x: c.x, y: c.y + 0.6, z: c.z }));
const boxFor = (view, drop, to = TO_KEY) => shadowBounds(fromFeet(viewGroundCorners(view, drop)), to);

describe('shadow box size', () => {
  const zooms = [DIST_MIN, 17, 22, DIST_MAX];
  it('holds every ground corner of the view at 4:3, 1100×800, 16:9 and an upright phone, every zoom, the 35° pitch (and steeper), every key height, with ground below', () => {
    for (const to of [toKey(30), toKey(50)]) for (const [name, aspect] of Object.entries(ASPECTS)) for (const d of zooms) for (const pitch of [ISO_PITCH, THREE.MathUtils.degToRad(56)]) for (const drop of [0.6, 12]) {
      const { right, up } = lightFrame(to);
      const dist = lensDist(d, aspect);
      const view = { dist, pitch, yaw: ISO_YAW, fovDeg: ISO_FOV, aspect };
      const b = boxFor(view, drop, to);
      // the box centre: the feet, snapped to a 2048 map's texel grid
      const feet = { x: 0, y: -0.6, z: 0 };
      const c = snapToTexel(feet, to, (b.right - b.left) / 2048, (b.top - b.bottom) / 2048);
      for (const p of [...threeCorners(dist, pitch, ISO_FOV, aspect, 0), ...threeCorners(dist, pitch, ISO_FOV, aspect, -drop)]) {
        const q = { x: p.x - c.x, y: p.y - c.y, z: p.z - c.z };
        const tag = `${name} dist ${dist.toFixed(1)} pitch ${(pitch * 180 / Math.PI).toFixed(0)} drop ${drop}`;
        expect(dot(q, right), tag).toBeGreaterThanOrEqual(b.left);
        expect(dot(q, right), tag).toBeLessThanOrEqual(b.right);
        expect(dot(q, up), tag).toBeGreaterThanOrEqual(b.bottom);
        expect(dot(q, up), tag).toBeLessThanOrEqual(b.top);
      }
      // and the hero's own surroundings (the feet ± 5 m on the ground)
      for (const [x, z] of [[5, 0], [-5, 0], [0, 5], [0, -5]]) {
        const q = { x: x - c.x, y: -0.6 - c.y, z: z - c.z };
        expect(dot(q, right)).toBeGreaterThan(b.left);
        expect(dot(q, right)).toBeLessThan(b.right);
        expect(dot(q, up)).toBeGreaterThan(b.bottom);
        expect(dot(q, up)).toBeLessThan(b.top);
      }
    }
  });
  it('matches Three’s camera (same corners) and is no bigger than needed (each side within a margin and a step)', () => {
    const { right, up } = lightFrame(TO_KEY);
    for (const aspect of Object.values(ASPECTS)) {
      const view = { dist: 30, pitch: ISO_PITCH, yaw: ISO_YAW, fovDeg: ISO_FOV, aspect };
      const mine = viewGroundCorners(view), ref = threeCorners(30, ISO_PITCH, ISO_FOV, aspect, 0);
      for (let i = 0; i < 4; i++) for (const k of ['x', 'y', 'z']) expect(mine[i][k]).toBeCloseTo(ref[i][k], 6);
      const pts = fromFeet(mine), b = shadowBounds(pts, TO_KEY);
      const us = pts.map((p) => dot(p, right)), vs = pts.map((p) => dot(p, up));
      expect(b.right).toBeLessThanOrEqual(Math.max(8, ...us) + 1.5 + STEP);
      expect(b.left).toBeGreaterThanOrEqual(Math.min(-8, ...us) - 1.5 - STEP);
      expect(b.top).toBeLessThanOrEqual(Math.max(8, ...vs) + 1.5 + STEP);
      expect(b.bottom).toBeGreaterThanOrEqual(Math.min(-8, ...vs) - 1.5 - STEP);
      for (const k of ['left', 'right', 'bottom', 'top']) expect(Math.abs(b[k] % STEP)).toBe(0); // (whole steps: a steady texel size)
    }
  });
  it('fits the view, not a square round the hero: far less area than the centred square, sharper texels', () => {
    const { right, up } = lightFrame(TO_KEY);
    const view = { dist: 30, pitch: ISO_PITCH, yaw: ISO_YAW, fovDeg: ISO_FOV, aspect: 16 / 9 };
    const pts = fromFeet(viewGroundCorners(view, 0.6)), b = shadowBounds(pts, TO_KEY);
    const half = Math.max(...pts.flatMap((p) => [Math.abs(dot(p, right)), Math.abs(dot(p, up))])) + 1.5;
    expect((b.right - b.left) * (b.top - b.bottom)).toBeLessThan(0.6 * (2 * half) ** 2);
    // (a 16:9 window at the widest zoom shows ~30 m across: ~2 cm a pixel; PCFSoft blurs a few texels anyway)
    expect(Math.max(b.right - b.left, b.top - b.bottom) / 2048).toBeLessThan(0.035);
  });
  it('grows with the zoom and the drop, never below ±8 m', () => {
    const size = (d, drop = 0.6) => { const b = boxFor({ dist: d, pitch: ISO_PITCH, yaw: ISO_YAW, fovDeg: ISO_FOV, aspect: 16 / 9 }, drop); return (b.right - b.left) * (b.top - b.bottom); };
    expect(size(DIST_MAX)).toBeGreaterThan(size(20));
    expect(size(20)).toBeGreaterThan(size(DIST_MIN));
    expect(size(30, 12)).toBeGreaterThan(size(30));
    const tiny = shadowBounds([], TO_KEY);
    expect(tiny).toEqual({ left: -10, right: 10, bottom: -10, top: 10 });
  });
});

describe('how far down the view sees (a ridge over low ground)', () => {
  const view = { dist: 30, pitch: ISO_PITCH, yaw: ISO_YAW, fovDeg: ISO_FOV, aspect: 1100 / 800 };
  const focus = { x: 0, y: 0.6, z: 0 };
  it('flat ground: nothing below the focus', () => {
    expect(viewDrop(view, focus, () => 0)).toBeLessThan(0.7);
  });
  it('a pit 15 m deep beyond the hero (up the screen): the far corners see its floor', () => {
    // (up the screen = away from the lens: −x −z)
    const pit = (x, z) => (x + z < -8 ? -15 : 0);
    const drop = viewDrop(view, focus, pit);
    expect(drop).toBeGreaterThan(14);
    expect(drop).toBeLessThan(16);
  });
  it('lower than it makes room for: capped', () => {
    expect(viewDrop(view, focus, (x, z) => (x + z < -8 ? -90 : 0), { max: 24 })).toBe(24);
  });
});

describe('the light rig on Three lights (render/light.js)', () => {
  // a stand-in for the Polyfork stage: its lights, its sun height, and a
  // setTime that writes new colours (as each region's time of day does)
  const rig = (elevation = 40) => {
    const hemi = new THREE.HemisphereLight(0x53659e, 0x1b2032, 0.7);
    const key = new THREE.DirectionalLight(0xaec6ff, 0.75);
    const look = { hemi, key, elevation };
    look.setTime = (v) => { hemi.color.set(0xfff0dc); hemi.groundColor.set(0xb9a68c); look.elevation = v; return look; };
    return look;
  };
  const lum = (c) => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
  it('tilts the hues, not the exposure: a cooler sky, a warmer ground; a soft shadow', () => {
    const look = rig();
    const sky0 = look.hemi.color.clone(), ground0 = look.hemi.groundColor.clone(), key0 = look.key.color.clone();
    islandLight(look);
    expect(lum(look.hemi.color)).toBeCloseTo(lum(sky0), 6);
    expect(lum(look.hemi.groundColor)).toBeCloseTo(lum(ground0), 6);
    expect(look.hemi.color.b / look.hemi.color.r).toBeGreaterThan(sky0.b / sky0.r); // cooler sky
    expect(look.hemi.groundColor.r / look.hemi.groundColor.b).toBeGreaterThan(ground0.r / ground0.b); // warmer ground
    expect(look.key.color.equals(key0)).toBe(true); // (the stage's key for the time of day)
    expect(look.key.shadow.intensity).toBe(ISLAND_RIG.shadow);
    expect(ISLAND_RIG.shadow).toBeLessThan(1);
    expect(look.key.shadow.mapSize.x).toBe(2048);
    const low = rig(); islandLight(low, { quality: 'low' });
    expect(low.key.shadow.mapSize.x).toBe(1024);
  });
  it('tilts again whenever the stage sets a new time of day, and the key follows the sun’s height', () => {
    const look = rig();
    const light = islandLight(look);
    look.setTime(26); // golden: warm colours written by the stage
    const golden = new THREE.Color(0xfff0dc);
    expect(lum(look.hemi.color)).toBeCloseTo(lum(golden), 6);
    expect(look.hemi.color.b / look.hemi.color.r).toBeGreaterThan(golden.b / golden.r);
    expect(light.toKey.y).toBeCloseTo(Math.sin(THREE.MathUtils.degToRad(30)), 9);
    look.setTime(43);
    expect(light.toKey.y).toBeCloseTo(Math.sin(THREE.MathUtils.degToRad(43)), 9);
  });
  it('a tint keeps the brightness', () => {
    const c = new THREE.Color(0.8, 0.6, 0.4);
    const l0 = lum(c);
    tintColor(c, [0.5, 1, 2]);
    expect(lum(c)).toBeCloseTo(l0, 9);
    expect(c.b).toBeGreaterThan(0.4);
  });
  it('puts the key on its direction from the snapped feet, the box round the view; a step inside a texel moves nothing', () => {
    const look = rig(50);
    const light = islandLight(look);
    const TO = toKey(50);
    const view = { dist: 30, pitch: ISO_PITCH, yaw: ISO_YAW, fovDeg: ISO_FOV, aspect: 16 / 9 };
    const feet = { x: 40, y: 3, z: 12 };
    light.update(feet, view, () => 3);
    const d = look.key.position.clone().sub(look.key.target.position).normalize();
    expect(d.dot(new THREE.Vector3(TO.x, TO.y, TO.z))).toBeCloseTo(1, 9);
    const want = boxFor(view, 0.6, TO);
    for (const k of ['left', 'right', 'bottom', 'top']) expect(look.key.shadow.camera[k]).toBe(want[k]);
    const tx = (want.right - want.left) / 2048, ty = (want.top - want.bottom) / 2048;
    const { right } = lightFrame(TO);
    const s = snapToTexel(feet, TO, tx, ty);
    light.update({ x: s.x + right.x * tx * 0.2, y: s.y, z: s.z + right.z * tx * 0.2 }, view, () => 3);
    light.update({ x: s.x + right.x * tx * 0.3, y: s.y, z: s.z + right.z * tx * 0.3 }, view, () => 3);
    expect(look.key.target.position.distanceTo(s)).toBeLessThan(1e-9);
    // (the shadow camera, aimed by Three, has the light frame's axes: its left/right are along `right`)
    look.key.updateMatrixWorld(); look.key.shadow.updateMatrices(look.key);
    const camRight = new THREE.Vector3().setFromMatrixColumn(look.key.shadow.camera.matrixWorld, 0);
    expect(camRight.dot(new THREE.Vector3(right.x, right.y, right.z))).toBeCloseTo(1, 6);
  });
  it('keeps its size while the view barely changes (no texel flicker), grows at once over low ground', () => {
    const look = rig();
    const light = islandLight(look);
    const view = { dist: 30, pitch: ISO_PITCH, yaw: ISO_YAW, fovDeg: ISO_FOV, aspect: 16 / 9 };
    const area = () => (light.box.right - light.box.left) * (light.box.top - light.box.bottom);
    light.update({ x: 0, y: 0, z: 0 }, view, () => 0);
    const box0 = { ...light.box };
    light.update({ x: 0, y: 0, z: 0 }, { ...view, dist: 29 }, () => 0);
    expect(light.box).toEqual(box0);
    const a0 = area();
    light.update({ x: 0, y: 0, z: 0 }, view, (x, z) => (x + z < -8 ? -15 : 0));
    expect(area()).toBeGreaterThan(a0);
  });
});

describe('the quality switch and the grade (render/post.js)', async () => {
  const { GRADE, SMALL, chooseQuality, qualityFromUrl } = await import('../src/render/post.js');
  it('`?q=low` is the low path, anything else high', () => {
    expect(qualityFromUrl('?q=low')).toBe('low');
    expect(qualityFromUrl('?start=heart&q=low&seed=4')).toBe('low');
    expect(qualityFromUrl('')).toBe('high');
    expect(qualityFromUrl('?q=high')).toBe('high');
    expect(qualityFromUrl('?q=potato')).toBe('high');
  });
  it('starts from the address, else the saved choice, else low on a small touch screen', () => {
    expect(chooseQuality({ search: '?q=low', saved: 'high' })).toBe('low');
    expect(chooseQuality({ search: '?q=high', saved: 'low', touch: true, shortSide: 390 })).toBe('high');
    expect(chooseQuality({ saved: 'low' })).toBe('low');
    expect(chooseQuality({ saved: 'high', touch: true, shortSide: 390 })).toBe('high');
    expect(chooseQuality({ touch: true, shortSide: 390 })).toBe('low');
    expect(chooseQuality({ touch: true, shortSide: SMALL + 1 })).toBe('high');
    expect(chooseQuality({})).toBe('high');
  });
  it('the grade lifts the shadows towards lavender blue (gently: the night stays dark) and warms the highlights', () => {
    const [r, g, b] = GRADE.lift;
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
    expect(Math.max(r, g, b)).toBeLessThan(0.03);
    expect(GRADE.warm[0]).toBeGreaterThan(GRADE.warm[2]);
    expect(GRADE.saturation).toBeGreaterThan(1);
    expect(GRADE.saturation).toBeLessThan(1.2);
  });
});
