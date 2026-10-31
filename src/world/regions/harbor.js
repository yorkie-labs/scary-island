import * as THREE from 'three';
import { heightAt, GATES } from '../map.js';
import { place, instance } from '../models.js';
import * as items from '../items.js';
import { createTreat, createPotion, createSnack, createChest, createHideBush, groundPos } from '../interactables.js';
import { createRocky } from '../../entities/rocky.js';
import { createMushy } from '../../entities/mushy.js';
import { sfx } from '../../audio/sound.js';
import { playEnding } from '../../story.js';

// STAGE 5 — ESCAPE ISLAND (GDD §5). Past the lifted seal lies the old
// harbor: check the boat, fit the engine part, pour in the fuel, set the
// energy crystal, hold out while the engine warms up and the monsters come,
// then board with the ship key and sail away.

export const HARBOR_MODELS = ['pier', 'mooring', 'dockLantern', 'lighthouse', 'fisherShack', 'boatShed', 'sloop', 'sloopHull', 'netRack',
  'lobsterPots', 'barrel', 'crate', 'palm', 'ropeCoil', 'anchor', 'chest', 'signpost'];

const DIR = new THREE.Vector2(0.62, 0.78).normalize(); // out to sea
const DOCK_START = new THREE.Vector3(66, 0, 76);
const DOCK_LEN = 16;
const WARMUP = 25;

export function buildHarbor(G) {
  const S = G.state;
  buildSealBarrier(G);

  // --- harbor yard
  place(G, 'fisherShack', 52, 62, { ry: 0.9 });
  place(G, 'boatShed', 72, 58, { ry: -0.8 });
  place(G, 'netRack', 58, 72, { ry: 0.6 });
  place(G, 'lobsterPots', 61, 75, { ry: 0.2 });
  place(G, 'barrel', 56, 68); place(G, 'barrel', 57, 69.5); place(G, 'crate', 70, 66, { ry: 0.5 });
  place(G, 'ropeCoil', 64, 74);
  place(G, 'signpost', 64, 48, { ry: 0.2 });
  for (const [x, z] of [[46, 70], [78, 70], [50, 80], [80, 52]]) place(G, 'palm', x, z, { ry: x });
  // the lighthouse on its point
  const lh = { x: 86, z: 66 };
  place(G, 'lighthouse', lh.x, lh.z, { ry: -1.2 });
  const beacon = G.addLight({ pos: groundPos(lh.x, lh.z, 13), color: '#fff0b0', intensity: 10, distance: 30 });
  G.onUpdate(() => { beacon.intensity = 6 + Math.sin(G.time * 1.5) * 5; });

  // --- a wooden dock out to the boat, deck level with the shore
  const deckY = Math.max(0.9, heightAt(DOCK_START.x, DOCK_START.z));
  const ry = Math.atan2(DIR.x, DIR.y);
  const dock = new THREE.Group();
  dock.position.set(DOCK_START.x, 0, DOCK_START.z);
  dock.rotation.y = ry;
  for (let i = 0; i < DOCK_LEN / 0.5; i++) dock.add(items.part(new THREE.BoxGeometry(3, 0.14, 0.45), i % 2 ? '#a07a50' : '#8f6b45', { y: deckY, z: i * 0.5 }));
  for (let i = 0; i <= DOCK_LEN; i += 4) for (const sx of [-1.4, 1.4]) dock.add(items.part(new THREE.CylinderGeometry(0.12, 0.12, deckY + 3, 6), '#6b4f33', { x: sx, y: (deckY - 3) / 2, z: i }));
  G.scene.add(dock);
  G.look.shadows(dock);
  G.groundMeshes?.push(dock);
  const mid = DOCK_START.clone().add(new THREE.Vector3(DIR.x, 0, DIR.y).multiplyScalar(DOCK_LEN / 2));
  G.physics.addCuboid(mid.x, deckY - 0.1, mid.z, 1.5, 0.12, DOCK_LEN / 2 + 0.3, ry);
  const along = (d, side = 0) => DOCK_START.clone().add(new THREE.Vector3(DIR.x * d + DIR.y * side, deckY, DIR.y * d - DIR.x * side));
  for (const d of [2, 8, 14]) { const p = along(d, 1.6); place(G, 'mooring', p.x, p.z, { y: deckY - 0.2 }); }
  for (const d of [0, 12]) { const p = along(d, -1.6); place(G, 'dockLantern', p.x, p.z, { y: deckY }); G.addLight({ pos: p.clone().setY(deckY + 2.4), color: '#ffcf87', intensity: 5, distance: 10 }); }

  // --- the boat: a broken hull until it is repaired
  const boatAt = along(DOCK_LEN - 3, 4.2);
  const hull = instance('sloopHull');
  const ship = instance('sloop');
  for (const b of [hull, ship]) { b.position.set(boatAt.x, -0.6, boatAt.z); b.rotation.y = ry + Math.PI; G.scene.add(b); G.look.shadows(b); }
  const repaired = () => G.flag('crystalFitted');
  const refreshBoat = () => { hull.visible = !repaired(); ship.visible = repaired(); };
  refreshBoat();
  G.onUpdate(() => { const bob = Math.sin(G.time * 0.9) * 0.08; hull.position.y = ship.position.y = -0.6 + bob; ship.rotation.z = Math.sin(G.time * 0.7) * 0.02; });
  const boatPos = along(DOCK_LEN - 3, 1.2);
  G.mark('boat', boatPos);
  G.mark('sealBarrier', groundPos(GATES.sealBarrier.x, GATES.sealBarrier.z + 3));

  G.addTrigger({ test: (p) => p.z > 46 && p.x > 40 && p.x < 100, enabled: () => G.flag('sealReleased') && !G.flag('harborReached'), onEnter: async () => {
    G.setFlag('harborReached');
    G.checkpoint(groundPos(62, 60), 'harbor');
    await G.say([{ name: 'Yorkie', text: '항구다! 저기 부두 끝에 배가 있어… 많이 부서졌지만 고칠 수 있을 것 같아!' }]);
  } });

  // --- the repair, one step at a time
  let warm = null;
  const step = () => {
    if (!G.flag('boatChecked')) return 'check';
    if (!S.parts.engine || !S.parts.fuel || !S.parts.crystal || !S.parts.shipKey) return 'missing';
    if (!G.flag('engineFixed')) return 'engine';
    if (!G.flag('fuelFilled')) return 'fuel';
    if (!G.flag('crystalFitted')) return 'crystal';
    if (!G.flag('finalChase')) return warm ? 'warming' : 'startEngine';
    if (!G.flag('escaped')) return 'board'; // also after a reload during the ending
    return 'done';
  };
  const LABELS = {
    check: '배 상태 확인하기', missing: '부품이 모자라요', engine: '⚙️ 엔진 부품 끼우기', fuel: '⛽ 연료 넣기', crystal: '🔮 크리스털 끼우기',
    startEngine: '🔑 열쇠로 시동 걸기', warming: '엔진 데우는 중…', board: '⛵ 배에 타기!', done: '',
  };
  G.addInteractable({
    pos: boatPos, radius: 3.2, label: () => LABELS[step()], enabled: () => G.flag('harborReached') && step() !== 'done' && step() !== 'warming',
    action: async () => {
      const s = step();
      if (s === 'check') {
        G.setFlag('boatChecked');
        const missing = Object.entries({ engine: '엔진 부품 (해변 난파선 옆 나무 상자 속)', fuel: '연료통 (숲속 오두막)', crystal: '에너지 크리스털 (광산)', shipKey: '배의 열쇠 (동상 마을)' })
          .filter(([k]) => !S.parts[k]).map(([, v]) => v);
        await G.say([{ name: 'Yorkie', text: '엔진은 비어 있고, 연료도 없고, 크리스털 자리도 비어 있어. 열쇠 구멍도 있네!' },
          { name: 'Yorkie', text: missing.length ? `아직 없는 건… ${missing.join(', ')}. 찾으러 가자!` : '그래도 부품은 다 모았어! 하나씩 끼워 보자.' }]);
      } else if (s === 'missing') {
        await G.say([{ name: 'Yorkie', text: '아직 부품이 모자라. 지도를 보고 다시 찾아보자!' }]);
      } else if (s === 'engine') { sfx.clink(); G.setFlag('engineFixed'); G.toast('철컥! 엔진 부품 장착'); }
      else if (s === 'fuel') { sfx.puff(); G.setFlag('fuelFilled'); G.toast('꿀렁꿀렁… 연료 가득!'); }
      else if (s === 'crystal') { sfx.power(); G.setFlag('crystalFitted'); refreshBoat(); G.toast('반짝! 배가 새것처럼 빛나요'); }
      else if (s === 'startEngine') startChase();
      else if (s === 'board') board();
    },
  });

  // --- the last chase: the island's monsters come for Yorkie one last time
  // Out on the dock there is one way on: the rocks walk to its foot first,
  // then along the planks (they never wade into the sea).
  const dockFoot = DOCK_START.clone().addScaledVector(new THREE.Vector3(DIR.x, 0, DIR.y), -1.5);
  const onDock = (q) => {
    const dx = q.x - DOCK_START.x, dz = q.z - DOCK_START.z;
    const along = dx * DIR.x + dz * DIR.y, side = Math.abs(dx * DIR.y - dz * DIR.x);
    return along > -2 && along < DOCK_LEN + 1 && side < 2;
  };
  const route = (from, to) => (onDock(to) && !onDock(from) ? dockFoot : to);
  const hunters = [
    createRocky(G, { x: 54, z: 62, id: 'h1', hunter: true, route }),
    createRocky(G, { x: 72, z: 62, id: 'h2', scale: 1.2, hunter: true, route }),
    createRocky(G, { x: 60, z: 56, id: 'h3', hunter: true, route }),
  ];
  const ghost = createMushy(G, { x: 60, z: 62, id: 'h4', range: 14 });
  ghost.state = 'sleep'; ghost.sleepFor = 1e9;
  // a faint anywhere resets every monster: this one stays asleep unless the last chase is on
  const ghostReset = ghost.reset;
  ghost.reset = () => { ghostReset(); if (!warm) { ghost.state = 'sleep'; ghost.sleepFor = 1e9; } };
  for (const [x, z] of [[54, 72], [72, 62], [60, 56]]) createHideBush(G, x, z);

  async function startChase() {
    warm = { t: WARMUP };
    sfx.power();
    G.musicOverride = 'chase';
    G.checkpoint(groundPos(64, 66), 'harbor');
    await G.say([
      { name: 'Yorkie', text: '부르릉… 시동이 걸렸어! 엔진이 데워질 때까지 조금만 기다리면 돼.' },
      { name: '???', text: '쿵! 쿵! 쿵! 쿵!' },
      { name: 'Yorkie', text: '으악, 괴물들이 몰려와! 도망치고, 숨고, 버텨야 해!' },
    ]);
    for (const h of hunters) h.wake();
    ghost.sleepFor = 0;
  }
  G.on('faint', () => {
    if (!warm) return;
    warm = null; G.musicOverride = null;
    ghost.state = 'sleep'; ghost.sleepFor = 1e9;
  // a faint anywhere resets every monster: this one stays asleep unless the last chase is on
  const ghostReset = ghost.reset;
  ghost.reset = () => { ghostReset(); if (!warm) { ghost.state = 'sleep'; ghost.sleepFor = 1e9; } };
  });
  G.onUpdate((dt) => {
    if (!warm || G.mode !== 'play') return;
    warm.t -= dt;
    G.hud.prompt(`⏱️ 엔진 데우는 중… ${Math.ceil(warm.t)}초`);
    if (warm.t <= 0) {
      warm = null;
      G.musicOverride = null;
      G.setFlag('finalChase');
      for (const h of hunters) h.reset();
      ghost.state = 'sleep'; ghost.sleepFor = 1e9;
  // a faint anywhere resets every monster: this one stays asleep unless the last chase is on
  const ghostReset = ghost.reset;
  ghost.reset = () => { ghostReset(); if (!warm) { ghost.state = 'sleep'; ghost.sleepFor = 1e9; } };
      sfx.fanfare();
      G.toast('엔진 준비 완료! 배에 타요!', 3000);
    }
  });

  async function board() {
    G.setFlag('boarded');
    await playEnding(G, { ship, dir: new THREE.Vector3(DIR.x, 0, DIR.y) });
  }

  // --- collectibles
  createTreat(G, 5, 'harbor-a', 72, 72);
  createTreat(G, 5, 'harbor-b', 48, 58);
  createTreat(G, 5, 'harbor-c', 76, 46);
  createPotion(G, 'harbor', 66, 58);
  createSnack(G, 58, 64);
  createChest(G, 5, 80, 52, { ry: -2 }); // on the grass by the lighthouse path (was in the sea)
}

// The magic barrier on the road from the village: it fades when the seal breaks.
function buildSealBarrier(G) {
  const g = GATES.sealBarrier;
  const y = heightAt(g.x, g.z);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 6, 6, 4), new THREE.MeshBasicMaterial({ color: '#b48cff', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
  wall.position.set(g.x, y + 3, g.z);
  G.scene.add(wall);
  let body = null;
  if (G.flag('sealReleased')) wall.visible = false;
  else body = G.physics.addCuboid(g.x, y + 3, g.z, 3.8, 3, 0.3);
  G.addInteractable({ pos: new THREE.Vector3(g.x, y, g.z - 1.5), radius: 2.6, label: '보라색 봉인이 길을 막고 있어요', enabled: () => !G.flag('sealReleased'),
    action: () => G.say([{ name: 'Yorkie', text: '이상한 빛이 길을 막고 있어. 섬 어딘가의 봉인을 풀어야 하나 봐.' }]) });
  G.onUpdate(() => {
    if (G.flag('sealReleased') && body) { G.physics.remove(body); body = null; }
    if (G.flag('sealReleased') && wall.visible) { wall.material.opacity -= 0.01; if (wall.material.opacity <= 0) wall.visible = false; }
    else if (wall.visible) wall.material.opacity = 0.35 + Math.sin(G.time * 3) * 0.12;
  });
}
