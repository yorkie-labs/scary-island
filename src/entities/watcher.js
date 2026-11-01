import * as THREE from 'three';
import { instance } from '../world/models.js';
import { heightAt, regionAt, inGateGap } from '../world/map.js';
import { sfx } from '../audio/sound.js';
import { snapOf, applySnap, glide } from './puppet.js';

const STATES = ['idle', 'hunt', 'asleep'];
const r1 = (n) => Math.round(n * 10) / 10;

// Watcher, the statue that moves only when nobody is looking (GDD §6):
// "바라보면 멈추고 뒤돌아보면 이동". Keep it on screen to hold it still; the
// flashlight (Stage 4) freezes it for a while even after you look away.

// Line of sight looks through invisible colliders (the ridge walls).
const visible = (G) => (c) => !G.invisibleColliders?.has(c.handle);

// Is the statue being looked at? By any Yorkie: playing together, a friend
// keeping an eye on it holds it still for everyone.
export const isObserved = (G, pos, height = 2) => G.targets().some((t) => isFaced(G, pos, height, t));

// Top-down view: the statue is "looked at" when it is in front of a Yorkie
// (within ~55° of where it faces) and nothing solid is in between.
export function isFaced(G, pos, height = 2, viewer = G.player) {
  const pp = viewer.position;
  const to = new THREE.Vector3(pos.x - pp.x, 0, pos.z - pp.z);
  const dist = to.length();
  if (dist > 24) return false;
  if (dist > 0.5 && to.normalize().dot(viewer.facing) < Math.cos(0.96)) return false;
  const eye = pp.clone().setY(pp.y + 0.7);
  const mid = pos.clone().setY(pos.y + height * 0.5);
  const dir = mid.clone().sub(eye);
  const len = dir.length();
  const { RAPIER, world } = G.physics;
  const hit = world.castRay(new RAPIER.Ray(eye, dir.normalize()), Math.max(0, len - 1.0), true, undefined, undefined, undefined, viewer.body ?? G.player.body, visible(G));
  return !hit;
}

export function createWatcher(G, { x, z, ry = 0, model = 'knightStatue', speed = 3.3, wake = 16, region = 'forest', id }) {
  const obj = instance(model);
  const home = new THREE.Vector3(x, heightAt(x, z), z);
  obj.position.copy(home);
  obj.rotation.y = ry;
  G.scene.add(obj);
  G.look.shadows(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const height = box.max.y - box.min.y;
  const mover = G.physics.createMover({ x, y: home.y, z, radius: 0.45, height: Math.max(1.2, height), climb: 35 });

  // glowing eyes that only show while it is moving, so kids can read it
  const eyes = new THREE.Group();
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: '#7dfcff' }));
    e.position.set(s * 0.1, height * 0.86, 0.22);
    eyes.add(e);
  }
  eyes.visible = false;
  obj.add(eyes);

  const e = {
    id, kind: 'watcher', model: obj, mover, region,
    state: 'idle', frozenFor: 0, observed: false, t: 0, heading: ry, stepT: 0,
    homeRegion: regionAt(x, z),
    get pos() { return obj.position; },
    get active() { return e.state === 'hunt'; },
    chasing: true,
  };

  e.freeze = (seconds) => {
    e.frozenFor = Math.max(e.frozenFor, seconds);
  };

  e.reset = () => { mover.teleport(home); obj.position.copy(home); obj.rotation.y = ry; e.frozenFor = 0; if (e.state !== 'asleep') e.state = 'idle'; };
  // put to sleep for good, right where it stands (the village statues when the
  // ancient gate opens): eyes shut, never moves again
  e.sleep = () => { e.state = 'asleep'; e.frozenFor = 0; eyes.visible = false; obj.rotation.z = 0; };

  const tmp = new THREE.Vector3();
  e.update = (dt) => {
    e.t += dt;
    if (e.state === 'asleep') { mover.move(0, 0, dt); return; }
    e.frozenFor = Math.max(0, e.frozenFor - dt);
    const P = G.nearestTarget(obj.position);
    const p = P.position;
    const dist = tmp.subVectors(p, obj.position).setY(0).length();
    e.observed = isObserved(G, obj.position, height);

    // statues stay in their own area: the camp is safe, and leaving the area
    // makes them lose interest (they slip home while nobody looks)
    const sameArea = regionAt(p.x, p.z) === e.homeRegion;
    if (!sameArea && e.state === 'hunt' && !e.observed) { e.reset(); }
    if (e.state === 'idle' && dist < wake && sameArea) e.state = 'hunt';
    if (e.state === 'hunt' && dist > wake * 2) {
      // too far: slip back home while nobody looks
      if (!e.observed) e.reset();
    }
    noticed(dist);

    let moving = false;
    if (e.state === 'hunt' && !e.observed && e.frozenFor <= 0 && P.state.hidden === false) {
      const dir = tmp.normalize();
      const nx = obj.position.x + dir.x * speed * dt, nz = obj.position.z + dir.z * speed * dt;
      if (regionAt(nx, nz) === e.homeRegion && !inGateGap(nx, nz)) mover.move(dir.x * speed * dt, dir.z * speed * dt, dt);
      else mover.move(0, 0, dt); // the edge of its area: it will not step out
      e.heading = Math.atan2(dir.x, dir.z);
      moving = true;
      e.stepT -= dt;
      if (e.stepT <= 0 && dist < 14) { sfx.grind(); e.stepT = 2.2; }
    } else {
      mover.move(0, 0, dt);
    }
    obj.position.copy(mover.feet);
    obj.rotation.y = e.heading;
    e.moving = moving;
    look();

    if (e.state === 'hunt' && dist < 1.1) {
      G.hurtTarget(P, obj.position);
      // after a bump it shuffles back home, so it never pins a child down
      e.reset();
      e.state = 'hunt';
    }
  };

  // the first time *I* catch one moving: Yorkie's line about it (forest.js)
  function noticed(dist) {
    if (e.state === 'hunt' && dist < wake && isFaced(G, obj.position, height)) G.emit('watcherObserved', e);
  }
  function look() {
    obj.rotation.z = e.moving ? Math.sin(e.t * 18) * 0.05 : 0;
    eyes.visible = e.moving || e.frozenFor > 0;
    eyes.children.forEach((c) => c.material.color.set(e.frozenFor > 0 ? '#ffe066' : '#7dfcff'));
  }

  // playing together: the host sends this, everyone else draws it
  e.snap = () => snapOf(obj, e.heading, STATES, e.state, e.moving ? 1 : 0, r1(e.frozenFor));
  e.apply = (snap) => { applySnap(e, STATES, snap); e.moving = !!snap[5]; e.frozenFor = snap[6] ?? 0; };
  e.puppet = (dt) => {
    e.t += dt;
    e.frozenFor = Math.max(0, e.frozenFor - dt);
    glide(e, obj, dt, 20);
    noticed(obj.position.distanceTo(G.player.position));
    look();
  };

  G.addHittable({
    enemy: e,
    radius: 0.6, pos: () => obj.position.clone().setY(obj.position.y + 1),
    onHit() { sfx.ting(); G.toast('팅! 돌이라 망치가 안 통해요. 계속 바라보세요!', 1600); },
  });

  G.addEnemy(e);
  return e;
}
