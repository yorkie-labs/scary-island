import * as THREE from 'three';
import { heightAt, GATES } from '../map.js';
import { place, instance } from '../models.js';
import * as items from '../items.js';
import { scatterIn } from '../scatter.js';
import { createTreat, createPotion, createSnack, createChest, createHideBush, createItemPickup, groundPos } from '../interactables.js';
import { createWatcher, isObserved } from '../../entities/watcher.js';
import { sfx } from '../../audio/sound.js';
import { snapOf, applySnap, glide } from '../../entities/puppet.js';

// STAGE 4 — STATUE VILLAGE (GDD §5). Show the energy crystal to the old
// door, learn how the statues move, freeze them with the flashlight (found in the forest),
// light, gather three keys, open the ancient gate, and put the Island
// Guardian to sleep by lighting three crystal devices. That breaks the seal.

export const VILLAGE_MODELS = ['chapel', 'house2', 'cottage', 'villageWell', 'watchtower', 'lowWall', 'lampPost', 'marketStall', 'ruin',
  'moai', 'fountain', 'runeStone', 'oakVillage', 'knightStatue', 'founderStatue', 'lionStatue', 'angelStatue', 'crate', 'barrel', 'chest'];

const ARENA = { x: 72, z: -24, r: 9 };

export function buildVillage(G, { clearStage }) {
  const S = G.state;

  // --- the old stone village, lit by moonlight and lamps
  const buildings = [
    ['chapel', 56, -16, 0.2], ['house2', 48, -4, Math.PI / 2], ['cottage', 52, 10, Math.PI * 0.8], ['house2', 80, 4, -Math.PI / 2],
    ['cottage', 76, 14, Math.PI * 1.2], ['watchtower', 86, -10, 0], ['ruin', 46, 18, 0.5], ['ruin', 84, 20, -0.4],
  ];
  for (const [k, x, z, ry] of buildings) place(G, k, x, z, { ry });
  place(G, 'fountain', 64, -2);
  place(G, 'villageWell', 58, 4);
  place(G, 'marketStall', 70, 8, { ry: Math.PI });
  place(G, 'marketStall', 66, 10, { ry: Math.PI });
  for (const [x, z] of [[40, 0], [44, -6], [44, 6], [60, -8], [68, -8], [60, 4], [72, 2], [64, 14], [70, -16]]) {
    place(G, 'lampPost', x, z);
    G.addLight({ pos: groundPos(x, z, 2.2), color: '#ffd59a', intensity: 4, distance: 9 });
  }
  scatterIn('village', 10, { seed: 31, spacing: 7, keepClear: [[64, -2, 18], [ARENA.x, ARENA.z, ARENA.r + 3]] }).forEach((p) => place(G, 'oakVillage', p.x, p.z, { ry: p.ry }));
  for (let i = 0; i < 6; i++) place(G, 'lowWall', 40 + i * 2.1, 14, { ry: 0 });
  place(G, 'crate', 49, 1); place(G, 'barrel', 50, -1);

  buildVillageDoor(G);

  // --- statues in the streets
  const watchers = [
    createWatcher(G, { x: 54, z: -6, ry: Math.PI / 2, model: 'founderStatue', region: 'village', id: 'v1', speed: 3.0 }),
    createWatcher(G, { x: 62, z: 12, ry: Math.PI, model: 'knightStatue', region: 'village', id: 'v2' }),
    createWatcher(G, { x: 76, z: -6, ry: -Math.PI / 2, model: 'angelStatue', region: 'village', id: 'v3' }),
    createWatcher(G, { x: 70, z: 18, ry: Math.PI, model: 'knightStatue', region: 'village', id: 'v4' }),
  ];
  G.on('watcherObserved', async (w) => {
    if (w.region !== 'village' || G.flag('villageWatcherSeen') || G.mode !== 'play' || !G.flag('villageEntered')) return;
    G.setFlag('villageWatcherSeen');
    await G.say([{ name: 'Yorkie', text: '여기 동상들도 내가 안 볼 때만 움직이는구나. 다 바라볼 수는 없으니… 손전등을 써 보자!' }]);
  });
  // when the ancient gate opens, the village statues fall asleep for good
  const sleepStatues = (quiet) => {
    for (const w of watchers) w.sleep();
    if (!quiet) G.toast('스르르… 마을 동상들이 모두 잠들었어요', 2600);
  };
  if (G.flag('ancientGateOpen')) sleepStatues(true);
  G.on('flag', (name) => { if (name === 'ancientGateOpen') sleepStatues(false); });
  G.on('frozenByLight', (e) => { if (e.region === 'village' || e.kind === 'guardian') G.setFlag('watcherFrozen'); });

  // --- three keys
  const keySpots = [[58, 5.6, 1.9], [70, 8, 2.1], [46, 18, 0]];
  keySpots.forEach(([x, z, lift], i) => {
    createItemPickup(G, {
      id: `village-key-${i}`, model: items.key(), x, z, y: heightAt(x, z) + lift, float: 0.5,
      onCollect: () => { S.keys++; sfx.item(); G.toast(`🗝️ 열쇠를 찾았어요! (${S.keys}/3)`); G.refresh(); },
    });
  });
  G.mark('key', groundPos(58, 4));
  G.onUpdate(() => {
    const next = G.pickups.find((p) => p.id?.startsWith('village-key'));
    if (next) G.mark('key', next.pos);
  });

  buildGuardianArena(G, { clearStage });

  // --- collectibles
  createTreat(G, 4, 'village-a', 88, -2);
  createTreat(G, 4, 'village-b', 44, -14);
  createTreat(G, 4, 'village-c', 80, 22);
  createPotion(G, 'village', 66, -6);
  createSnack(G, 60, 0);
  createChest(G, 4, 88, 12, { ry: -1.2 });
  for (const [x, z] of [[50, 4], [66, 16], [80, -2], [56, 14]]) createHideBush(G, x, z);
  G.addTrigger({ test: (p) => p.x > 37 && p.z < 30 && p.z > -34, enabled: () => G.flag('villageDoorOpen') && !G.flag('villageEntered'), onEnter: () => {
    G.setFlag('villageEntered');
    G.checkpoint(groundPos(40, 2), 'village');
  } });
  return { watchers };
}

// The door from the camp: a crystal-shaped hollow that wakes to the energy crystal.
function buildVillageDoor(G) {
  const g = GATES.villageDoor;
  const y = heightAt(g.x, g.z);
  const door = new THREE.Group();
  door.position.set(g.x, y, g.z);
  door.rotation.y = g.ry;
  door.add(items.part(new THREE.BoxGeometry(1.4, 6, 1.6), '#8f96a3', { x: -3.4, y: 3 }));
  door.add(items.part(new THREE.BoxGeometry(1.4, 6, 1.6), '#8f96a3', { x: 3.4, y: 3 }));
  door.add(items.part(new THREE.BoxGeometry(8.2, 1.2, 1.8), '#7f8695', { y: 6.2 }));
  const slab = new THREE.Group();
  slab.add(items.part(new THREE.BoxGeometry(5.4, 5.6, 0.6), '#a7adb8', { y: 2.8 }));
  const hollow = items.energyCrystal(0.3);
  hollow.position.set(0, 2.6, 0.35);
  hollow.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.emissiveIntensity = 0.05; o.material.color.set('#55505e'); } });
  slab.add(hollow);
  door.add(slab);
  G.scene.add(door);
  G.look.shadows(door);
  const dx = Math.sin(g.ry + Math.PI / 2), dz = Math.cos(g.ry + Math.PI / 2);
  G.physics.addCuboid(g.x - dx * 3.4, y + 3, g.z - dz * 3.4, 0.8, 3, 0.8, g.ry);
  G.physics.addCuboid(g.x + dx * 3.4, y + 3, g.z + dz * 3.4, 0.8, 3, 0.8, g.ry);
  let body = null;
  const open = (instant) => {
    if (body) { G.physics.remove(body); body = null; }
    hollow.traverse((o) => { if (o.material) { o.material.emissiveIntensity = 1; o.material.color.set('#ff7be5'); } });
    if (instant) { slab.position.y = -5.6; return; }
    sfx.grind(); G.cam.shake(0.3);
    let t = 0;
    G.onUpdate((dt) => { if (t < 1) { t = Math.min(1, t + dt / 2.4); slab.position.y = -5.6 * t; } });
  };
  if (G.flag('villageDoorOpen')) open(true);
  else body = G.physics.addCuboid(g.x, y + 2.8, g.z, 0.3, 2.8, 2.7, 0);
  G.on('shared', ({ key }) => { if (key === 'villageDoorOpen') open(false); }); // a friend's crystal
  const pos = new THREE.Vector3(g.x - 1.6, y, g.z);
  G.mark('villageDoor', pos);
  G.addInteractable({
    pos, radius: 3, enabled: () => !G.flag('villageDoorOpen'),
    label: () => (G.state.parts.crystal ? '에너지 크리스털을 비추기' : '크리스털 모양 홈이 있는 문'),
    action: async () => {
      if (!G.state.parts.crystal) { await G.say([{ name: 'Yorkie', text: '문에 크리스털 모양 홈이 있어… 반짝이는 크리스털이 있으면 열릴 것 같아.' }]); return; }
      sfx.power();
      G.setFlag('villageDoorOpen');
      open(false);
      await G.say([{ name: 'Yorkie', text: '크리스털에 반응해서 문이 열렸어! 크리스털은… 다행히 그대로 있네.' }]);
    },
  });
}

// The ancient gate and the Island Guardian.
function buildGuardianArena(G, { clearStage }) {
  const S = G.state;
  const a = ARENA;
  const ay = heightAt(a.x, a.z);
  // ring of stone walls (two courses high) with the gate to the south (+Z)
  for (let i = 0; i < 26; i++) {
    const ang = (i / 26) * Math.PI * 2;
    if (Math.cos(ang) > 0.93) continue; // the gate's gap
    const x = a.x + Math.sin(ang) * a.r, z = a.z + Math.cos(ang) * a.r;
    // the wall's long side (local x) follows the circle
    for (const lift of [0, 0.9]) place(G, 'lowWall', x, z, { ry: ang, y: ay + lift, body: 'none' });
    G.physics.addCuboid(x, ay + 1.2, z, 1.1, 1.2, 0.35, ang);
  }
  const gx = a.x, gz = a.z + a.r;
  const gate = new THREE.Group();
  gate.position.set(gx, ay, gz);
  gate.add(items.part(new THREE.BoxGeometry(0.9, 4.2, 0.9), '#6f7584', { x: -2, y: 2.1 }));
  gate.add(items.part(new THREE.BoxGeometry(0.9, 4.2, 0.9), '#6f7584', { x: 2, y: 2.1 }));
  gate.add(items.part(new THREE.BoxGeometry(5, 0.8, 1), '#646a78', { y: 4.4 }));
  const bars = new THREE.Group();
  for (let i = 0; i < 6; i++) bars.add(items.part(new THREE.BoxGeometry(0.12, 4, 0.12), '#3d4048', { x: -1.4 + i * 0.56, y: 2 }, { metalness: 0.6 }));
  const holes = [];
  for (let i = 0; i < 3; i++) {
    const k = items.key();
    k.position.set(-0.8 + i * 0.8, 2.2, 0.3);
    k.visible = false;
    bars.add(k);
    holes.push(k);
  }
  gate.add(bars);
  G.scene.add(gate);
  G.look.shadows(gate);
  let gateBody = null;
  const openGate = (instant) => {
    holes.forEach((h) => { h.visible = true; });
    if (gateBody) { G.physics.remove(gateBody); gateBody = null; }
    if (instant) { bars.position.y = 4; return; }
    sfx.grind();
    let t = 0;
    G.onUpdate((dt) => { if (t < 1) { t = Math.min(1, t + dt / 2); bars.position.y = 4 * t; } });
  };
  if (G.flag('ancientGateOpen')) openGate(true);
  else gateBody = G.physics.addCuboid(gx, ay + 2, gz, 1.8, 2, 0.3);
  G.on('shared', ({ key }) => { if (key === 'ancientGateOpen') openGate(false); }); // a friend's keys
  const gatePos = new THREE.Vector3(gx, ay, gz + 1.8);
  G.mark('ancientGate', gatePos);
  G.addInteractable({
    pos: gatePos, radius: 2.8, enabled: () => !G.flag('ancientGateOpen'),
    label: () => (S.keys >= 3 ? '열쇠 3개로 고대 문 열기' : `고대 문: 열쇠 구멍이 3개 (${S.keys}/3)`),
    action: async () => {
      if (S.keys < 3) { await G.say([{ name: 'Yorkie', text: '열쇠 구멍이 세 개야. 마을 어딘가에 열쇠가 숨어 있을 거야.' }]); return; }
      // spend the keys and open in the same moment (saved together), then animate
      S.keys = 0;
      G.checkpoint(gatePos, 'village');
      G.setFlag('ancientGateOpen');
      for (let i = 0; i < 3; i++) setTimeout(() => { holes[i].visible = true; sfx.clink(); }, i * 300);
      setTimeout(() => openGate(false), 1000);
    },
  });

  // the seal: a slowly turning rune circle floating over the arena
  const seal = new THREE.Mesh(new THREE.TorusGeometry(a.r * 0.9, 0.18, 6, 40), new THREE.MeshStandardMaterial({ color: '#b48cff', emissive: '#9b6bff', emissiveIntensity: 1, transparent: true, opacity: 0.8 }));
  seal.rotation.x = Math.PI / 2;
  seal.position.set(a.x, ay + 9, a.z);
  G.scene.add(seal);
  if (G.flag('sealReleased')) seal.visible = false;
  G.mark('seal', new THREE.Vector3(a.x, ay, a.z));

  // the Island Guardian (a giant moai)
  const guardian = createGuardian(G, { x: a.x, z: a.z - 3, y: ay });
  G.mark('guardian', guardian.home);
  G.addTrigger({
    pos: new THREE.Vector3(a.x, ay, a.z + 4), radius: 4, enabled: () => G.flag('ancientGateOpen') && !G.flag('guardianMet'),
    onEnter: async () => {
      G.setFlag('guardianMet');
      G.cam.shake(0.6); sfx.rumble();
      const gp = guardian.pos.clone();
      G.cam.fly(gp.clone().add(new THREE.Vector3(0, 4, 9)), gp.clone().setY(gp.y + 4), 1.2);
      await G.say([
        { name: '섬의 수호자', text: '……누가 봉인을 건드리느냐……' },
        { name: '도움말', text: G.hint('devices') },
      ]);
      G.cam.release();
      guardian.wake();
    },
  });

  // three crystal devices
  const devices = [0, 1, 2].map((i) => {
    const ang = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const x = a.x + Math.sin(ang) * (a.r - 2.6), z = a.z + Math.cos(ang) * (a.r - 2.6);
    const y = heightAt(x, z);
    place(G, 'runeStone', x, z, { y, s: 1.6, body: 'static' });
    const crystal = items.energyCrystal(0.25);
    crystal.position.set(x, y + 0.9, z);
    crystal.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.emissiveIntensity = 0.1; } });
    G.scene.add(crystal);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 12, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#ffb8f2', transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    beam.position.set(x, y + 7, z);
    beam.visible = false;
    G.scene.add(beam);
    const d = { i, on: false, charge: 0, x, z, y, crystal, beam };
    const turnOn = (instant) => {
      d.on = true; beam.visible = true;
      if (!(S.devicesLit ??= []).includes(i)) S.devicesLit.push(i);
      crystal.traverse((o) => { if (o.material) o.material.emissiveIntensity = 1.2; });
      if (!instant) { sfx.power(); G.toast(`크리스털 장치 켜짐! (${G.state.devices}/3)`); }
    };
    d.turnOn = turnOn;
    return d;
  });
  devices.forEach((d) => { if (G.flag('sealReleased') || (S.devicesLit ?? []).includes(d.i)) d.turnOn(true); });
  G.onUpdate(() => {
    const next = devices.find((d) => !d.on);
    if (next) G.mark('device', new THREE.Vector3(next.x, next.y, next.z));
  });
  let charging = null;
  devices.forEach((d) => {
    G.addInteractable({
      pos: new THREE.Vector3(d.x, d.y, d.z), radius: 2.2, enabled: () => G.flag('guardianMet') && !G.flag('sealReleased') && !d.on && !charging,
      label: '크리스털 장치 켜기 (잠깐 기다려요)',
      action: () => { charging = { d, t: 0, hearts: G.state.hearts }; },
    });
  });
  G.onUpdate((dt) => {
    if (!charging) return;
    const p = G.player.position;
    charging.t += dt;
    charging.d.crystal.rotation.y += dt * 8;
    if (G.state.hearts < charging.hearts || p.distanceTo(new THREE.Vector3(charging.d.x, charging.d.y, charging.d.z)) > 2.6) {
      G.toast('앗, 멈췄어요! 다시 켜 보세요', 1400);
      charging = null;
      return;
    }
    G.hud.prompt(`장치 켜는 중… ${Math.min(100, Math.round((charging.t / 1.5) * 100))}%`);
    if (charging.t >= 1.5) {
      charging.d.turnOn(false);
      G.state.devices = S.devicesLit.length; // mine and my friends'
      charging = null;
      G.refresh();
      if (G.state.devices >= 3) finish();
    }
  });

  // the ship key: spawned as soon as the seal breaks (before any dialogue), and
  // again on load if the seal is broken but the key was never picked up
  const spawnShipKey = () => {
    if (S.parts.shipKey || G.pickups.some((p) => p.id === 'ship-key')) return;
    G.mark('seal', new THREE.Vector3(a.x, ay, a.z + 1));
    createItemPickup(G, {
      id: 'ship-key', model: items.shipKey(), x: a.x, z: a.z + 1, y: ay, float: 0.7,
      onCollect: async () => {
        G.state.parts.shipKey = true; sfx.item(); G.refresh();
        await clearStage(4);
        await G.say([{ name: 'Yorkie', text: '배의 열쇠다! 이제 남쪽 항구로 가는 길도 열렸을 거야. 탈출하자!' }]);
      },
    });
  };
  if (G.flag('sealReleased')) spawnShipKey();
  // after a reload in the middle of the guardian fight, it is awake again
  if (G.flag('guardianMet') && !G.flag('sealReleased')) guardian.wake();

  // a friend's progress at the arena
  G.on('shared', ({ field, key }) => {
    if (field === 'devicesLit') devices[Number(key)]?.turnOn(false);
    if (key === 'guardianMet' && !G.flag('sealReleased')) guardian.wake();
    if (key === 'sealReleased') {
      finished = true;
      guardian.sleep();
      seal.visible = false;
      for (const d of devices) if (!d.on) d.turnOn(true);
      spawnShipKey();
    }
  });

  let finished = false;
  async function finish() {
    if (finished) return;
    finished = true;
    guardian.sleep();
    await new Promise((r) => setTimeout(r, 800));
    sfx.fanfare();
    let t = 0;
    G.onUpdate((dt) => { if (t < 1) { t = Math.min(1, t + dt / 2); seal.scale.setScalar(1 + t * 1.5); seal.material.opacity = 0.8 * (1 - t); if (t >= 1) seal.visible = false; } });
    G.setFlag('sealReleased');
    spawnShipKey();
    await G.say([
      { name: '섬의 수호자', text: '……빛이… 돌아왔구나. 작은 용사여… 이것을 가져가라……' },
      { name: 'Yorkie', text: '수호자가 잠들었어. 그리고… 봉인이 풀렸다!' },
    ]);
  }
}

// The Island Guardian: a giant moai that crawls toward Yorkie. Looking at it
// slows it; the flashlight stops it.
function createGuardian(G, { x, z, y }) {
  const obj = instance('moai');
  obj.position.set(x, y, z);
  G.scene.add(obj);
  G.look.shadows(obj);
  const home = new THREE.Vector3(x, y, z);
  const mover = G.physics.createMover({ x, y, z, radius: 1.0, height: 6, climb: 46 }); // the banks by the arena are 20-30°: it climbs what Yorkie climbs
  const eyes = new THREE.Group();
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: '#7dfcff' }));
    e.position.set(s * 0.38, 4.6, 0.75);
    eyes.add(e);
  }
  eyes.visible = false;
  obj.add(eyes);
  const e = {
    kind: 'guardian', model: obj, mover, home, state: 'idle', frozenFor: 0, t: 0, heading: 0,
    get pos() { return obj.position; },
    get active() { return e.state === 'awake'; },
    freeze(s) { e.frozenFor = Math.max(e.frozenFor, s); },
    wake() { if (e.state === 'idle') e.state = 'awake'; },
    sleep() { e.state = 'asleep'; eyes.visible = false; },
    reset() { if (e.state === 'asleep') return; mover.teleport(home); obj.position.copy(home); e.frozenFor = 0; if (G.flag('guardianMet')) e.state = 'awake'; },
  };
  if (G.flag('sealReleased')) e.state = 'asleep';
  const tmp = new THREE.Vector3();
  e.update = (dt) => {
    e.t += dt;
    e.frozenFor = Math.max(0, e.frozenFor - dt);
    if (e.state !== 'awake') { mover.move(0, 0, dt); return; }
    const P = G.nearestTarget(obj.position); // the nearest Yorkie, mine or a friend's
    const to = tmp.subVectors(P.position, obj.position).setY(0);
    const dist = to.length();
    e.seen = isObserved(G, obj.position, 5); // any Yorkie looking slows it
    const speed = e.frozenFor > 0 ? 0 : e.seen ? 0.7 : 2.4;
    if (speed > 0 && dist > 2) {
      to.normalize();
      mover.move(to.x * speed * dt, to.z * speed * dt, dt);
      e.heading = Math.atan2(to.x, to.z);
    } else mover.move(0, 0, dt);
    obj.position.copy(mover.feet);
    obj.rotation.y = THREE.MathUtils.lerp(obj.rotation.y, e.heading, 1 - Math.exp(-3 * dt));
    look(dt, speed > 0 && dist > 2 ? speed : 0);
    if (dist < 2.2) G.hurtTarget(P, obj.position);
  };
  function look(dt, speed) {
    eyes.visible = e.state === 'awake';
    if (!eyes.visible) return;
    eyes.children.forEach((c) => c.material.color.set(e.frozenFor > 0 ? '#ffe066' : e.seen ? '#7dfcff' : '#ff6b9a'));
    obj.rotation.z = speed > 1 ? Math.sin(e.t * 10) * 0.04 : 0;
    const steps = e.seen ? 0.8 : 1.6;
    if (speed > 0 && Math.floor(e.t * steps) !== Math.floor((e.t - dt) * steps)) { sfx.stomp(); G.cam.shake(0.15); }
  }
  // playing together: the host sends this, everyone else draws it
  const STATES = ['idle', 'awake', 'asleep'];
  e.snap = () => snapOf(obj, e.heading, STATES, e.state, e.seen ? 1 : 0, Math.round(e.frozenFor * 10) / 10);
  e.apply = (snap) => { applySnap(e, STATES, snap); e.seen = !!snap[5]; e.frozenFor = snap[6] ?? 0; };
  e.puppet = (dt) => {
    e.t += dt;
    e.frozenFor = Math.max(0, e.frozenFor - dt);
    const moved = glide(e, obj, dt, 3);
    look(dt, dt > 0 ? moved / dt : 0);
  };
  G.addHittable({ enemy: e, radius: 1.2, pos: () => obj.position.clone().setY(obj.position.y + 1), onHit() { sfx.ting(); G.toast('팅! 너무 커요. 크리스털 장치를 켜요!', 1500); } });
  G.addEnemy(e);
  return e;
}
