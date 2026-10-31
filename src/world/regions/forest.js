import * as THREE from 'three';
import { heightAt, GATES } from '../map.js';
import { place } from '../models.js';
import * as items from '../items.js';
import { scatterIn } from '../scatter.js';
import { createTreat, createPotion, createSnack, createChest, createHideBush, createItemPickup, createSqueezeGap, groundPos } from '../interactables.js';
import { createWatcher } from '../../entities/watcher.js';
import { createMushy, createFan } from '../../entities/mushy.js';
import { sfx } from '../../audio/sound.js';

// STAGE 2 — WHISPERING FOREST (GDD §5). Find the scissors, cut the vines,
// sneak past the statues by keeping them in sight, blow the mushroom ghosts
// away with the wind fans, take the generator part (and the fuel can) from
// the hut, then power the generator and open the mine door.

export const FOREST_MODELS = ['pine', 'youngPine', 'oak', 'deadTree', 'birch', 'fallenLog', 'fernPlant', 'toadstool', 'bonnet', 'puffball',
  'mushCluster', 'fence', 'cabin', 'woodshed', 'choppingBlock', 'mossBoulder', 'rockSpire', 'knightStatue', 'founderStatue', 'lionStatue',
  'angelStatue', 'rabbit', 'generator', 'stump', 'lantern', 'headframe'];

const HUT = { x: -71, z: -15 };

export function buildForest(G, { clearStage }) {
  const S = G.state;

  // --- trees: dense, dark and old, glowing mushrooms between them
  const clear = [[HUT.x, HUT.z, 11], [GATES.vines.x, GATES.vines.z, 7], [-64, 4, 5], [-58, 18, 4]];
  const trees = scatterIn('forest', 70, { seed: 21, spacing: 4.2, keepClear: clear });
  trees.forEach((p, i) => {
    const kind = p.r < 0.35 ? 'pine' : p.r < 0.55 ? 'oak' : p.r < 0.7 ? 'youngPine' : p.r < 0.82 ? 'birch' : 'deadTree';
    place(G, kind, p.x, p.z, { ry: p.ry });
  });
  scatterIn('forest', 14, { seed: 5, spacing: 7, keepClear: clear }).forEach((p, i) => place(G, i % 3 === 0 ? 'bonnet' : i % 3 === 1 ? 'puffball' : 'mushCluster', p.x, p.z, { ry: p.ry, s: i % 3 === 0 ? 0.55 : i % 3 === 1 ? 0.6 : 1.6 }));
  scatterIn('forest', 40, { seed: 9, spacing: 2.5, keepClear: clear }).forEach((p, i) => place(G, i % 2 ? 'fernPlant' : 'toadstool', p.x, p.z, { ry: p.ry, s: i % 2 ? 1 : 2 }));
  scatterIn('forest', 8, { seed: 13, spacing: 8, keepClear: clear }).forEach((p, i) => place(G, i % 2 ? 'fallenLog' : 'mossBoulder', p.x, p.z, { ry: p.ry }));
  // soft purple glows under the canopy (GDD palette: green, purple, dark blue)
  for (const [x, z] of [[-48, 20], [-60, -6], [-80, 10], [-74, -28], [-90, 0], [-52, -20]]) {
    G.addLight({ pos: groundPos(x, z, 1.5), color: '#b07bff', intensity: 5, distance: 14 });
  }
  const rabbit = place(G, 'rabbit', -58, 24, { ry: 1 });
  G.onUpdate(() => { rabbit.position.y = heightAt(rabbit.position.x, rabbit.position.z) + Math.abs(Math.sin(G.time * 4)) * 0.15; });

  buildVines(G);

  // --- the flashlight, just past the vines and before the statues.
  // [call] (director Jiyu): the GDD gives it in Stage 4, but the forest
  // statues were too hard without it, so it is found here.
  if (!S.items.flashlight) {
    place(G, 'stump', -38, 15);
    G.mark('flashlight', groundPos(-38, 15));
    createItemPickup(G, {
      id: 'flashlight', model: items.flashlight(), x: -38, z: 15, y: heightAt(-38, 15) + 0.45, float: 0.4,
      onCollect: async () => {
        S.items.flashlight = true; sfx.item(); G.refresh();
        await G.say([
          { name: 'Yorkie', text: '손전등이다! 이 어두운 숲에서 딱 필요한 거야.' },
          { name: '도움말', text: G.hint('flashlight') },
        ]);
      },
    });
  }

  // --- scissors on a stump near the forest edge (camp side)
  if (!S.items.scissors) {
    place(G, 'stump', -22, 22);
    G.mark('scissors', groundPos(-22, 22));
    createItemPickup(G, {
      id: 'scissors', model: items.scissors(), x: -22, z: 22, y: heightAt(-22, 22) + 0.45, float: 0.35,
      onCollect: async () => {
        S.items.scissors = true; sfx.item(); G.refresh();
        await G.say([{ name: 'Yorkie', text: '가위다! 이걸로 덩굴을 자를 수 있겠어.' }, { name: '도움말', text: G.hint('scissors') }]);
      },
    });
  }
  G.addTrigger({
    pos: new THREE.Vector3(GATES.vines.x + 6, 0, GATES.vines.z), radius: 9, enabled: () => G.flag('campReached') && !G.flag('forestEntrance'),
    onEnter: async () => {
      G.setFlag('forestEntrance');
      await G.say([{ name: 'Yorkie', text: '숲 입구가 덩굴로 꽁꽁 막혀 있어… 자를 게 필요해.' }, { name: 'Yorkie', text: '어? 저기 그루터기 위에 뭔가 반짝이는데?' }]);
    },
  });

  // --- the statue walk (Watchers line the path)
  const watchers = [
    createWatcher(G, { x: -42, z: 3, ry: Math.PI / 2, model: 'knightStatue', id: 'w1' }),
    createWatcher(G, { x: -49, z: 16, ry: Math.PI, model: 'angelStatue', id: 'w2' }),
    createWatcher(G, { x: -56, z: -3, ry: 0, model: 'founderStatue', id: 'w3', speed: 2.8 }),
    createWatcher(G, { x: -62, z: 14, ry: Math.PI, model: 'knightStatue', id: 'w4' }),
  ];
  G.mark('watchers', groundPos(-49, 8));
  G.on('watcherObserved', async (w) => {
    if (w.region !== 'forest' || G.flag('watcherSeen') || G.mode !== 'play') return;
    G.setFlag('watcherSeen');
    await G.say([
      { name: 'Yorkie', text: '저 동상… 방금 움직인 것 같은데?!' },
      { name: '도움말', text: G.hint('watcher') },
    ]);
  });
  // reaching the hut: a sigh of relief, then the statues behind fall asleep for good
  G.addTrigger({ pos: new THREE.Vector3(-66, 0, -6), radius: 7, enabled: () => G.flag('vinesCut') && !G.flag('pastWatchers'), onEnter: async () => {
    G.setFlag('pastWatchers'); G.setFlag('watcherSeen');
    for (const w of watchers) w.sleep(); // first, so none can bump Yorkie while the line is up
    await G.say([{ name: 'Yorkie', text: '휴~ 무사히 지나왔어! 동상들도 이제 움직이지 않네.' }]);
  } });
  if (G.flag('pastWatchers')) for (const w of watchers) w.sleep(); // a save from after the walk

  // --- mushroom ghosts by the hut, and the fans that beat them
  createMushy(G, { x: -66, z: -20, id: 'm1' });
  createMushy(G, { x: -79, z: -8, id: 'm2' });
  createFan(G, { x: -62, z: -12, ry: Math.atan2(-66 + 62, -20 + 12) });
  createFan(G, { x: -73, z: -3, ry: Math.atan2(-79 + 73, -8 + 3) });
  let mushyTold = false;
  G.on('mushyBlown', () => { if (!mushyTold) { mushyTold = true; G.toast('휘이잉~ 버섯 유령이 날아갔어요!'); } });
  G.addTrigger({ pos: new THREE.Vector3(-66, 0, -10), radius: 9, enabled: () => G.flag('pastWatchers') && !G.flag('mushyIntro'), onEnter: async () => {
    G.setFlag('mushyIntro');
    await G.say([{ name: 'Yorkie', text: '보라색 연기를 뿜는 버섯 유령이야! 저 바람개비 장치를 켜면 날려 버릴 수 있을까?' }]);
  } });

  // --- the hut
  const cabin = place(G, 'cabin', HUT.x, HUT.z, { ry: 0.4 });
  place(G, 'woodshed', HUT.x - 8, HUT.z + 2, { ry: 1.2 });
  place(G, 'choppingBlock', HUT.x + 4, HUT.z + 5);
  for (let i = 0; i < 4; i++) place(G, 'fence', HUT.x - 6 + i * 2.1, HUT.z + 8, { ry: 0 });
  const door = groundPos(HUT.x + Math.sin(0.4) * 4.4, HUT.z + Math.cos(0.4) * 4.4);
  G.mark('hut', door);
  G.addInteractable({
    pos: door, radius: 2.4, label: '오두막 살펴보기', enabled: () => !(S.parts.generatorPart && S.parts.fuel),
    action: async () => {
      S.parts.generatorPart = true; S.parts.fuel = true;
      sfx.item(); G.refresh();
      await G.say([
        { name: 'Yorkie', text: '먼지투성이 오두막이야… 어! 발전기 부품이랑 연료통이 있어!' },
        { name: 'Yorkie', text: '연료통은 배에 넣으면 되겠다. 발전기 부품은… 광산 문 옆 발전기에 맞을 것 같아!' },
      ]);
    },
  });

  // --- collectibles
  createTreat(G, 2, 'forest-a', -88, 22);
  createTreat(G, 2, 'forest-b', -45, -24);
  createTreat(G, 2, 'forest-c', -90, -8);
  createPotion(G, 'forest', -58, 26);
  createSnack(G, -52, 6);
  createSnack(G, -70, -6);
  // the chest sits in a fenced pen; only a small dog fits under the broken panel
  const pen = { x: -86, z: -30 };
  createChest(G, 2, pen.x, pen.z, { ry: 0.5 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const fx = pen.x + Math.sin(a) * 2.7, fz = pen.z + Math.cos(a) * 2.7;
    place(G, 'fence', fx, fz, { ry: a + Math.PI / 2, lift: i === 0 ? 0.5 : 0 });
  }
  createSqueezeGap(G, { outside: groundPos(pen.x, pen.z + 4), inside: groundPos(pen.x, pen.z + 1.3) });
  for (const [x, z] of [[-46, 8], [-53, 10], [-59, 4], [-64, 8], [-68, -2]]) createHideBush(G, x, z);

  buildGeneratorAndMineDoor(G, { clearStage });
  return { watchers };
}

// A curtain of vines across the forest gap; scissors cut it.
function buildVines(G) {
  const g = GATES.vines;
  const y = heightAt(g.x, g.z);
  const vines = new THREE.Group();
  vines.position.set(g.x, y, g.z);
  vines.rotation.y = g.ry;
  const greens = ['#2f6b34', '#3f8a40', '#4f9a48'];
  for (let i = 0; i < 26; i++) {
    const x = -3.4 + (i / 25) * 6.8;
    const h = 3.5 + Math.sin(i * 1.7) * 0.8;
    const strand = items.part(new THREE.CylinderGeometry(0.06, 0.09, h, 5), greens[i % 3], { x, y: h / 2, z: Math.sin(i) * 0.25, rz: Math.sin(i * 3.1) * 0.12 });
    vines.add(strand);
    for (let k = 0; k < 3; k++) vines.add(items.part(new THREE.IcosahedronGeometry(0.22, 0), greens[(i + k) % 3], { x: x + Math.sin(k) * 0.15, y: 0.6 + k * 1.1 + (i % 2) * 0.4, z: 0.12, sz: 0.4 }));
  }
  for (let i = 0; i < 6; i++) vines.add(items.part(new THREE.IcosahedronGeometry(0.1, 0), '#ff8fc8', { x: -3 + i * 1.2, y: 1.4 + (i % 3) * 0.7, z: 0.2 }));
  G.scene.add(vines);
  G.look.shadows(vines);
  let body = null;
  const pos = new THREE.Vector3(g.x + 1.6, y, g.z);
  G.mark('vines', pos);

  const cut = (instant) => {
    if (body) { G.physics.remove(body); body = null; }
    if (instant) { vines.visible = false; return; }
    let t = 0;
    G.onUpdate((dt) => { if (t < 1) { t = Math.min(1, t + dt * 1.5); vines.scale.y = 1 - t; if (t >= 1) vines.visible = false; } });
  };
  if (G.flag('vinesCut')) cut(true);
  else body = G.physics.addCuboid(g.x, y + 2, g.z, 0.4, 2.5, 3.4);

  const tryCut = async () => {
    if (G.flag('vinesCut')) return;
    if (!G.state.items.scissors) { await G.say([{ name: 'Yorkie', text: '덩굴이 너무 질겨… 맨손으로는 안 되겠어. 자를 게 필요해!' }]); return; }
    sfx.snip(); setTimeout(() => sfx.snip(), 250);
    G.setFlag('vinesCut');
    cut(false);
    G.toast('싹둑싹둑! 덩굴을 잘랐어요');
  };
  G.addInteractable({ pos, radius: 3.2, enabled: () => !G.flag('vinesCut'), label: () => (G.state.items.scissors ? '가위로 덩굴 자르기' : '덩굴이 길을 막고 있어요'), action: tryCut });
}

function buildGeneratorAndMineDoor(G, { clearStage }) {
  const g = GATES.mineDoor;
  const y = heightAt(g.x, g.z);
  // generator beside the door, on the camp side
  const gen = place(G, 'generator', 5.5, -25, { ry: -0.4 });
  const genPos = groundPos(5.5, -24);
  G.mark('generator', genPos);
  const lamps = [];
  for (const sx of [-3.4, 3.4]) {
    const l = G.addLight({ pos: new THREE.Vector3(g.x + sx, y + 4.2, g.z + 0.8), color: '#ffd27a', intensity: 8, distance: 10 });
    l.on = false;
    lamps.push(l);
    const bulb = items.part(new THREE.SphereGeometry(0.18, 8, 6), '#fff2c0', { x: g.x + sx, y: y + 4.2, z: g.z + 0.9 }, { emissive: '#ffd27a', emissiveIntensity: 0 });
    G.scene.add(bulb);
    lamps.push(bulb);
  }
  const powerOn = () => { for (const l of lamps) { if (l.material) l.material.emissiveIntensity = 1.2; else l.on = true; } };
  if (G.flag('generatorFixed')) powerOn();
  G.addInteractable({
    pos: genPos, radius: 2.4, enabled: () => !G.flag('generatorFixed'),
    label: () => (G.state.parts.generatorPart ? '발전기 고치기' : '고장 난 발전기 (부품이 필요해요)'),
    action: async () => {
      if (!G.state.parts.generatorPart) { await G.say([{ name: 'Yorkie', text: '부품 하나가 빠져 있어. 숲속 오두막에 있을지도 몰라.' }]); return; }
      sfx.power();
      G.cam.shake(0.2);
      powerOn();
      G.setFlag('generatorFixed');
      G.toast('부르르릉! 발전기가 켜졌어요');
    },
  });

  // the mine door: a heavy timber gate between rock pillars
  const doorG = new THREE.Group();
  doorG.position.set(g.x, y, g.z);
  doorG.add(items.part(new THREE.BoxGeometry(1.2, 5, 1.6), '#7d746b', { x: -3.3, y: 2.5 }));
  doorG.add(items.part(new THREE.BoxGeometry(1.2, 5, 1.6), '#7d746b', { x: 3.3, y: 2.5 }));
  doorG.add(items.part(new THREE.BoxGeometry(8, 0.9, 1.7), '#6a4a2c', { y: 5.1 }));
  const leaf = new THREE.Group();
  for (let i = 0; i < 6; i++) leaf.add(items.part(new THREE.BoxGeometry(0.88, 4.4, 0.3), i % 2 ? '#8a5a34' : '#7a4e2c', { x: -2.2 + i * 0.88, y: 2.2 }));
  leaf.add(items.part(new THREE.BoxGeometry(5.4, 0.25, 0.4), '#5b5f66', { y: 1.2 }, { metalness: 0.5 }));
  leaf.add(items.part(new THREE.BoxGeometry(5.4, 0.25, 0.4), '#5b5f66', { y: 3.4 }, { metalness: 0.5 }));
  doorG.add(leaf);
  G.scene.add(doorG);
  G.look.shadows(doorG);
  G.physics.addCuboid(g.x - 3.3, y + 2.5, g.z, 0.6, 2.5, 0.8);
  G.physics.addCuboid(g.x + 3.3, y + 2.5, g.z, 0.6, 2.5, 0.8);
  let body = null;
  const open = (instant) => {
    if (body) { G.physics.remove(body); body = null; }
    if (instant) { leaf.position.y = 4.3; return; }
    sfx.grind();
    let t = 0;
    G.onUpdate((dt) => { if (t < 1) { t = Math.min(1, t + dt / 2.5); leaf.position.y = 4.3 * t; } });
  };
  if (G.flag('mineDoorOpen')) open(true);
  else body = G.physics.addCuboid(g.x, y + 2.2, g.z, 2.7, 2.2, 0.25);
  const pos = new THREE.Vector3(g.x, y, g.z + 1.8);
  G.mark('mineDoor', pos);
  G.addInteractable({
    pos, radius: 3, enabled: () => !G.flag('mineDoorOpen'),
    label: () => (G.flag('generatorFixed') ? '광산 문 열기' : '굳게 닫힌 광산 문 (전기가 필요해요)'),
    action: async () => {
      if (!G.flag('generatorFixed')) { await G.say([{ name: 'Yorkie', text: '문이 꿈쩍도 안 해. 옆에 있는 발전기를 켜야 하나 봐.' }]); return; }
      G.setFlag('mineDoorOpen');
      open(false);
      await clearStage(2);
      await G.say([{ name: 'Yorkie', text: '광산 문이 열렸다! 저 안쪽에 엘리베이터가 보여.' }]);
    },
  });
}
