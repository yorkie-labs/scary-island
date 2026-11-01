import * as THREE from 'three';
import { addOutline } from './outline.js';

// Yorkie, the Yorkshire terrier hero (GDD §3.1): golden-orange and dark brown
// fur, big round brown eyes, a sky-blue hoodie, black cargo pants, black and
// white sneakers and a big wooden hammer. Built from low-poly primitives in
// the same flat-shaded style as the Polyfork catalogue, with pivots placed so
// it can be animated by hand (no skeleton needed).

export const YORKIE_COLORS = {
  fur: '#e3a24f', furDark: '#6e4224', muzzle: '#f4dcae', eye: '#3d220f', nose: '#1d1612',
  hoodie: '#8fd3f4', hoodieDark: '#6bb6db', string: '#ffffff', silk: '#f0b866', bow: '#ff4d6d',
  pants: '#26262b', pocket: '#34343b', shoe: '#18181b', sole: '#f2f2f2',
  wood: '#b07a46', woodDark: '#7a5230', band: '#8c8f96',
};

const mats = new Map();
function mat(hex, extra = {}) {
  const key = hex + JSON.stringify(extra);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: 0.85, ...extra }));
  return mats.get(key);
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
  head.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8), C.wood, { rz: Math.PI / 2 }));
  head.add(mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.035, 8), C.band, { rz: Math.PI / 2, x: 0.1 }));
  head.add(mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.035, 8), C.band, { rz: Math.PI / 2, x: -0.1 }));
  g.add(head);
  return g;
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
  // Tail peeking out under the hoodie.
  const tail = pivot('tail', 0, 0.02, -0.15);
  tail.add(mesh(new THREE.ConeGeometry(0.04, 0.14, 6), C.furDark, { y: 0.07, rx: -0.3 }));
  torso.add(tail);

  // Arms: hoodie sleeves with furry paws. The right paw holds the hammer.
  const arms = {};
  for (const side of [-1, 1]) {
    const arm = pivot(side < 0 ? 'armL' : 'armR', side * 0.18, 0.26, 0);
    arm.add(mesh(new THREE.CylinderGeometry(0.048, 0.05, 0.2, 6), C.hoodie, { y: -0.1 }));
    arm.add(mesh(new THREE.IcosahedronGeometry(0.05, 0), C.fur, { y: -0.22 }));
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
  const head = pivot('head', 0, 0.2, 0);
  neck.add(head);
  head.add(mesh(new THREE.IcosahedronGeometry(0.25, 1), C.fur, { sx: 1.05, sy: 0.95 }));
  head.add(mesh(new THREE.IcosahedronGeometry(0.235, 1), C.furDark, { z: -0.06, y: 0.04, sx: 1.04 }));
  // Yorkshire terrier "furnishings": long silky hair falling from the cheeks
  // to the shoulders, a drooping moustache and beard, and the top knot tied
  // with a red bow. Each lock hangs from a pivot so it can
  // swing (see the animator).
  const locks = [];
  const lock = (x, y, z, len, r, { rz = 0, rx = 0, color = C.silk } = {}) => {
    const p = pivot('lock', x, y, z);
    p.rotation.set(rx, 0, rz);
    p.add(mesh(new THREE.ConeGeometry(r, len, 5), color, { y: -len / 2, rx: Math.PI }));
    head.add(p);
    locks.push(p);
    return p;
  };
  for (const side of [-1, 1]) {
    lock(side * 0.2, 0.0, 0.07, 0.3, 0.075, { rz: side * 0.18 }); // the long cheek hair
    lock(side * 0.21, 0.07, -0.04, 0.32, 0.07, { rz: side * 0.22 });
    lock(side * 0.16, 0.05, -0.15, 0.28, 0.07, { rz: side * 0.16, color: C.fur });
    lock(side * 0.21, -0.06, 0.0, 0.26, 0.06, { rz: side * 0.1 }); // a fuller fall at the jaw
    lock(side * 0.07, -0.13, 0.24, 0.16, 0.045, { rz: side * 0.2, rx: 0.05 }); // the moustache, draping down
  }
  lock(0, -0.16, 0.21, 0.16, 0.06, { rx: 0.2 }); // the beard
  // the top knot, tied with a bow
  head.add(mesh(new THREE.ConeGeometry(0.075, 0.15, 6), C.silk, { y: 0.27, z: 0.02, rx: 0.15 }));
  const bow = pivot('bow', 0, 0.255, 0.04);
  for (const side of [-1, 1]) bow.add(mesh(new THREE.ConeGeometry(0.05, 0.1, 4), C.bow, { x: side * 0.055, rz: side * Math.PI / 2, sy: 1, sz: 0.5 }));
  bow.add(mesh(new THREE.IcosahedronGeometry(0.028, 0), C.bow));
  head.add(bow);
  head.add(mesh(new THREE.IcosahedronGeometry(0.13, 1), C.muzzle, { y: -0.08, z: 0.17, sx: 1.1, sy: 0.8 }));
  head.add(mesh(new THREE.IcosahedronGeometry(0.04, 0), C.nose, { y: -0.04, z: 0.29 }));
  // big round eyes with a highlight
  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = pivot('eye', side * 0.1, 0.03, 0.2);
    eye.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), C.eye, { sz: 0.6, extra: { roughness: 0.3 } }));
    eye.add(mesh(new THREE.SphereGeometry(0.018, 6, 4), '#ffffff', { x: side * -0.012, y: 0.022, z: 0.035, extra: { emissive: '#ffffff', emissiveIntensity: 0.4 } }));
    head.add(eye);
    eyes.push(eye);
  }
  // pointy Yorkie ears
  const ears = [];
  for (const side of [-1, 1]) {
    const ear = pivot('ear', side * 0.15, 0.17, -0.02);
    ear.rotation.z = -side * 0.35;
    ear.add(mesh(new THREE.ConeGeometry(0.075, 0.2, 4), C.furDark, { y: 0.09, sz: 0.5 }));
    ear.add(mesh(new THREE.ConeGeometry(0.045, 0.13, 4), '#f0b9a0', { y: 0.07, z: 0.012, sz: 0.3 }));
    head.add(ear);
    ears.push(ear);
  }

  root.userData.rig = { body, hips, torso, neck, head, legs, arms, hand, hammer, tail, ears, eyes, locks };
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
  const lerp = THREE.MathUtils.lerp;

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
    for (const [i, ear] of r.ears.entries()) ear.rotation.x = Math.sin(time * 3 + i) * 0.05 - run * 0.4;
    // the silky hair sways, and streams back when running
    for (const [i, l] of (r.locks ?? []).entries()) {
      l.userData.rx0 ??= l.rotation.x;
      l.rotation.x = l.userData.rx0 + Math.sin(time * (moving ? 9 : 2.2) + i * 0.7) * (moving ? 0.12 : 0.04) - run * 0.45;
    }

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
  };
}
