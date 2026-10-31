import * as THREE from 'three';
import { part } from '../world/items.js';
import { addOutline } from './outline.js';
import { sfx } from '../audio/sound.js';
import { heightAt, regionAt, inGateGap } from '../world/map.js';

// Rocky, the pebble monster (GDD §6): hides as an ordinary rock, wakes with
// a rumble, hops after Yorkie, gives up when Yorkie hides or runs far enough,
// and two bonks of the hammer leave it dizzy. Cute: big eyes, stubby feet.

export function createRockyModel(scale = 1) {
  const g = new THREE.Group();
  const bodyG = new THREE.Group();
  g.add(bodyG);
  const rock = part(new THREE.DodecahedronGeometry(0.55, 0), '#8e8a84', { y: 0.5, sy: 0.85 });
  bodyG.add(rock);
  bodyG.add(part(new THREE.DodecahedronGeometry(0.25, 0), '#7da35a', { x: -0.2, y: 0.92, z: -0.1, sy: 0.4 })); // moss tuft
  bodyG.add(part(new THREE.DodecahedronGeometry(0.18, 0), '#7a7670', { x: 0.35, y: 0.75, z: -0.2 }));
  // eyes: hidden under stone lids while asleep
  const eyes = new THREE.Group();
  eyes.name = 'eyes';
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(s * 0.18, 0.62, 0.4);
    eye.add(part(new THREE.SphereGeometry(0.13, 10, 8), '#fffbe8', {}, { emissive: '#fff3b0', emissiveIntensity: 0.5 }));
    const pupil = part(new THREE.SphereGeometry(0.065, 8, 6), '#2a1d12', { z: 0.09 });
    pupil.name = 'pupil';
    eye.add(pupil);
    eyes.add(eye);
  }
  bodyG.add(eyes);
  const lids = new THREE.Group();
  for (const s of [-1, 1]) lids.add(part(new THREE.SphereGeometry(0.145, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#8e8a84', { x: s * 0.18, y: 0.62, z: 0.4, rx: Math.PI / 2 - 0.05 }));
  lids.name = 'lids';
  bodyG.add(lids);
  const feet = new THREE.Group();
  for (const s of [-1, 1]) feet.add(part(new THREE.BoxGeometry(0.2, 0.12, 0.28), '#6f6b66', { x: s * 0.22, y: 0.06, z: 0.06 }));
  g.add(feet);
  // dizzy stars
  const stars = new THREE.Group();
  for (let i = 0; i < 3; i++) stars.add(part(new THREE.OctahedronGeometry(0.07, 0), '#ffe066', { x: Math.cos(i * 2.1) * 0.35, z: Math.sin(i * 2.1) * 0.35 }, { emissive: '#ffe066', emissiveIntensity: 0.8 }));
  stars.position.y = 1.2;
  stars.visible = false;
  g.add(stars);
  addOutline(bodyG, { thickness: 0.03 });
  addOutline(feet, { thickness: 0.02 });
  g.scale.setScalar(scale);
  g.userData.rig = { bodyG, eyes, lids, feet, stars };
  return g;
}

const SPEED = { chase: 2.9, search: 2.0, return: 1.6, lure: 2.4 };
const SEE = 12; // how far a waking Rocky can see Yorkie
const GIVE_UP = 17;

// hunter: always knows where Yorkie is and never gives up (the final chase);
// hiding in a bush still works. route(from, to): an in-between goal, for
// ground that is not a straight walk (the dock).
export function createRocky(G, { x, z, y, ry = 0, scale = 1, id = 'rocky', wakeRadius = 3.2, hunter = false, route = null }) {
  const model = createRockyModel(scale);
  const rig = model.userData.rig;
  const home = new THREE.Vector3(x, y ?? heightAt(x, z), z);
  model.position.copy(home);
  model.rotation.y = ry;
  G.scene.add(model);
  G.look.shadows(model);
  const mover = G.physics.createMover({ x, y: home.y, z, radius: 0.45 * scale, height: 1.0 * scale });
  const underground = x > 400; // the mine has its own walls
  const homeRegion = regionAt(x, z);

  const e = {
    id, kind: 'rocky', model, mover,
    state: 'sleep', t: 0, hp: 2, lost: 0, target: new THREE.Vector3(), heading: ry,
    get pos() { return model.position; },
    get active() { return e.state !== 'sleep'; },
  };

  function setState(s) { e.state = s; e.t = 0; }

  function wake() {
    if (e.state !== 'sleep') return;
    setState('waking');
    sfx.rumble();
    G.emit('rockyWake', e);
  }

  function lose() {
    if (G.flag('rockyWoke')) G.setFlag('rockyEscaped');
    setState('return');
  }

  G.on('noise', ({ pos, radius, kind }) => {
    const d = pos.distanceTo(model.position);
    if (d > radius) return;
    if (e.state === 'sleep' && kind === 'hammer' && d < 7) wake();
    else if (kind === 'bark' && (e.state === 'chase' || e.state === 'search' || e.state === 'return')) {
      // GDD §3.2 Bark: draws a monster's attention to where Yorkie barked
      e.target.copy(pos); setState('lure');
    }
  });

  G.addHittable({
    radius: 0.6 * scale,
    pos: () => model.position.clone().setY(model.position.y + 0.5),
    onHit() {
      if (e.state === 'sleep') { sfx.bonk(); wake(); return; }
      if (e.state === 'stunned') { sfx.bonk(); e.t = 0; return; }
      sfx.bonk();
      e.hp--;
      rig.bodyG.position.y = 0.15;
      if (e.hp <= 0) {
        setState('stunned');
        sfx.stun();
        G.setFlag('rockyEscaped');
        G.emit('rockyStunned', e);
      }
    },
  });

  e.wake = wake;
  e.reset = () => {
    mover.teleport(home);
    model.position.copy(home);
    e.hp = 2;
    setState('sleep');
  };

  const tmp = new THREE.Vector3();
  e.update = (dt) => {
    e.t += dt;
    const p = G.player.position;
    const toPlayer = tmp.subVectors(p, model.position).setY(0);
    const dist = toPlayer.length();
    const sees = (hunter || dist < SEE) && (!G.player.state.hidden || dist < 1.4);
    let speed = 0, goal = null;

    switch (e.state) {
      case 'sleep':
        if (dist < wakeRadius * scale && G.player.state.speed > 3) wake();
        break;
      case 'waking':
        if (e.t > 1.0) { setState('chase'); G.setFlag('rockyWoke'); }
        break;
      case 'chase':
        // rock monsters keep to their own area; the camp is safe
        if (!underground && regionAt(p.x, p.z) !== homeRegion) { lose(); break; }
        if (!sees) { e.lost += dt; goal = e.target; speed = SPEED.search; if (e.lost > 2.5) lose(); } else { e.lost = 0; e.target.copy(p); goal = route ? route(model.position, p) : p; speed = hunter ? SPEED.chase * 0.85 : SPEED.chase; } // hunters a little slower than a walking Yorkie
        if (dist > GIVE_UP && !hunter) lose();
        break;
      case 'lure':
        goal = e.target; speed = SPEED.lure;
        if (model.position.distanceTo(e.target) < 1.2 || e.t > 4) setState(sees ? 'chase' : 'return');
        break;
      case 'return':
        goal = home; speed = SPEED.return;
        if (sees && dist < 6 && e.t > 1.5) setState('chase');
        if (Math.hypot(model.position.x - home.x, model.position.z - home.z) < 0.6) { e.hp = 2; setState('sleep'); }
        break;
      case 'stunned':
        if (e.t > 6) { e.hp = 2; setState('return'); }
        break;
    }

    let dx = 0, dz = 0;
    if (goal) {
      const dir = tmp.subVectors(goal, model.position).setY(0);
      const len = dir.length();
      if (len > 0.3) {
        dir.multiplyScalar(1 / len);
        dx = dir.x * speed * dt; dz = dir.z * speed * dt;
        e.heading = Math.atan2(dir.x, dir.z);
      }
    }
    if (!underground && (dx || dz) && (regionAt(model.position.x + dx, model.position.z + dz) !== homeRegion || inGateGap(model.position.x + dx, model.position.z + dz))) { dx = 0; dz = 0; }
    mover.move(dx, dz, dt);
    const f = mover.feet;
    model.position.copy(f);
    model.rotation.y = THREE.MathUtils.lerp(model.rotation.y, e.heading, 1 - Math.exp(-8 * dt));

    // contact damage while awake and not dizzy
    if ((e.state === 'chase' || e.state === 'lure') && dist < 0.85 * scale + 0.25) G.hurtPlayer(model.position);

    // looks
    const awake = e.state !== 'sleep';
    rig.lids.visible = !awake || e.state === 'waking' && e.t < 0.5;
    rig.eyes.visible = awake;
    rig.feet.visible = awake;
    rig.stars.visible = e.state === 'stunned';
    rig.stars.rotation.y += dt * 5;
    rig.bodyG.position.y = THREE.MathUtils.lerp(rig.bodyG.position.y, 0, 1 - Math.exp(-10 * dt));
    if (e.state === 'waking') {
      rig.bodyG.position.x = Math.sin(e.t * 60) * 0.04;
      rig.bodyG.position.y = Math.min(0.12, e.t * 0.3);
    } else if (speed > 0 && (dx || dz)) {
      rig.bodyG.position.y = Math.abs(Math.sin(e.t * 9)) * 0.18;
      rig.bodyG.position.x = 0;
    } else rig.bodyG.position.x = 0;
    rig.bodyG.rotation.z = e.state === 'stunned' ? Math.sin(e.t * 6) * 0.15 : 0;
  };

  G.addEnemy(e);
  return e;
}
