import * as THREE from 'three';
import { heightAt } from './map.js';
import { place } from './models.js';
import * as items from './items.js';
import { sfx } from '../audio/sound.js';
import { addDiamonds, heal, maxPotions } from '../core/state.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
export const groundPos = (x, z, lift = 0) => v(x, heightAt(x, z) + lift, z);

// Where a drop lands: it pops out toward Yorkie (like loot in Diablo) and only
// ever onto ground Yorkie can walk to, never into a wall or behind a rock.
export function dropSpot(G, from) {
  const pp = G.player?.position ?? from;
  const toward = Math.atan2(pp.x - from.x, pp.z - from.z);
  const ground = (x, z) => (G.groundAt ? G.groundAt(x, z) : heightAt(x, z));
  for (let i = 0; i < 12; i++) {
    // fan out around the direction of Yorkie, a little further each try
    const a = toward + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.45 + (Math.random() - 0.5) * 0.3;
    const d = 1.2 + Math.random() * 0.5 + Math.floor(i / 6) * 0.6;
    const x = from.x + Math.sin(a) * d, z = from.z + Math.cos(a) * d;
    const cell = G.nav?.cell(G.nav.toIx(x), G.nav.toIx(z));
    if (!G.nav || (cell && Math.abs(cell.y - ground(x, z)) < 0.6)) return v(x, ground(x, z), z);
  }
  // nowhere free around it: drop it right by Yorkie
  return v(pp.x, ground(pp.x, pp.z), pp.z);
}

// A diamond that pops out of something and waits to be picked up.
export function dropDiamond(G, from, { stage = 0, mine = false } = {}) {
  const to = dropSpot(G, from);
  G.addPickup({
    model: items.diamond(), pos: to, radius: 1.0, float: 0.45,
    onCollect: () => {
      addDiamonds(G.state, 1);
      if (mine) G.state.mineDiamonds++;
      sfx.diamond();
      G.toast(`💎 다이아몬드! (${G.state.diamonds})`, 1200);
    },
  });
}

// Ore rock: two bonks and it gives up its diamonds (GDD: 채굴). Regrows.
export function createOre(G, x, z, { y, color = '#7fe3ff', yieldN = 1, stage = 0, mine = false, onMined, regrow = 90 } = {}) {
  const model = items.oreRock(color);
  const gy = y ?? heightAt(x, z);
  model.position.set(x, gy, z);
  model.rotation.y = Math.random() * 6;
  G.scene.add(model);
  G.look.shadows(model);
  const gems = model.getObjectByName('gems');
  const body = G.physics.addCuboid(x, gy + 0.35, z, 0.5, 0.35, 0.5);
  let hits = 0, empty = false;
  const ore = {
    pos: v(x, gy, z),
    get ready() { return !empty; },
  };
  G.addHittable({
    radius: 0.7, pos: () => v(x, gy + 0.5, z),
    onHit() {
      if (empty) { sfx.bonk(); return; }
      hits++;
      sfx.clink();
      model.position.x = x + 0.05;
      setTimeout(() => { model.position.x = x; }, 80);
      if (hits >= 2) {
        empty = true; hits = 0;
        gems.visible = false;
        let n = yieldN + (G.state.upgrades.bone && Math.random() < 0.5 ? 1 : 0);
        for (let i = 0; i < n; i++) dropDiamond(G, ore.pos, { stage, mine });
        onMined?.(ore);
        G.emit('mined', ore);
        if (regrow) setTimeout(() => { empty = false; gems.visible = true; }, regrow * 1000);
      }
    },
  });
  ore.body = body;
  return ore;
}

// GDD §8.3: three hidden dog treats per stage. Hidden until sniffed or close.
export function createTreat(G, stage, id, x, z, y, { visible = false } = {}) {
  const p = G.addPickup({
    id: `treat-${id}`, model: items.treat(), pos: v(x, y ?? heightAt(x, z), z), hidden: !visible, float: 0.35,
    onCollect: () => G.giveTreat(stage, id),
  });
  if (p) G.onUpdate(() => {
    if (p.alive && p.hidden && G.player.position.distanceTo(p.model.position) < 3) p.hidden = false;
  });
}

export function createPotion(G, id, x, z, y) {
  G.addPickup({
    id: `potion-${id}`, model: items.potion(), pos: v(x, y ?? heightAt(x, z), z), float: 0.2,
    onCollect: () => {
      if (G.state.potions < maxPotions(G.state)) { G.state.potions++; sfx.pickup(); G.toast(`🧪 하트 포션을 챙겼어요! (${G.touch ? '🧪 버튼' : '4번'}을 누르면 마셔요)`); } else { heal(G.state, 1); sfx.heal(); G.toast('가방이 꽉 차서 바로 마셨어요'); }
    },
  });
}

// Food: heals one heart on touch (and comes back later).
export function createSnack(G, x, z, y) {
  const spawn = () => G.addPickup({
    model: items.heartSnack(), pos: v(x, y ?? heightAt(x, z), z), float: 0.5, name: '하트 간식',
    onCollect: () => { heal(G.state, 1); sfx.heal(); G.toast('❤️ 냠냠! 하트 회복'); setTimeout(spawn, 60000); },
  });
  spawn();
}

// The stage's treasure chest (2nd star).
export function createChest(G, stage, x, z, { ry = 0, diamonds = 5 } = {}) {
  const obj = place(G, 'chest', x, z, { ry });
  const pos = v(x, obj.position.y, z);
  G.mark(`chest${stage}`, pos);
  const it = G.addInteractable({
    pos, radius: 1.8, label: '보물 상자 열기',
    enabled: () => !G.state.treasures[stage],
    action: () => {
      G.state.treasures[stage] = true;
      sfx.item();
      obj.rotation.x = -0.15;
      addDiamonds(G.state, diamonds); // straight into the bag: a reload can't lose them
      for (let i = 0; i < diamonds; i++) setTimeout(() => sfx.diamond(), i * 120);
      G.toast(`✨ 숨겨진 보물 발견! 다이아몬드 ${diamonds}개`);
      G.refresh();
    },
  });
  if (G.state.treasures[stage]) obj.rotation.x = -0.15;
  return it;
}

export function createHideBush(G, x, z) {
  const b = items.hideBush();
  b.position.copy(groundPos(x, z));
  b.rotation.y = Math.random() * 6;
  G.scene.add(b);
  G.look.shadows(b);
  G.addHideSpot(b.position, 1.3);
  return b;
}

// A key item lying in the world with a sparkle over it.
export function createItemPickup(G, { id, model, x, z, y, onCollect, float = 0.5 }) {
  const mk = items.sparkle();
  const pos = v(x, y ?? heightAt(x, z), z);
  const p = G.addPickup({
    id, model, pos, float, radius: 1.1,
    onCollect: (pk) => { G.scene.remove(mk); onCollect(pk); },
  });
  if (p) {
    p.onRemove = () => G.scene.remove(mk);
    G.scene.add(mk);
    G.onUpdate(() => { if (p.alive) { mk.position.copy(p.model.position).setY(p.model.position.y + 0.8); mk.rotation.y += 0.05; } });
  }
  return p;
}

// GDD §11.1 "작은 틈 통과하기": a gap only a small dog fits through. Yorkie
// squeezes from one side to the other.
export function createSqueezeGap(G, { outside, inside, label = '작은 틈으로 쏙 들어가기', backLabel = '틈으로 쏙 나가기' }) {
  const squeeze = async (to) => {
    G.beginCutscene();
    G.player.act('roll');
    sfx.roll();
    await new Promise((r) => setTimeout(r, 350));
    G.player.teleport(to);
    G.endCutscene();
    G.toast('쏙! 강아지라서 지나갈 수 있었어요', 1500);
  };
  G.addInteractable({ pos: outside, radius: 1.6, label, action: () => squeeze(inside) });
  G.addInteractable({ pos: inside, radius: 1.6, label: backLabel, action: () => squeeze(outside) });
}
