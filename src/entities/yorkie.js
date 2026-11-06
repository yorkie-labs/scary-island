import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { addOutline } from './outline.js';

// Yorkie, the Yorkshire terrier hero (GDD §3.1): golden-orange and dark brown
// fur, big round brown eyes, a sky-blue hoodie, black cargo pants, black and
// white sneakers and a big wooden hammer. Built from low-poly primitives in
// the same flat-shaded style as the Polyfork catalogue, with pivots placed so
// it can be animated by hand (no skeleton needed).

export const YORKIE_COLORS = {
  fur: '#e3a24f', furDark: '#6e4224', muzzle: '#f8e6c4', eye: '#3d220f', nose: '#1d1612',
  hoodie: '#8fd3f4', hoodieDark: '#6bb6db', string: '#ffffff', silk: '#f2c27a',
  pants: '#26262b', pocket: '#34343b', shoe: '#18181b', sole: '#f2f2f2',
  wood: '#b07a46', woodDark: '#7a5230', band: '#8c8f96',
};

// Cel shading, as in the character art: light falls in three flat tones
// instead of a smooth gradient (the black outline is addOutline's).
let ramp = null;
function toonRamp() {
  if (!ramp) {
    ramp = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;
  }
  return ramp;
}

// Brush strokes of fur, painted once on a canvas and laid over the fur
// colours, so the coat reads as fur and not as plastic.
let furStrokes = null;
function furTexture() {
  if (furStrokes || typeof document === 'undefined') return furStrokes;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * 128, y = rnd() * 128, len = 8 + rnd() * 14, bend = (rnd() - 0.5) * 6;
    g.strokeStyle = rnd() < 0.7 ? 'rgba(90, 50, 20, 0.22)' : 'rgba(255, 240, 210, 0.35)';
    g.lineWidth = 1 + rnd() * 1.5;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + bend, y + len / 2, x + bend * 0.5, y + len);
    g.stroke();
  }
  furStrokes = new THREE.CanvasTexture(c);
  furStrokes.wrapS = furStrokes.wrapT = THREE.RepeatWrapping;
  furStrokes.repeat.set(2, 2);
  furStrokes.colorSpace = THREE.SRGBColorSpace;
  return furStrokes;
}
const FUR = new Set();

const mats = new Map();
function mat(hex, extra = {}) {
  const key = hex + JSON.stringify(extra);
  if (!mats.has(key)) {
    const { roughness, metalness, ...toon } = extra; // (a toon material has neither)
    const m = new THREE.MeshToonMaterial({ color: hex, gradientMap: toonRamp(), map: FUR.has(hex) ? furTexture() : null, ...toon });
    if (FUR.has(hex)) addRim(m);
    mats.set(key, m);
  }
  return mats.get(key);
}

// A warm band of light round the fur's edge (fresnel, cut sharp like the
// cel tones), so Yorkie stands out from the ground from the far camera and
// at night (as secret-cave's Maltese).
export const RIM = { color: new THREE.Color('#ffe6b8'), strength: 0.45, from: 0.62, to: 0.72 };
function addRim(m) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = { value: RIM.color.clone().multiplyScalar(RIM.strength) };
    shader.fragmentShader = `uniform vec3 uRim;\n${shader.fragmentShader}`.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += uRim * smoothstep(${RIM.from.toFixed(2)}, ${RIM.to.toFixed(2)}, 1.0 - abs(dot(normal, normalize(vViewPosition))));`);
  };
  m.customProgramCacheKey = () => 'yorkieRim';
}

function mesh(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, extra } = {}) {
  const m = new THREE.Mesh(geo, mat(color, extra));
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

for (const k of ['fur', 'furDark', 'silk']) FUR.add(YORKIE_COLORS[k]);

const pivot = (name, x = 0, y = 0, z = 0) => {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  return g;
};

export function createHammer() {
  const C = YORKIE_COLORS;
  const g = pivot('hammer');
  g.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.52, 6), C.wood, { y: 0.2 }));
  const head = pivot('hammerHead', 0, 0.48, 0);
  // a grey claw hammer, as the character art carries it: a round striking
  // face on one side, a curved claw on the other
  const steel = { metalness: 0.4, roughness: 0.45 };
  head.add(mesh(new THREE.BoxGeometry(0.14, 0.13, 0.12), '#a3a8ae', { extra: steel }));
  head.add(mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.11, 8), '#8d9298', { x: 0.115, rz: Math.PI / 2, extra: steel }));
  head.add(mesh(new THREE.BoxGeometry(0.16, 0.06, 0.1), '#a3a8ae', { x: -0.12, y: 0.04, rz: -0.45, extra: steel }));
  head.add(mesh(new THREE.BoxGeometry(0.08, 0.05, 0.09), '#8d9298', { x: -0.2, y: -0.01, rz: -1.0, extra: steel }));
  g.add(head);
  return g;
}

// The eye, painted once per side on a canvas (mirrored: the big highlight
// toward the nose and up, as in the art) and laid on the face as a decal.
const EYE_SIZE = 0.15; // m across (the head before its 1.12 scale)
const EYE_TURN = 0.18; // rad each eye looks outward
const eyeMats = new Map();
function eyeMaterial(side) {
  if (!eyeMats.has(side)) {
    const map = eyeTexture(side); // (none outside a browser: a plain dark eye)
    eyeMats.set(side, new THREE.MeshToonMaterial({
      gradientMap: toonRamp(), map, color: map ? '#ffffff' : YORKIE_COLORS.eye,
      transparent: true, alphaTest: 0.5, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    }));
  }
  return eyeMats.get(side);
}
function eyeTexture(side) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const C = YORKIE_COLORS;
  const disc = (x, y, r, color) => { g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  disc(64, 64, 62, '#2a160a'); // the thin dark rim
  disc(64, 64, 56, '#8a5226'); // a warm brown iris
  disc(64, 66, 39, C.eye); // the pupil
  disc(64 - side * 17, 42, 16, '#ffffff'); // the big highlight (toward the nose, up)
  disc(64 + side * 19, 86, 7, '#ffffff'); // and a little one
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createYorkie() {
  const C = YORKIE_COLORS;
  const root = pivot('yorkie');
  const body = pivot('body'); // everything; rolls and bobs as one
  root.add(body);

  const hips = pivot('hips', 0, 0.34, 0);
  body.add(hips);

  // Legs: cargo pants with a side pocket, sneakers with white soles.
  const legs = {};
  for (const side of [-1, 1]) {
    const leg = pivot(side < 0 ? 'legL' : 'legR', side * 0.085, 0, 0);
    leg.add(mesh(new THREE.CylinderGeometry(0.062, 0.055, 0.26, 7), C.pants, { y: -0.13 }));
    leg.add(mesh(new THREE.BoxGeometry(0.03, 0.07, 0.07), C.pocket, { x: side * 0.065, y: -0.12 }));
    leg.add(mesh(new THREE.BoxGeometry(0.032, 0.035, 0.008), '#ff8a1c', { x: side * 0.066, y: -0.115, z: 0.03 })); // orange piping
    const foot = pivot('foot', 0, -0.27, 0.02);
    foot.add(mesh(new THREE.BoxGeometry(0.1, 0.07, 0.17), C.shoe, { y: 0.0, z: 0.02 }));
    foot.add(mesh(new THREE.BoxGeometry(0.106, 0.025, 0.176), C.sole, { y: -0.04, z: 0.02 }));
    foot.add(mesh(new THREE.BoxGeometry(0.06, 0.012, 0.05), C.sole, { y: 0.037, z: 0.05 }));
    leg.add(foot);
    hips.add(leg);
    legs[side < 0 ? 'L' : 'R'] = leg;
  }

  // Torso: hoodie with a front pocket and drawstrings.
  const torso = pivot('torso', 0, 0.02, 0);
  hips.add(torso);
  torso.add(mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.3, 8), C.hoodie, { y: 0.15 }));
  torso.add(mesh(new THREE.BoxGeometry(0.16, 0.07, 0.03), C.hoodieDark, { y: 0.07, z: 0.155 }));
  for (const side of [-1, 1]) {
    torso.add(mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.09, 4), C.string, { x: side * 0.035, y: 0.24, z: 0.15 }));
  }
  // the fur bib spilling out of the hood at the chest
  for (const [x, rz] of [[-0.05, 0.25], [0, 0], [0.05, -0.25]]) torso.add(mesh(new THREE.ConeGeometry(0.045, 0.11, 4), C.silk, { x, y: 0.27, z: 0.12, rx: Math.PI - 0.5, rz }));
  // a fluffy tail peeking out under the hoodie
  const tail = pivot('tail', 0, 0.02, -0.15);
  tail.add(mesh(new THREE.IcosahedronGeometry(0.06, 0), C.furDark, { y: 0.05, z: -0.02, sy: 1.3, rx: -0.5 }));
  tail.add(mesh(new THREE.IcosahedronGeometry(0.055, 0), C.fur, { y: 0.13, z: -0.04, sy: 1.3, rx: -0.2 }));
  tail.add(mesh(new THREE.ConeGeometry(0.045, 0.1, 4), C.silk, { y: 0.21, z: 0.0, rx: 0.5 }));
  torso.add(tail);

  // Arms: hoodie sleeves with furry paws. The right paw holds the hammer.
  const arms = {};
  for (const side of [-1, 1]) {
    const arm = pivot(side < 0 ? 'armL' : 'armR', side * 0.18, 0.26, 0);
    arm.add(mesh(new THREE.CylinderGeometry(0.048, 0.05, 0.2, 6), C.hoodie, { y: -0.1 }));
    arm.add(mesh(new THREE.IcosahedronGeometry(0.062, 0), C.fur, { y: -0.225 })); // a fluffy paw
    torso.add(arm);
    arms[side < 0 ? 'L' : 'R'] = arm;
  }
  const hand = pivot('hand', 0, -0.22, 0.02);
  arms.R.add(hand);
  const hammer = createHammer();
  hammer.rotation.set(-0.7, 0, 0.25); // carried on the shoulder
  hammer.position.set(0, 0, -0.02);
  hand.add(hammer);

  // Head: big, round, fluffy. Hood hangs behind it.
  const neck = pivot('neck', 0, 0.32, 0);
  torso.add(neck);
  torso.add(mesh(new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.hoodieDark, { y: 0.27, z: -0.08, rx: -0.6, sx: 1.1 }));
  const head = pivot('head', 0, 0.22, 0);
  head.scale.setScalar(1.12); // the art's big head
  neck.add(head);
  // The head, after the character art: a big mass of fur around a smooth tan
  // face. The fur is built from chunky faceted clumps (low-poly fur), not
  // spikes: dark brown at the back and down the cheeks, golden on top, with a
  // few flame-like locks on the crown sweeping up and back. (Spikes all round
  // a ball made a pufferfish.)
  const skull = mesh(new THREE.IcosahedronGeometry(0.25, 1), C.fur, { sx: 1.1, sy: 0.96, sz: 0.95 });
  head.add(skull);
  const clump = (x, y, z, r, color, { sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0 } = {}) =>
    head.add(mesh(new THREE.IcosahedronGeometry(r, 0), color, { x, y, z, sx, sy, sz, rx, ry, rz }));
  // the fur mass: the back of the head, darker
  // (the game looks from above and behind: golden on top, dark only lower down)
  clump(0, -0.02, -0.08, 0.2, C.furDark, { sx: 1.0, sy: 0.92, sz: 0.85, rz: 0.3 });
  clump(0, 0.11, -0.03, 0.225, C.fur, { sx: 1.02, sy: 0.9, sz: 0.95, rx: 0.4 });
  for (const side of [-1, 1]) {
    // the cheeks: a little darker fur at the sides, falling past the jaw (kept
    // close to the face: bigger clumps made a mane)
    clump(side * 0.2, -0.02, -0.03, 0.11, C.furDark, { sx: 0.75, sz: 1.0, rz: side * 0.6, ry: side * 0.4 });
    clump(side * 0.17, -0.12, 0.02, 0.085, C.furDark, { sx: 0.8, sy: 1.15, rz: side * 0.9 });
    clump(side * 0.13, -0.16, 0.12, 0.065, C.fur, { rz: side * 0.5 });
    // a little V of fur over each eye (the brave look)
    head.add(mesh(new THREE.BoxGeometry(0.075, 0.018, 0.02), '#c98a3e', { x: side * 0.1, y: 0.115, z: 0.225, rz: side * 0.35 }));
  }
  // the crown: flame-like locks standing up and sweeping back
  const UP = new THREE.Vector3(0, 1, 0);
  const lock = (x, y, z, dx, dy, dz, len, r, color) => {
    const p = pivot('lock', x, y, z);
    p.quaternion.setFromUnitVectors(UP, new THREE.Vector3(dx, dy, dz).normalize());
    p.add(mesh(new THREE.ConeGeometry(r, len, 4), color, { y: len / 2, sz: 0.55 }));
    head.add(p);
  };
  // a crest of wide, short flames (a single tall one read as a horn)
  lock(0, 0.2, 0.06, 0, 1, 0.1, 0.13, 0.11, C.silk);
  lock(0.09, 0.19, 0.03, 0.45, 1, -0.1, 0.11, 0.1, C.silk);
  lock(-0.09, 0.19, 0.03, -0.45, 1, -0.05, 0.11, 0.1, C.silk);
  lock(0.05, 0.21, -0.07, 0.25, 1, -0.5, 0.1, 0.1, C.fur);
  lock(-0.05, 0.21, -0.07, -0.25, 1, -0.5, 0.1, 0.1, C.fur);
  head.add(mesh(new THREE.IcosahedronGeometry(0.13, 1), C.muzzle, { y: -0.08, z: 0.19, sx: 1.1, sy: 0.8, sz: 1.1 }));
  head.add(mesh(new THREE.IcosahedronGeometry(0.04, 0), C.nose, { y: -0.04, z: 0.325 }));
  // a little smile under the nose
  head.add(mesh(new THREE.TorusGeometry(0.03, 0.007, 4, 8, Math.PI), C.nose, { y: -0.1, z: 0.31, rz: Math.PI, sx: 1.2 }));
  // big round eyes: painted on the faceted face as decals (projected onto
  // the head's own facets), so they follow its shape and never bulge past
  // its outline nor get cut by it from the side (as secret-cave's Maltese).
  // A warm brown iris in a thin dark rim, a big pupil, two highlights. No
  // outline (it would read as lashes). The pivot is the eye's centre: a
  // blink squashes it.
  const eyes = [];
  root.updateMatrixWorld(true);
  const toHead = head.matrixWorld.clone().invert();
  for (const side of [-1, 1]) {
    const at = new THREE.Vector3(side * 0.1, 0.03, 0.2);
    const eye = pivot('eye', at.x, at.y, at.z);
    const world = at.clone().applyMatrix4(head.matrixWorld);
    const turn = new THREE.Euler(0, side * EYE_TURN, 0); // (looking a little outward, as the face turns)
    const g = new DecalGeometry(skull, world, turn, new THREE.Vector3(EYE_SIZE, EYE_SIZE, 0.2).multiplyScalar(head.scale.x));
    g.applyMatrix4(toHead).translate(-at.x, -at.y, -at.z);
    const m = new THREE.Mesh(g, eyeMaterial(side));
    m.userData.noOutline = true;
    m.castShadow = false;
    m.receiveShadow = true;
    eye.add(m);
    head.add(eye);
    eyes.push(eye);
  }
  // big pointy ears leaning out, pink inside, darker at the edge
  const ears = [];
  for (const side of [-1, 1]) {
    const ear = pivot('ear', side * 0.19, 0.15, -0.02);
    ear.rotation.set(0, side * 0.75, -side * 0.5); // turned out, so the pink shows from the side too
    ear.add(mesh(new THREE.ConeGeometry(0.1, 0.25, 4), C.furDark, { y: 0.11, sz: 0.45 }));
    ear.add(mesh(new THREE.ConeGeometry(0.085, 0.21, 4), C.fur, { y: 0.1, z: 0.012, sz: 0.4 }));
    ear.add(mesh(new THREE.ConeGeometry(0.055, 0.15, 4), '#f2a99a', { y: 0.08, z: 0.025, sz: 0.3 }));
    head.add(ear);
    ears.push(ear);
  }

  root.userData.rig = { body, hips, torso, neck, head, legs, arms, hand, hammer, tail, ears, eyes };
  addOutline(root, { thickness: 0.018, minSize: 0.05 });
  return root;
}

// A hoodie in another colour (playing together, so friends tell their
// Yorkies apart). Swaps the shared hoodie materials on this one model only.
export function tintHoodie(root, hex) {
  const C = YORKIE_COLORS;
  if (hex === C.hoodie) return root;
  const dark = '#' + new THREE.Color(hex).offsetHSL(0, 0, -0.12).getHexString();
  const swap = { [mat(C.hoodie).uuid]: mat(hex), [mat(C.hoodieDark).uuid]: mat(dark) };
  root.traverse((o) => { if (o.isMesh && swap[o.material.uuid]) o.material = swap[o.material.uuid]; });
  return root;
}

// Procedural animation. `state` carries what the controller knows; `action`
// is a one-shot ({ name, t, duration }) the player triggers.
export function createYorkieAnimator(root) {
  const r = root.userData.rig;
  let phase = 0, time = 0, blink = 2;
  const lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;
  const earZ = r.ears.map((e) => e.rotation.z); // (how far each ear leans out at rest)
  // springs (secondary motion, as secret-cave's Maltese): each follows a
  // signal of the pose late and overshoots a little; the ears and the tail
  // bend by how far it lags behind
  const springs = { head: { x: 0, v: 0 }, lean: { x: 0, v: 0 }, bob: { x: 0, v: 0 } };
  const follow = (s, target, dt, k = 70, c = 7) => {
    if (!(dt > 0)) { s.x = target; s.v = 0; return 0; } // (a pose held still: at rest)
    const n = Math.ceil(dt / 0.02), h = dt / n;
    for (let i = 0; i < n; i++) { s.v += (k * (target - s.x) - c * s.v) * h; s.x += s.v * h; }
    return clamp(s.x - target, -0.6, 0.6);
  };

  return function animate(dt, { speed = 0, grounded = true, vy = 0, action = null, hidden = false, sitting = false, airborne = false }) {
    time += dt;
    const moving = speed > 0.1;
    phase += dt * (moving ? speed * 4.2 : 0);
    const run = Math.min(1, speed / 4.6);
    const swing = moving ? Math.sin(phase) * (0.5 + run * 0.35) : 0;

    // base pose
    r.body.scale.setScalar(1);
    r.body.position.set(0, moving ? Math.abs(Math.sin(phase)) * 0.04 * (1 + run) : Math.sin(time * 2) * 0.006, 0);
    r.body.rotation.set(0, 0, 0);
    r.legs.L.rotation.set(swing, 0, 0);
    r.legs.R.rotation.set(-swing, 0, 0);
    r.arms.L.rotation.set(-swing * 0.8, 0, 0.15);
    r.arms.R.rotation.set(swing * 0.5 - 0.25, 0, -0.15);
    r.torso.rotation.set(run * 0.18, 0, 0);
    r.neck.rotation.set(-run * 0.12 + Math.sin(time * 1.7) * 0.03, 0, 0);
    r.tail.rotation.set(0, 0, Math.sin(time * (moving ? 18 : 9)) * 0.5);
    for (const [i, ear] of r.ears.entries()) { ear.rotation.x = Math.sin(time * 3 + i) * 0.05 - run * 0.4; ear.rotation.z = earZ[i]; }

    if (!grounded) {
      const up = vy > 0;
      r.legs.L.rotation.x = up ? -0.7 : 0.4;
      r.legs.R.rotation.x = up ? 0.3 : -0.2;
      r.arms.L.rotation.set(-2.4, 0, 0.3);
      r.arms.R.rotation.set(-2.0, 0, -0.3);
    }
    if (sitting) {
      // sitting in the mine cart: legs forward, paws on the rim; arms up on a hop
      r.body.position.set(0, -0.18, 0);
      r.torso.rotation.x = -0.15;
      r.legs.L.rotation.x = r.legs.R.rotation.x = -1.45;
      if (airborne) { r.arms.L.rotation.set(-2.7, 0, 0.35); r.arms.R.rotation.set(-2.7, 0, -0.35); }
      else { r.arms.L.rotation.set(-0.9, 0, 0.45); r.arms.R.rotation.set(-0.9, 0, -0.45); }
      for (const ear of r.ears) ear.rotation.x = -0.6; // ears blown back by the wind
      r.tail.rotation.z = Math.sin(time * 20) * 0.6;
      for (const e of r.eyes) e.scale.y = 1;
      return;
    }
    if (hidden) {
      r.body.position.y -= 0.12;
      r.legs.L.rotation.x = r.legs.R.rotation.x = -1.1;
      r.torso.rotation.x = 0.5;
    }

    // blink
    blink -= dt;
    const closed = blink < 0.12;
    if (blink < 0) blink = 2 + Math.random() * 3;
    for (const e of r.eyes) e.scale.y = closed ? 0.15 : 1;

    // the hammer rests on the shoulder, and points out along the arm to bonk
    r.hammer.rotation.set(-0.7, 0, 0.25);

    if (action) {
      const k = Math.min(1, action.t / action.duration);
      switch (action.name) {
        case 'swing': { // wind up over the head, then bonk forward
          const a = k < 0.35 ? lerp(0, -2.9, k / 0.35) : lerp(-2.9, -0.2, Math.min(1, (k - 0.35) / 0.25));
          r.arms.R.rotation.set(a, 0, -0.1);
          r.arms.L.rotation.set(a * 0.9, 0, 0.1);
          r.hammer.rotation.set(Math.PI, 0, 0);
          r.torso.rotation.x = k < 0.35 ? -0.25 : 0.35;
          break;
        }
        case 'roll': {
          // tumble around the middle of the curled-up body (not the feet), so
          // the head never dips under the ground mid-roll
          // curl up a little (0.8x) and turn about half the curled height
          // (Yorkie is ~1.2 m to the tip of the top-knot)
          const th = k * Math.PI * 2, curl = 0.8, c = 0.6 * curl;
          r.body.scale.setScalar(curl);
          r.body.rotation.x = th;
          r.body.position.y = c - c * Math.cos(th) + Math.sin(k * Math.PI) * 0.08;
          r.body.position.z = -c * Math.sin(th);
          r.legs.L.rotation.x = r.legs.R.rotation.x = -1.6;
          r.arms.L.rotation.x = r.arms.R.rotation.x = -1.5;
          break;
        }
        case 'bark': {
          const s = Math.sin(k * Math.PI * 4);
          r.neck.rotation.x = -0.4 + s * 0.2;
          r.body.position.y += Math.max(0, s) * 0.05;
          for (const ear of r.ears) ear.rotation.x = -0.5;
          break;
        }
        case 'sniff': {
          r.torso.rotation.x = 0.6;
          r.neck.rotation.set(0.5 + Math.sin(time * 20) * 0.05, Math.sin(time * 4) * 0.4, 0);
          r.tail.rotation.z = Math.sin(time * 25) * 0.6;
          break;
        }
        case 'hurt': {
          r.torso.rotation.x = -0.4 * Math.sin(k * Math.PI);
          r.body.position.z = -0.1 * Math.sin(k * Math.PI);
          for (const ear of r.ears) ear.rotation.x = 0.6;
          break;
        }
        case 'interact': {
          r.arms.R.rotation.x = -1.2 * Math.sin(k * Math.PI);
          r.arms.L.rotation.x = -1.2 * Math.sin(k * Math.PI);
          r.torso.rotation.x = 0.3 * Math.sin(k * Math.PI);
          break;
        }
        case 'cheer': {
          r.arms.L.rotation.set(-2.8, 0, 0.4);
          r.arms.R.rotation.set(-2.8, 0, -0.4);
          r.body.position.y += Math.abs(Math.sin(k * Math.PI * 3)) * 0.15;
          break;
        }
        default: break;
      }
    }

    // after the pose: the ears and the tail lag behind every nod, lean and
    // bounce on springs, and flop out a little on a hop
    const nod = follow(springs.head, r.torso.rotation.x + r.neck.rotation.x + r.head.rotation.x, dt, 60, 6);
    const lean = follow(springs.lean, r.body.rotation.z + r.neck.rotation.y * 0.5, dt, 50, 5);
    const bob = follow(springs.bob, r.body.position.y, dt, 120, 9);
    for (const [i, ear] of r.ears.entries()) {
      const side = i ? 1 : -1;
      ear.rotation.x = clamp(ear.rotation.x + nod * 0.8, -0.9, 0.8);
      ear.rotation.z = earZ[i] + clamp(lean * 0.6 - side * Math.min(0.15, Math.abs(bob) * 1.2), -0.4, 0.4);
    }
    r.tail.rotation.x = clamp(r.tail.rotation.x - bob * 2.5 + nod * 0.5, -0.4, 0.4);
  };
}
