import * as THREE from 'three';
import { heightAt } from '../map.js';
import { place, instance } from '../models.js';
import * as items from '../items.js';
import { buildCave, CELL } from '../cave.js';
import { createOre, createTreat, createPotion, createItemPickup, dropDiamond } from '../interactables.js';
import { createRocky } from '../../entities/rocky.js';
import { createGolem } from '../../entities/golem.js';
import { sfx } from '../../audio/sound.js';

// STAGE 3 — DIAMOND MINE (GDD §5). Ride the elevator down, mine ore and
// collect diamonds, outrun a collapsing tunnel, escape the rock monsters in
// a mine cart, put the Crystal Golem to sleep and take the energy crystal.

export const MINE_MODELS = ['headframe', 'mineRail', 'mineCart', 'crystalCluster', 'geode', 'minerShack', 'oreChute', 'timberCrate', 'hoodedLantern', 'chest', 'barrel'];

export const CAVE_ORIGIN = new THREE.Vector3(600, 0, 0);
const C = (cx, cz) => new THREE.Vector3(CAVE_ORIGIN.x + cx * CELL + CELL / 2, CAVE_ORIGIN.y, CAVE_ORIGIN.z + cz * CELL + CELL / 2);

// rooms and tunnels, in 2 m cells
const RECTS = [
  [-4, -4, 3, 3], // A landing
  [-1, -24, 0, -5], // B collapse tunnel
  [-5, -32, 4, -25], // C cart station
  [5, -30, 7, -28], // C alcove (treasure)
  [-1, -70, 0, -33], // D rail tunnel
  [-8, -86, 7, -71], // E golem arena
];

const LANDING = C(0, 2);
const SURFACE = new THREE.Vector3(0, 0, -44);
const RAIL_START = -64, RAIL_END = -140; // world z along x = 600
const BEAMS = [-84, -104, -124];
// The cart ride is tuned for children: a gentle speed and a long, high hop, so
// a jump pressed anywhere in the last ~5 m before a beam clears it.
const CART_SPEED = 6.5, CART_JUMP = 7.5, CART_GRAVITY = 14, WARN_AHEAD = 8;

export function buildMine(G, { clearStage }) {
  const S = G.state;
  G.underground = () => G.player.position.x > 400;
  G.cave = { origin: CAVE_ORIGIN, rects: RECTS, cell: CELL };
  const baseSea = G.seaLevelAt;
  G.seaLevelAt = (x, z) => (x > 400 ? -100 : baseSea(x, z));

  // --- surface yard: headframe over the shaft
  const sy = heightAt(SURFACE.x, SURFACE.z);
  place(G, 'headframe', SURFACE.x, SURFACE.z - 3, { body: 'box' });
  place(G, 'minerShack', 9, -40, { ry: -1.2 });
  place(G, 'oreChute', -8, -40, { ry: 1.2 });
  place(G, 'mineCart', -4, -38, { ry: 0.3, body: 'box' });
  for (let i = 0; i < 3; i++) place(G, 'mineRail', -4, -36 + i * 2, { ry: Math.PI / 2 + 0.3 });
  G.mark('elevator', new THREE.Vector3(SURFACE.x, sy, SURFACE.z));
  const goDown = async () => {
    sfx.grind();
    // past the cart but without the crystal (left by the landing elevator):
    // go straight back down into the arena
    if (G.flag('cartDone') && !S.parts.crystal) {
      const arenaIn = C(0, -71);
      await travel(G, arenaIn, Math.PI);
      G.checkpoint(arenaIn, 'mine');
      return;
    }
    await travel(G, LANDING, Math.PI);
    if (!G.flag('inMine')) {
      G.setFlag('inMine');
      G.checkpoint(LANDING, 'mine');
      await G.say([{ name: '요키', text: '우와… 벽마다 보석이 반짝반짝해! 광석을 캐서 다이아몬드를 모아 보자.' }]);
    } else G.checkpoint(LANDING, 'mine');
  };
  G.addInteractable({ pos: new THREE.Vector3(SURFACE.x, sy, SURFACE.z), radius: 2.8, label: '엘리베이터 타고 지하로 ⬇', enabled: () => G.flag('mineDoorOpen'), action: goDown });

  // --- the cave
  const cave = buildCave(G, { origin: CAVE_ORIGIN, rects: RECTS, height: 5 });
  // elevator cage at the landing
  const cage = new THREE.Group();
  cage.position.copy(LANDING).setZ(LANDING.z + 2.2);
  for (const sx of [-1.2, 1.2]) cage.add(items.part(new THREE.BoxGeometry(0.15, 5, 0.15), '#6b5a46', { x: sx, y: 2.5 }));
  cage.add(items.part(new THREE.BoxGeometry(2.6, 0.15, 0.15), '#6b5a46', { y: 4.9 }));
  cage.add(items.part(new THREE.BoxGeometry(2.4, 0.1, 2), '#8a7a62', { y: 0.05, z: -0.9 }));
  G.scene.add(cage);
  const upPos = LANDING.clone().setZ(LANDING.z + 1.4);
  G.addInteractable({ pos: upPos, radius: 2, label: '엘리베이터 타고 밖으로 ⬆', action: () => travel(G, new THREE.Vector3(SURFACE.x, sy, SURFACE.z + 3), Math.PI) });

  // crystals and lanterns light the cave (GDD palette: crystal blue, pink)
  const glow = [
    [C(-4, -4), '#7fe3ff'], [C(3, -4), '#ff8be8'], [C(-4, 3), '#ff8be8'], [C(3, 3), '#7fe3ff'],
    [C(-1, -12), '#7fe3ff'], [C(0, -20), '#ff8be8'], [C(-5, -32), '#7fe3ff'], [C(4, -25), '#ff8be8'],
    [C(-1, -45), '#7fe3ff'], [C(0, -60), '#ff8be8'], [C(-8, -86), '#ff8be8'], [C(7, -71), '#7fe3ff'], [C(-8, -71), '#7fe3ff'], [C(7, -86), '#ff8be8'],
  ];
  glow.forEach(([p, col], i) => {
    // find the nearest wall of this cell and grow the crystals out of it,
    // waist-high and tilted into the tunnel
    const cx = Math.floor((p.x - CAVE_ORIGIN.x) / CELL), cz = Math.floor((p.z - CAVE_ORIGIN.z) / CELL);
    const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => !cave.has(cx + dx, cz + dz)) ?? [1, 0];
    const wx = p.x + side[0] * (CELL / 2 - 0.15), wz = p.z + side[1] * (CELL / 2 - 0.15);
    const out = Math.atan2(-side[0], -side[1]); // facing back into the tunnel
    for (let k = 0; k < 2; k++) {
      const obj = place(G, k ? 'geode' : 'crystalCluster', wx + side[1] * (k - 0.5) * 0.9, wz - side[0] * (k - 0.5) * 0.9, { y: 0.55 + k * 0.45, ry: out + i, s: 1.2 - k * 0.3, body: 'none' });
      obj.rotation.x = (side[1] ? -side[1] : 0) * 0.9;
      obj.rotation.z = (side[0] ? side[0] : 0) * 0.9;
    }
    G.addLight({ pos: new THREE.Vector3(wx - side[0] * 1.2, 1.4, wz - side[1] * 1.2), color: col, intensity: 7, distance: 13 });
  });
  for (let z = -8; z > -140; z -= 14) G.addLight({ pos: new THREE.Vector3(600, 3.6, z), color: '#ffc27a', intensity: 4, distance: 12, flicker: 0.08 });

  // --- A: ores at the landing
  const ores = [C(-3, -3), C(2, -3), C(-3, 0), C(2, 0)];
  ores.forEach((p, i) => createOre(G, p.x, p.z, { y: 0, color: i % 2 ? '#ff8be8' : '#7fe3ff', mine: true, stage: 3, regrow: 45, onMined: () => G.setFlag('mineOreMined') }));
  G.mark('mineOre', ores[0]);
  for (const p of [C(-1, -8), C(0, -16), C(-1, -22)]) {
    G.addPickup({ id: `mine-gem-${p.z}`, model: items.diamond(), pos: p.clone(), float: 0.45, onCollect: () => { S.diamonds++; S.diamondsTotal++; S.mineDiamonds++; sfx.diamond(); } });
  }

  buildCollapse(G);
  buildCartChase(G);

  // --- E: the golem arena
  const arena = C(0, -78);
  G.mark('golem', arena);
  const golem = createGolem(G, { x: arena.x, y: 0, z: arena.z, onAsleep: async () => {
    G.setFlag('golemAsleep');
    await new Promise((r) => setTimeout(r, 1200));
    spawnCrystal(); // first, so the line points at something (talk doesn't stop the game)
    G.say([{ name: '요키', text: '골렘이 작은 돌멩이가 되어서 쿨쿨 자고 있어… 저기 빛나는 건 뭐지?' }]);
  } });
  if (G.flag('golemAsleep')) { golem.state = 'sleep'; golem.t = 99; golem.model.scale.setScalar(0.2); golem.mover.setEnabled(false); }
  G.addTrigger({
    pos: arena.clone().setZ(arena.z + 10), radius: 8, enabled: () => G.flag('cartDone') && !G.flag('golemAsleep'),
    onEnter: async () => {
      G.checkpoint(arena.clone().setZ(arena.z + 12), 'mine');
      const gp = golem.pos.clone();
      G.cam.fly(gp.clone().add(new THREE.Vector3(3, 3, 8)), gp.clone().setY(2.5), 1.2);
      await G.say([
        { name: '???', text: '쿠구구구… 누가 내 다이아몬드를 탐내느냐!' },
        { name: '도움말', text: `크리스털 골렘이에요! 앞에서는 망치가 안 통해요. 쿵 하고 내려찍은 뒤 잠깐 어지러워할 때, 등 뒤로 돌아가 분홍 크리스털을 세 번 쳐요! (${G.hint('roll')})` },
      ], { stop: true });
      G.cam.release();
      G.toHost(golem, 'start');
    },
  });
  const spawnCrystal = () => {
    if (S.parts.crystal) return;
    const pedestal = items.part(new THREE.CylinderGeometry(0.6, 0.8, 0.8, 8), '#6b6080', { x: arena.x, y: 0.4, z: arena.z });
    G.scene.add(pedestal);
    G.mark('energyCrystal', arena);
    createItemPickup(G, {
      id: 'energy-crystal', model: items.energyCrystal(), x: arena.x, z: arena.z, y: 0.8, float: 0.3,
      onCollect: async () => {
        S.parts.crystal = true; sfx.item(); G.refresh();
        await clearStage(3);
        await G.say([{ name: '요키', text: '에너지 크리스털이다! 이걸로 배를 움직일 수 있을 거야.' }, { name: '요키', text: '동쪽 동상 마을 문에 크리스털 모양 구멍이 있었지… 가 보자!' }]);
      },
    });
  };
  if (G.flag('golemAsleep')) spawnCrystal();
  // a friend put the golem to sleep: it shrinks here too, and the crystal appears
  G.on('shared', ({ key }) => { if (key === 'golemAsleep' && golem.state !== 'sleep') { golem.state = 'sleep'; golem.t = 0; spawnCrystal(); } });

  // exit elevator in the arena
  const exit = C(6, -85);
  const exitCage = cage.clone();
  exitCage.position.copy(exit).setZ(exit.z + 1.2);
  G.scene.add(exitCage);
  // the way out opens once the crystal is in the bag, so it can't be left behind
  G.addInteractable({ pos: exit, radius: 2.2, label: '엘리베이터 타고 밖으로 ⬆', enabled: () => S.parts.crystal, action: () => travel(G, new THREE.Vector3(SURFACE.x, sy, SURFACE.z + 3), Math.PI) });

  // --- collectibles
  createTreat(G, 3, 'mine-a', C(3, 3).x, C(3, 3).z, 0);
  createTreat(G, 3, 'mine-b', C(4, -32).x, C(4, -32).z, 0);
  createTreat(G, 3, 'mine-c', C(-8, -71).x, C(-8, -71).z, 0);
  createPotion(G, 'mine', C(-5, -25).x, C(-5, -25).z, 0);
  const chestAt = C(7, -29);
  const chest = place(G, 'chest', chestAt.x, chestAt.z, { y: 0, ry: -Math.PI / 2 });
  G.addInteractable({
    pos: chestAt, radius: 1.8, label: '보물 상자 열기', enabled: () => !S.treasures[3],
    action: () => { S.treasures[3] = true; sfx.item(); chest.rotation.x = -0.15; S.diamonds += 5; S.diamondsTotal += 5; for (let i = 0; i < 5; i++) setTimeout(() => sfx.diamond(), i * 120); G.toast('✨ 숨겨진 보물 발견! 다이아몬드 5개'); G.refresh(); },
  });
}

// Fade out, move, fade in.
export async function travel(G, to, heading) {
  G.beginCutscene();
  await G.hud.fade(true);
  G.player.teleport({ x: to.x, y: to.y, z: to.z }, heading);
  await new Promise((r) => setTimeout(r, 250));
  await G.hud.fade(false);
  G.endCutscene();
}

// B: the tunnel caves in behind Yorkie. Rocks fall where shadows appear.
function buildCollapse(G) {
  const start = C(0, -5), end = C(0, -24);
  G.mark('collapseEnd', end);
  let active = false, timer = 0;
  const falling = [];
  G.addTrigger({
    // the whole width of the tunnel mouth, so hugging a wall still starts it
    test: (p) => p.x > 597 && p.x < 604 && p.z < start.z + 1.5 && p.z > start.z - 3, once: false, enabled: () => !G.flag('collapseEscaped') && !active,
    onEnter: async () => {
      active = true;
      G.checkpoint(C(0, -3), 'mine'); // a faint restarts the run right here
      sfx.rumble(); G.cam.shake(0.8);
      G.toast('쿠르르릉! 천장이 무너져요! 끝까지 달려요!', 2500);
      G.musicOverride = 'chase';
    },
  });
  G.addTrigger({
    pos: end, radius: 3, once: false, enabled: () => active,
    onEnter: () => {
      active = false; G.musicOverride = null;
      G.setFlag('collapseEscaped');
      G.checkpoint(C(0, -27), 'mine');
      G.toast('휴, 빠져나왔다!');
    },
  });
  G.on('faint', () => { active = false; G.musicOverride = null; });
  G.onUpdate((dt) => {
    for (const f of falling) {
      f.t += dt;
      if (f.t < 0.9) { f.shadow.material.opacity = 0.2 + f.t * 0.4; continue; }
      const k = Math.min(1, (f.t - 0.9) / 0.35);
      f.rock.visible = true;
      f.rock.position.y = 5 - 4.6 * k;
      if (k >= 1 && !f.landed) {
        f.landed = true; sfx.stomp(); G.cam.shake(0.25);
        if (G.player.position.distanceTo(f.at) < 1.2 && G.player.state.action?.name !== 'roll') G.hurtPlayer(f.at);
      }
      if (f.t > 2.5) { G.scene.remove(f.rock, f.shadow); f.done = true; }
    }
    for (let i = falling.length - 1; i >= 0; i--) if (falling[i].done) falling.splice(i, 1);
    if (active && (G.player.position.z > start.z + 3 || G.player.position.x < 400)) { active = false; G.musicOverride = null; } // turned back
    if (!active || !G.ticking()) return;
    timer -= dt;
    if (timer > 0) return;
    timer = 0.6;
    // kid-friendly: most rocks land just behind Yorkie (the tunnel caving in at
    // their heels); some land well ahead, where the shadow gives time to dodge
    const p = G.player.position;
    const ahead = Math.random() < 0.35;
    const at = new THREE.Vector3(599 + Math.random() * 2.4, 0, ahead ? p.z - 4 - Math.random() * 3 : p.z + 0.8 + Math.random() * 3);
    const rock = items.part(new THREE.DodecahedronGeometry(0.5, 0), '#5a5068', { x: at.x, y: 5, z: at.z });
    rock.visible = false;
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.2 }));
    shadow.position.copy(at).setY(0.03);
    G.scene.add(rock, shadow);
    falling.push({ rock, shadow, at, t: 0 });
  });
}

// C+D: rock monsters wake in the station; jump in the cart and ride away.
function buildCartChase(G) {
  const station = C(0, -28);
  const rockies = [
    createRocky(G, { x: C(-4, -30).x, z: C(-4, -30).z, y: 0, id: 'mr1' }),
    createRocky(G, { x: C(3, -27).x, z: C(3, -27).z, y: 0, id: 'mr2' }),
    createRocky(G, { x: C(-3, -26).x, z: C(-3, -26).z, y: 0, id: 'mr3', scale: 1.15 }),
  ];

  // rails and the cart
  for (let z = RAIL_START; z >= RAIL_END; z -= 2) place(G, 'mineRail', 600, z, { y: 0, ry: Math.PI / 2, body: 'none' });
  const cart = instance('mineCart');
  cart.position.set(600, 0, RAIL_START);
  cart.rotation.y = Math.PI;
  G.scene.add(cart);
  G.look.shadows(cart);
  G.mark('cart', cart.position);
  const signs = [];
  for (const z of BEAMS) {
    const beam = new THREE.Group();
    beam.add(items.part(new THREE.BoxGeometry(4.2, 0.35, 0.35), '#7a5230', { y: 1.15 }));
    beam.add(items.part(new THREE.BoxGeometry(0.3, 1.2, 0.3), '#6a4628', { x: -2, y: 0.6 }));
    beam.add(items.part(new THREE.BoxGeometry(0.3, 1.2, 0.3), '#6a4628', { x: 2, y: 0.6 }));
    const sign = items.part(new THREE.BoxGeometry(1.6, 0.4, 0.05), '#ffcc33', { y: 1.15, z: 0.2 }, { emissive: '#ffcc33', emissiveIntensity: 0.6 });
    sign.material = sign.material.clone();
    beam.add(sign);
    signs.push({ z, sign });
    beam.position.set(600, 0, z);
    G.scene.add(beam);
    G.look.shadows(beam);
  }
  // a gate that drops behind the cart so the rocks stay out of the arena
  const gate = items.part(new THREE.BoxGeometry(4.2, 5, 0.3), '#5b5f66', { x: 600, y: 7.5, z: RAIL_END + 3 }, { metalness: 0.5 });
  G.scene.add(gate);
  let gateBody = null;
  const dropGate = () => { if (!gateBody) { gate.position.y = 2.5; gateBody = G.physics.addCuboid(600, 2.5, RAIL_END + 3, 2.1, 2.5, 0.2); } };
  if (G.flag('cartDone')) dropGate();
  G.on('shared', ({ key }) => { if (key === 'cartDone') dropGate(); }); // a friend rode through
  // still on the station side of the gate (a friend rode first, or I came in
  // later): the cart keeps working, so nobody is shut out of the arena
  const behind = () => G.player.position.x > 400 && G.player.position.z > RAIL_END + 3;

  G.addTrigger({
    pos: station, radius: 6, enabled: () => G.flag('collapseEscaped') && !G.flag('cartDone'),
    onEnter: async () => {
      for (const r of rockies) G.toHost(r, 'wake');
      G.cam.shake(0.4);
      await G.say([{ name: '요키', text: '여기에도 돌 괴물이?! 저 광산 카트에 올라타자!' }, { name: '도움말', text: G.hint('cart') }]);
    },
  });

  let ride = null;
  G.addInteractable({
    pos: () => cart.position, radius: 2.4, label: '광산 카트 타기!', enabled: () => !ride && G.flag('collapseEscaped') && (!G.flag('cartDone') || behind()),
    action: () => {
      ride = { z: RAIL_START, y: 0, vy: 0, hits: new Set(), speed: 0 };
      G.player.state.frozen = true;
      G.musicOverride = 'chase';
      sfx.whoosh();
    },
  });
  G.on('faint', () => { if (ride) { ride = null; G.player.state.frozen = false; cart.position.set(600, 0, RAIL_START); G.musicOverride = null; } });
  const jump = () => { if (ride && ride.y <= 0.01 && G.mode === 'play') { ride.vy = CART_JUMP; sfx.jump(); } };
  G.on('rideJump', jump);
  // a hop: Space, 3 (the jump key), or a mouse click (no aiming needed in a cart)
  addEventListener('keydown', (e) => { if (ride && !e.usedForDialog && ['Space', 'Digit3'].includes(e.code)) jump(); });
  addEventListener('mousedown', () => { if (ride) jump(); }, true);
  G.riding = () => !!ride;
  G.rideHeight = () => (ride ? ride.y : 0);

  G.onUpdate((dt) => {
    if (!ride || !G.ticking()) return;
    ride.speed = Math.min(CART_SPEED, ride.speed + dt * 5);
    ride.z -= ride.speed * dt;
    ride.vy -= CART_GRAVITY * dt;
    ride.y = Math.max(0, ride.y + ride.vy * dt);
    if (ride.y === 0) ride.vy = 0;
    cart.position.set(600, ride.y, ride.z);
    cart.rotation.z = Math.sin(G.time * 18) * 0.03;
    const pm = G.player.model;
    pm.position.set(600, ride.y + 0.45, ride.z);
    G.player.state.heading = Math.PI;
    G.player.body.setNextKinematicTranslation({ x: 600, y: ride.y + 1.1, z: ride.z });
    // a beam coming up: blink its sign and say "jump now"
    const next = signs.find((b) => !ride.hits.has(b.z) && ride.z - b.z > 0 && ride.z - b.z < WARN_AHEAD);
    for (const b of signs) b.sign.material.emissiveIntensity = b === next ? 0.6 + Math.abs(Math.sin(G.time * 12)) * 1.6 : 0.6;
    G.hud.prompt(next ? (ride.y > 0.01 ? '⤴ 휙!' : (G.touch ? '⤴ 지금 점프! (화면을 톡)' : '⤴ 지금 점프! (Space · 클릭)')) : '🛒 꽉 잡아요!');
    for (const bz of BEAMS) {
      if (!ride.hits.has(bz) && Math.abs(ride.z - bz) < 0.4) {
        ride.hits.add(bz);
        if (ride.y < 0.7) {
          // a bump costs a heart, but the ride never knocks Yorkie out: a
          // child should not lose the whole chase to the last beam
          if (G.state.hearts > 1) { G.player.state.invulnerable = 0; G.hurtPlayer(new THREE.Vector3(600, 1, bz - 2), 1, { beam: true }); G.player.state.knock.set(0, 0); }
          else { sfx.bonk(); G.toast('아야! 하트가 하나뿐이에요. 다음 들보는 꼭 점프!', 1800); }
          if (!ride) return;
        }
        else sfx.pickup();
      }
    }
    if (ride.z <= RAIL_END) {
      ride = null;
      G.hud.prompt(null);
      G.player.state.frozen = false;
      G.player.teleport({ x: 600, y: 0, z: RAIL_END - 2.5 }, Math.PI);
      G.musicOverride = null;
      dropGate();
      sfx.stomp(); G.cam.shake(0.4);
      for (const r of rockies) r.reset();
      G.setFlag('cartDone');
      G.checkpoint(new THREE.Vector3(600, 0, RAIL_END - 4), 'mine');
      G.toast('철컥! 문이 닫혀서 돌 괴물들이 못 따라와요');
    }
  });
}
