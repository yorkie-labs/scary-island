import * as THREE from 'three';
import { part } from '../world/items.js';
import { addOutline } from './outline.js';
import { sfx } from '../audio/sound.js';

// Crystal Golem, the mine boss (GDD §5 Stage 3): hitting it from the front
// does nothing; dodge its slam and thrown rocks; after a slam it is dizzy for
// a moment, and three bonks on the crystal on its back put it to sleep as a
// little pebble.

export function createGolemModel() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const rock = '#7c7389', rockDark = '#5f576d';
  body.add(part(new THREE.DodecahedronGeometry(1.25, 0), rock, { y: 2.0, sy: 1.1 }));
  body.add(part(new THREE.DodecahedronGeometry(0.75, 0), rockDark, { y: 3.35 })); // head
  // eyes: friendly-grumpy
  for (const s of [-1, 1]) {
    body.add(part(new THREE.SphereGeometry(0.17, 8, 6), '#9ff6ff', { x: s * 0.28, y: 3.45, z: 0.58 }, { emissive: '#6ff0ff', emissiveIntensity: 1 }));
    body.add(part(new THREE.BoxGeometry(0.35, 0.08, 0.1), '#3d3548', { x: s * 0.28, y: 3.68, z: 0.62, rz: s * 0.25 }));
  }
  // front crystals (decoration) and the big weak-point crystal on the back
  for (let i = 0; i < 4; i++) body.add(part(new THREE.OctahedronGeometry(0.22, 0), '#9fe8ff', { x: -0.6 + i * 0.4, y: 2.6 + (i % 2) * 0.2, z: 0.95, sy: 1.6 }, { emissive: '#66ccff', emissiveIntensity: 0.5 }));
  const weak = new THREE.Group();
  weak.position.set(0, 2.4, -1.1);
  for (let i = 0; i < 5; i++) weak.add(part(new THREE.OctahedronGeometry(0.35 - i * 0.03, 0), '#ff7be5', { x: Math.cos(i * 1.3) * 0.3, y: Math.sin(i * 1.3) * 0.3, z: -0.1, rx: -0.6, sy: 1.8 }, { emissive: '#ff4fd8', emissiveIntensity: 0.7 }));
  body.add(weak);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 1.45, 2.6, 0);
    arm.add(part(new THREE.DodecahedronGeometry(0.55, 0), rockDark, { y: -0.7 }));
    arm.add(part(new THREE.DodecahedronGeometry(0.6, 0), rock, { y: -1.5 }));
    body.add(arm);
    arms.push(arm);
  }
  for (const s of [-1, 1]) g.add(part(new THREE.BoxGeometry(0.7, 0.9, 0.9), rockDark, { x: s * 0.6, y: 0.45 }));
  const stars = new THREE.Group();
  for (let i = 0; i < 4; i++) stars.add(part(new THREE.OctahedronGeometry(0.15, 0), '#ffe066', { x: Math.cos(i * 1.6) * 0.8, z: Math.sin(i * 1.6) * 0.8 }, { emissive: '#ffe066', emissiveIntensity: 1 }));
  stars.position.y = 4.3;
  stars.visible = false;
  g.add(stars);
  addOutline(body, { thickness: 0.05 });
  g.userData.rig = { body, arms, weak, stars };
  return g;
}

const HP = 3;

export function createGolem(G, { x, y, z, arenaRadius = 13, onAsleep }) {
  const model = createGolemModel();
  const home = new THREE.Vector3(x, y, z);
  model.position.copy(home);
  G.scene.add(model);
  G.look.shadows(model);
  const mover = G.physics.createMover({ x, y, z, radius: 1.3, height: 3.6, climb: 20 });
  const rig = model.userData.rig;

  // telegraph ring on the floor for the slam
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.0, 3.5, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff5d5d', transparent: true, opacity: 0.6 }));
  ring.visible = false;
  G.scene.add(ring);
  const rocks = [];

  const e = {
    kind: 'golem', model, mover, state: 'idle', t: 0, hp: HP, heading: Math.PI, throwT: 4,
    get pos() { return model.position; },
    get active() { return e.state !== 'idle' && e.state !== 'sleep'; },
  };
  const set = (s) => { e.state = s; e.t = 0; };
  e.start = () => { e.started = true; if (e.state === 'idle') set('chase'); };
  // after a faint the fight starts over at once (the arena trigger has fired)
  e.reset = () => {
    if (e.state === 'sleep') return;
    mover.teleport(home); model.position.copy(home); e.hp = HP; set(e.started ? 'chase' : 'idle');
    for (const r of rocks) { G.scene.remove(r.mesh); G.scene.remove(r.shadow); } rocks.length = 0;
    ring.visible = false;
  };

  function throwRock() {
    const target = G.player.position.clone();
    const mesh = part(new THREE.DodecahedronGeometry(0.45, 0), '#6f6680');
    mesh.position.copy(model.position).setY(model.position.y + 3.5);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.3, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35 }));
    shadow.position.copy(target).setY(target.y + 0.05);
    G.scene.add(mesh, shadow);
    rocks.push({ mesh, shadow, from: mesh.position.clone(), to: target, t: 0, dur: 1.3 });
    sfx.whoosh();
  }

  G.addHittable({
    radius: 1.5, pos: () => model.position.clone().setY(model.position.y + 1.5), enabled: () => e.state !== 'sleep' && e.state !== 'idle',
    onHit(point) {
      const facing = new THREE.Vector3(Math.sin(e.heading), 0, Math.cos(e.heading));
      const toPlayer = G.player.position.clone().sub(model.position).setY(0).normalize();
      const behind = facing.dot(toPlayer) < -0.2;
      if (e.state === 'stunned' && behind) {
        e.hp--;
        sfx.clink(); sfx.bonk();
        G.cam.shake(0.3);
        rig.weak.scale.setScalar(1.3);
        G.toast(e.hp > 0 ? `쨍! 크리스털에 명중! (${HP - e.hp}/${HP})` : '골렘이 스르르 잠들어요…', 1500);
        if (e.hp <= 0) {
          set('sleep');
          for (const r of rocks) G.scene.remove(r.mesh, r.shadow);
          rocks.length = 0; ring.visible = false;
          onAsleep?.();
        }
        else set('recover');
      } else {
        sfx.ting();
        G.toast(e.state === 'stunned' ? '뒤로 돌아가서 등의 크리스털을 쳐요!' : '팅! 앞쪽은 너무 단단해요. 쿵 내려찍은 뒤를 노려요!', 1700);
      }
    },
  });

  const tmp = new THREE.Vector3();
  e.update = (dt) => {
    e.t += dt;
    const p = G.player.position;
    const to = tmp.subVectors(p, model.position).setY(0);
    const dist = to.length();
    let speed = 0;
    rig.stars.visible = e.state === 'stunned';
    rig.stars.rotation.y += dt * 4;
    rig.weak.scale.lerp(new THREE.Vector3(1, 1, 1), 1 - Math.exp(-6 * dt));
    rig.weak.children.forEach((c) => { c.material.emissiveIntensity = e.state === 'stunned' ? 1.4 + Math.sin(e.t * 12) * 0.5 : 0.7; });
    rig.arms.forEach((a) => { a.rotation.x = 0; });

    switch (e.state) {
      case 'chase':
        speed = 2.3;
        e.heading = Math.atan2(to.x, to.z);
        e.throwT -= dt;
        if (dist < 4.2) set('windup');
        else if (e.throwT <= 0 && dist > 6) { set('throw'); e.throwT = 5; }
        break;
      case 'windup':
        rig.arms.forEach((a) => { a.rotation.x = -2.6 * Math.min(1, e.t / 0.9); });
        ring.visible = true;
        ring.position.copy(model.position).setY(model.position.y + 0.05);
        ring.material.opacity = 0.3 + Math.sin(e.t * 20) * 0.3;
        if (e.t > 1.1) {
          set('slam');
          sfx.stomp(); G.cam.shake(0.7);
          ring.visible = false;
          const pl = G.player;
          if (dist < 3.6 && pl.state.grounded && pl.state.action?.name !== 'roll') G.hurtPlayer(model.position);
        }
        break;
      case 'slam':
        rig.arms.forEach((a) => { a.rotation.x = 0.3; });
        if (e.t > 0.3) { set('stunned'); sfx.stun(); }
        break;
      case 'stunned':
        rig.body.rotation.z = Math.sin(e.t * 5) * 0.08;
        if (e.t > 3.6) { rig.body.rotation.z = 0; set('chase'); }
        break;
      case 'recover':
        if (e.t > 1.2) set('chase');
        break;
      case 'throw':
        e.heading = Math.atan2(to.x, to.z);
        rig.arms[1].rotation.x = -2.8 * Math.min(1, e.t / 0.7);
        if (e.t > 0.8) { throwRock(); set('chase'); }
        break;
      case 'sleep': {
        const k = Math.min(1, e.t / 1.5);
        model.scale.setScalar(1 - k * 0.8);
        mover.setEnabled(false);
        break;
      }
    }
    if (speed > 0 && dist > 2.5) {
      const d = to.normalize();
      mover.move(d.x * speed * dt, d.z * speed * dt, dt);
      rig.body.position.y = Math.abs(Math.sin(e.t * 5)) * 0.12;
      if (Math.floor(e.t * 2.5) !== Math.floor((e.t - dt) * 2.5)) sfx.stomp();
    } else if (e.state !== 'sleep') mover.move(0, 0, dt);
    if (e.state !== 'sleep') model.position.copy(mover.feet);
    model.rotation.y = THREE.MathUtils.lerp(model.rotation.y, e.heading, 1 - Math.exp(-5 * dt));
    // keep it in its arena
    if (model.position.distanceTo(home) > arenaRadius) { mover.teleport(home.clone().lerp(model.position, 0.9)); }
    if (e.state === 'chase' && dist < 1.8) G.hurtPlayer(model.position);

    for (const r of rocks) {
      r.t += dt;
      const k = Math.min(1, r.t / r.dur);
      r.mesh.position.lerpVectors(r.from, r.to, k);
      r.mesh.position.y += Math.sin(k * Math.PI) * 4;
      r.mesh.rotation.x += dt * 6;
      r.shadow.material.opacity = 0.2 + k * 0.4;
      if (k >= 1) {
        sfx.stomp();
        if (p.distanceTo(r.to) < 1.5 && G.player.state.action?.name !== 'roll') G.hurtPlayer(r.to);
        G.scene.remove(r.mesh, r.shadow);
        r.done = true;
      }
    }
    for (let i = rocks.length - 1; i >= 0; i--) if (rocks[i].done) rocks.splice(i, 1);
  };
  G.addEnemy(e);
  return e;
}
