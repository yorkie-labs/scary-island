import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { addOutline } from './outline.js';

// Yorkie, the Yorkshire terrier hero (GDD §3.1): a fluffy black-and-tan
// puppy (after the user's photo, 2026-11-06): a round soft head, black on
// the back and the crown, tan face, cheeks, brows and ears, big round glossy
// black eyes, a small black nose, small upright ears with fringed tips. A
// sky-blue hoodie, black cargo pants, black and white sneakers and a big
// claw hammer. The clothes are flat-shaded primitives in the Polyfork style;
// the fur is smooth and softly noisy (`fluffy`, as secret-cave's Maltese),
// so it reads soft, not faceted. Pivots are placed so it animates by hand
// (no skeleton); the ears and the tail sway on springs in the animator.

export const YORKIE_COLORS = {
  tan: '#c98a4a', tanLight: '#e2b27a', black: '#38332f', earInner: '#e0a77c',
  eye: '#0c0807', eyeRim: '#1a1210', nose: '#141010', mouth: '#3a2022',
  hoodie: '#8fd3f4', hoodieDark: '#6bb6db', string: '#ffffff',
  pants: '#26262b', pocket: '#34343b', shoe: '#18181b', sole: '#f2f2f2',
  wood: '#b07a46', woodDark: '#7a5230', band: '#8c8f96',
};

const mats = new Map();
function mat(hex, extra = {}) {
  const key = hex + JSON.stringify(extra);
  if (!mats.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: 0.85, ...extra });
    if (extra.vertexColors) addRim(m);
    mats.set(key, m);
  }
  return mats.get(key);
}
// The fur: smooth, its colour (the black-and-tan pattern, the low spots a
// touch darker) in the vertex colours, and a soft warm rim of light round its
// edge (fresnel), so the dark coat stands out from the ground from the far
// camera and at night.
const FUR = { flatShading: false, roughness: 0.7, vertexColors: true };
export const RIM = { color: new THREE.Color('#ffe2b0'), strength: 0.32, power: 2.6 };
function addRim(m) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = { value: RIM.color.clone().multiplyScalar(RIM.strength) };
    shader.fragmentShader = `uniform vec3 uRim;\n${shader.fragmentShader}`.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += uRim * pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), ${RIM.power.toFixed(2)});`);
  };
  m.customProgramCacheKey = () => 'yorkieRim';
}

// Soft fur: a smooth ball nudged in and out by a fine fixed noise, so its
// outline is a little wispy and the light rolls softly over it (secret-cave's
// Maltese). `paint(n)` gives the colour where the ball faces `n` (unit, from
// its centre; default the colour 'tan'); `shape(v, n)` moves a vertex;
// `calm(n)` 0…1 smooths the noise there (the face, where the eyes sit).
const tmpColor = new THREE.Color();
export function fluffy(r, { w = 24, h = 16, amp = 0.05, freq = 9, seed = 1, shade = 0.16, paint = null, shape = null, calm = null } = {}) {
  let geo = new THREE.SphereGeometry(r, w, h);
  geo.deleteAttribute('uv'); geo.deleteAttribute('normal');
  geo = mergeVertices(geo);
  let s = seed * 9301 + 49297;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const waves = Array.from({ length: 7 }, (_, i) => {
    const k = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
    return { k, f: freq * (i < 4 ? 1 : 2.3), a: i < 4 ? 1 : 0.45, ph: rand() * 6.28 };
  });
  const p = geo.attributes.position, v = new THREE.Vector3(), n = new THREE.Vector3(), col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    n.fromBufferAttribute(p, i).normalize();
    let q = 0;
    for (const wv of waves) q += wv.a * Math.sin(n.dot(wv.k) * wv.f + wv.ph);
    q /= 3.4; // (about -1…1)
    if (calm) q *= 1 - calm(n);
    v.copy(n).multiplyScalar(r * (1 + amp * q));
    shape?.(v, n);
    p.setXYZ(i, v.x, v.y, v.z);
    const c = paint ? paint(n) : tmpColor.set(YORKIE_COLORS.tan);
    const k = 1 - shade * (0.5 - 0.5 * q);
    col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
const smooth = THREE.MathUtils.smoothstep;
const WHITE = '#ffffff'; // (fur: its colour is in the vertex colours)
const TAN = new THREE.Color(), BLACK = new THREE.Color(), LIGHT = new THREE.Color();
/** The coat at `n`: black where `black` (0…1) says, tan elsewhere, lighter tan where `light` says. */
function coat(black, light = 0) {
  TAN.set(YORKIE_COLORS.tan); BLACK.set(YORKIE_COLORS.black); LIGHT.set(YORKIE_COLORS.tanLight);
  return tmpColor.copy(TAN).lerp(LIGHT, light).lerp(BLACK, black);
}
const paintTan = () => coat(0);
const paintBlack = () => coat(1);

function mesh(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, extra } = {}) {
  const m = new THREE.Mesh(geo, mat(color, extra));
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

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
// toward the nose and up) and laid on the face as a decal: big, round,
// glossy black, as a puppy's.
const EYE_SIZE = 0.15; // m across (the head before its scale)
const EYE_TURN = 0.2; // rad each eye looks outward
const eyeMats = new Map();
function eyeMaterial(side) {
  if (!eyeMats.has(side)) {
    const map = eyeTexture(side); // (none outside a browser: a plain dark eye)
    eyeMats.set(side, new THREE.MeshStandardMaterial({
      map, color: map ? '#ffffff' : YORKIE_COLORS.eye, roughness: 0.15,
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
  disc(64, 64, 62, C.eyeRim); // the thin dark rim of skin
  disc(64, 64, 56, '#2a1810'); // a very dark brown iris, only just seen
  disc(64, 66, 44, C.eye); // the big pupil
  disc(64 - side * 16, 40, 14, '#ffffff'); // the big highlight (toward the nose, up)
  disc(64 + side * 18, 88, 6, '#e8ecf4'); // and a little one
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
  // the tan chest fur spilling out of the hood
  torso.add(mesh(fluffy(0.07, { amp: 0.12, freq: 13, seed: 37, paint: () => coat(0, 0.3) }), WHITE, { y: 0.28, z: 0.11, sx: 1.2, sy: 0.8, sz: 0.6, extra: FUR }));
  // a fluffy dark tail peeking out under the hoodie
  const tail = pivot('tail', 0, 0.02, -0.15);
  tail.add(mesh(fluffy(0.06, { amp: 0.12, freq: 12, seed: 41, paint: paintBlack }), WHITE, { y: 0.1, z: -0.02, sy: 1.9, rx: -0.4, extra: FUR }));
  torso.add(tail);

  // Arms: hoodie sleeves with furry paws. The right paw holds the hammer.
  const arms = {};
  for (const side of [-1, 1]) {
    const arm = pivot(side < 0 ? 'armL' : 'armR', side * 0.18, 0.26, 0);
    arm.add(mesh(new THREE.CylinderGeometry(0.048, 0.05, 0.2, 6), C.hoodie, { y: -0.1 }));
    arm.add(mesh(fluffy(0.06, { amp: 0.1, freq: 13, seed: 13 + side, paint: paintTan }), WHITE, { y: -0.225, extra: FUR })); // a fluffy tan paw
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
  // The head: one soft round ball of fur, the black-and-tan coat painted
  // on it (vertex colours, so the patches blend): black over the crown, the
  // back and round the eyes; tan on the lower face, the cheeks, under the
  // jaw and in a spot over each eye. The cheeks a little full; the face's
  // fur calm, so the eyes sit clean.
  const F = new THREE.Vector3(0, 0.05, 1).normalize();
  const brows = [-1, 1].map((side) => new THREE.Vector3(side * 0.42, 0.5, 0.76).normalize());
  const headCoat = (n) => {
    const face = smooth(n.z, 0.3, 0.6) * (1 - smooth(n.y, -0.02, 0.14)); // (the lower front of the face)
    const cheeks = smooth(-n.y, -0.12, 0.22) * smooth(n.z, -0.35, 0.05); // (down the cheeks, under the jaw)
    const brow = Math.max(...brows.map((b) => smooth(n.dot(b), 0.955, 0.985)));
    const tan = Math.max(face, cheeks, brow);
    return coat(1 - tan, face * 0.35);
  };
  const skull = mesh(fluffy(0.25, {
    w: 40, h: 28, amp: 0.06, freq: 11, seed: 23, paint: headCoat,
    calm: (n) => 0.8 * smooth(n.dot(F), 0.6, 0.85),
    shape: (v, n) => {
      const cheek = smooth(Math.abs(n.x), 0.3, 0.75) * smooth(-n.y, -0.25, 0.35) * smooth(n.z, -0.6, 0.2);
      v.multiplyScalar(1 - 0.06 * smooth(n.dot(F), 0.6, 0.88) + 0.08 * cheek);
    },
  }), WHITE, { sx: 1.08, sy: 0.97, sz: 0.98, extra: FUR });
  head.add(skull);
  // a short whiskery tan muzzle, a small black button nose, a little smile
  head.add(mesh(fluffy(0.085, { w: 20, h: 14, amp: 0.12, freq: 14, seed: 29, paint: () => coat(0, 0.4) }), WHITE, { y: -0.08, z: 0.2, sx: 1.25, sy: 0.8, extra: FUR }));
  head.add(mesh(new THREE.SphereGeometry(0.03, 12, 8), C.nose, { y: -0.055, z: 0.283, sx: 1.3, sy: 0.9, sz: 0.9, extra: { flatShading: false, roughness: 0.3 } }));
  head.add(mesh(new THREE.TorusGeometry(0.022, 0.005, 4, 10, Math.PI), C.mouth, { y: -0.098, z: 0.272, rz: Math.PI, sx: 1.2 }));
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
  // upright puppy ears: broad soft V's of tan fur with rounded, fringed
  // tips (pyramids read as a fox's, ovals as a bear's), turned a little
  // out, lighter inside and toward the tips
  const earShape = (v, n) => { const t = (n.y + 1) / 2; v.x *= 1 - 0.5 * t ** 1.6; };
  const ears = [];
  for (const side of [-1, 1]) {
    const ear = pivot('ear', side * 0.15, 0.17, -0.02);
    ear.rotation.set(-0.1, side * 0.3, -side * 0.38);
    ear.add(mesh(fluffy(0.07, { amp: 0.14, freq: 15, seed: 31 + side, shape: earShape, paint: (n) => coat(0, 0.5 * smooth(n.y, 0.3, 0.9)) }), WHITE, { y: 0.09, sx: 1.12, sy: 1.55, sz: 0.36, extra: FUR }));
    ear.add(mesh(new THREE.SphereGeometry(0.045, 12, 8), C.earInner, { y: 0.075, z: 0.017, sx: 0.9, sy: 1.4, sz: 0.28, extra: { flatShading: false, roughness: 0.8 } }));
    head.add(ear);
    ears.push(ear);
  }

  root.userData.rig = { body, hips, torso, neck, head, legs, arms, hand, hammer, tail, ears, eyes };
  addOutline(root, { thickness: 0.012, minSize: 0.05 });
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
