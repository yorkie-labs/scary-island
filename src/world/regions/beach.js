import * as THREE from 'three';
import { heightAt, GATES, pathAt } from '../map.js';
import { place } from '../models.js';
import * as items from '../items.js';
import { createOre, createTreat, createPotion, createSnack, createChest, createHideBush, createItemPickup, groundPos, dropSpot } from '../interactables.js';
import { createRocky } from '../../entities/rocky.js';
import { sfx } from '../../audio/sound.js';

// STAGE 1 — LOST BEACH (GDD §5). Wake on the sand by the wreck, find the
// hammer, mine diamonds, wake the rock monsters, get away, take the engine
// part from the wreck and open the stone door to the camp.

export const BEACH_MODELS = ['palm', 'palmSapling', 'fern', 'coastalBoulder', 'smallRock', 'driftwood', 'wreck', 'seaStack',
  'beachGrass', 'chest', 'barrel', 'crate', 'ropeCoil', 'anchor', 'rowboat', 'shells', 'crab', 'signpost', 'sandcastle', 'torch'];

export const BEACH_SPAWN = { x: -3, z: 90, heading: Math.PI };

export function buildBeach(G) {
  const S = G.state;
  const flag = (n) => G.flag(n);

  // --- the wreck Yorkie arrived in
  place(G, 'wreck', 9, 95, { ry: 0.9 });
  place(G, 'rowboat', 16, 96, { ry: 2.2, y: -0.15 });
  place(G, 'anchor', 3, 96, { ry: 1.2, lift: -0.2 });
  place(G, 'barrel', 5, 92);
  place(G, 'barrel', 17, 86);
  place(G, 'crate', 6, 90.5, { ry: 0.4 });
  place(G, 'ropeCoil', 11, 98.5);
  place(G, 'driftwood', -6, 91, { ry: 0.6 });
  place(G, 'driftwood', 20, 92, { ry: 2.0 });
  G.mark('wreck', groundPos(9, 93));

  // --- palms and greenery, kept off the road
  const palms = [[-18, 92], [-24, 84], [-12, 80], [22, 84], [27, 76], [-28, 70], [-20, 62], [24, 63], [-6, 70], [12, 78], [-34, 78], [30, 90], [-40, 66], [-50, 70]];
  for (const [x, z] of palms) place(G, 'palm', x, z, { ry: x * 1.3 });
  for (const [x, z] of [[-15, 88], [18, 88], [-9, 76], [8, 70], [-30, 74], [26, 70]]) place(G, 'palmSapling', x, z, { ry: z });
  for (const [x, z] of [[-14, 85], [15, 80], [-22, 74], [20, 70], [-4, 62], [10, 60], [-26, 64]]) place(G, 'fern', x, z, { ry: x });
  for (let i = 0; i < 26; i++) {
    const x = -32 + ((i * 37) % 64), z = 60 + ((i * 53) % 38);
    if (pathAt(x, z) < 0.2 && heightAt(x, z) > 0.6) place(G, 'beachGrass', x, z, { ry: i });
  }
  for (const [x, z] of [[2, 86], [-12, 90], [12, 87]]) place(G, 'shells', x, z, { ry: x });
  place(G, 'sandcastle', -10, 93, { ry: 0.3 });
  const crab = place(G, 'crab', -4, 95, { ry: 1 });
  G.onUpdate(() => { crab.position.x = -6 + Math.sin(G.time * 0.7) * 2.5; crab.rotation.y = Math.cos(G.time * 0.7) > 0 ? Math.PI / 2 : -Math.PI / 2; });
  place(G, 'seaStack', 30, 104, { ry: 0.5 });
  place(G, 'seaStack', -30, 98, { ry: 1.5 });
  place(G, 'signpost', 3, 82, { ry: 0.3 });

  // ordinary rocks (Rocky hides among them)
  for (const [x, z, r] of [[-15, 69, 0.3], [13, 64, 2], [-8, 60, 1], [20, 58, 0.5], [-22, 58, 2.5], [6, 58, 1.2]]) place(G, 'coastalBoulder', x, z, { ry: r });
  for (const [x, z] of [[-11, 66], [9, 62], [17, 67], [-3, 66], [-18, 64], [3, 70]]) place(G, 'smallRock', x, z, { ry: x });

  // --- hammer, washed ashore by the driftwood
  if (!S.items.hammer) {
    G.mark('hammer', groundPos(-7, 88));
    createItemPickup(G, {
      id: 'hammer', model: items.hammerPickup(), x: -7, z: 88, float: 0.3,
      onCollect: async () => {
        S.items.hammer = true;
        sfx.item();
        G.refresh();
        await G.say([
          { name: 'Yorkie', text: '내 망치다! 파도에 떠밀려 왔나 봐.' },
          { name: '도움말', text: G.hint('hammer') },
        ]);
      },
    });
  }

  // --- ore rocks: mining wakes the rocks nearby (GDD 2.1 "쿵! 쿵! 쿵!")
  const ores = [[-12, 72], [-5, 75], [10, 73], [15, 68], [-17, 77]];
  ores.forEach(([x, z], i) => createOre(G, x, z, { stage: 1, regrow: 60, onMined: () => onFirstMine() }));
  G.mark('beachOre', groundPos(-5, 75));

  const rockies = [
    createRocky(G, { x: -9, z: 69, ry: 0.5, id: 'rocky-1' }),
    createRocky(G, { x: 12, z: 66, ry: -0.6, id: 'rocky-2' }),
    createRocky(G, { x: 2, z: 64, ry: 3.0, id: 'rocky-3', scale: 1.2 }),
  ];
  let woken = false;
  async function onFirstMine() {
    if (woken || flag('rockyWoke')) return;
    woken = true;
    // the rocks stir: three thumps, then they get up
    for (let i = 0; i < 3; i++) setTimeout(() => sfx.stomp(), i * 350);
    setTimeout(async () => {
      for (const r of rockies) G.toHost(r, 'wake');
      G.cam?.shake?.(0.4);
      await G.say([
        { name: 'Yorkie', text: '쿵! 쿵! 쿵!… 어, 저 돌들이 움직여?!' },
        { name: '도움말', text: G.hint('flee') },
      ]);
    }, 1100);
  }

  // --- hide bushes
  for (const [x, z] of [[-14, 63], [16, 61], [-2, 58], [22, 73], [-22, 80], [6, 80]]) createHideBush(G, x, z);

  // --- engine part, washed ashore in a slatted crate right by the wreck: you
  // can see it between the slats; three bonks knock the slats off and the
  // last one bursts the crate, popping the part out toward Yorkie
  if (!S.parts.engine) {
    const ex = 12.6, ez = 91.4;
    const crate = new THREE.Group();
    crate.position.copy(groundPos(ex, ez));
    crate.rotation.y = 0.9; // squared up with the hull
    const wood = ['#9a6a3e', '#8a5a34', '#a8784a'];
    // the frame
    for (const [x, z] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) crate.add(items.part(new THREE.BoxGeometry(0.12, 1.1, 0.12), '#6e4628', { x, y: 0.55, z }));
    crate.add(items.part(new THREE.BoxGeometry(1.2, 0.08, 1.2), '#7a4e2c', { y: 0.04 }));
    // the engine inside, seen through the gaps
    const inside = items.enginePart();
    inside.position.y = 0.12;
    crate.add(inside);
    // slats on all four sides: each bonk knocks one row off
    const rows = [];
    for (let r = 0; r < 3; r++) {
      const row = new THREE.Group();
      for (const [x, z, ry] of [[0, 0.56, 0], [0, -0.56, 0], [0.56, 0, Math.PI / 2], [-0.56, 0, Math.PI / 2]]) {
        row.add(items.part(new THREE.BoxGeometry(1.1, 0.22, 0.05), wood[(r + Math.round(x + z) + 3) % 3], { x, y: 0.22 + r * 0.33, z, ry }));
      }
      crate.add(row);
      rows.push(row);
    }
    G.scene.add(crate);
    G.look.shadows(crate);
    const crateBody = G.physics.addCuboid(ex, crate.position.y + 0.55, ez, 0.6, 0.55, 0.6, 0.9);
    G.mark('engine', groundPos(ex, ez));
    let left = 3;
    const flying = [];
    G.onUpdate((dt) => {
      for (const f of flying) {
        f.t += dt;
        f.mesh.position.addScaledVector(f.v, dt);
        f.v.y -= 9 * dt;
        f.mesh.rotation.x += f.spin * dt;
        if (f.t > 1.2) { f.mesh.visible = false; }
      }
    });
    // a friend got the engine first: the crate is gone here too
    G.on('shared', ({ field, key }) => {
      if (field !== 'taken' || key !== 'engine' || left <= 0) return;
      left = 0; crate.visible = false; G.physics.remove(crateBody);
    });
    G.addHittable({
      radius: 0.85, pos: () => groundPos(ex, ez, 0.5), enabled: () => left > 0,
      onHit() {
        sfx.bonk();
        left--;
        // shake, and the top remaining row of slats flies off
        crate.position.x = ex + 0.06; setTimeout(() => { crate.position.x = ex; }, 90);
        const row = rows[left];
        for (const slat of [...row.children]) {
          const wp = slat.getWorldPosition(new THREE.Vector3());
          const out = wp.clone().sub(crate.position).setY(0).normalize();
          slat.removeFromParent();
          slat.position.copy(wp);
          slat.rotation.y = crate.rotation.y;
          G.scene.add(slat);
          flying.push({ mesh: slat, v: out.multiplyScalar(2.5).setY(3), spin: (Math.random() - 0.5) * 12, t: 0 });
        }
        if (left > 0) { G.toast(left === 2 ? '쾅! 상자 판자가 떨어졌어요. 안에 뭔가 보여요!' : '한 번 더!', 1400); return; }
        // burst: the frame falls apart, the part pops out toward Yorkie
        G.physics.remove(crateBody);
        sfx.clink(); G.cam.shake?.(0.25);
        crate.visible = false;
        const spot = dropSpot(G, crate.position);
        createItemPickup(G, {
          id: 'engine', model: items.enginePart(), x: spot.x, z: spot.z, float: 0.25,
          onCollect: async () => {
            S.parts.engine = true; sfx.item(); G.refresh();
            await G.say([{ name: 'Yorkie', text: '엔진 부품이다! 나중에 배를 고칠 때 꼭 필요하겠어.' }]);
          },
        });
      },
    });
  }

  // --- collectibles
  // the first treat lies in plain sight by the hammer: Yorkie learns to roll early
  createTreat(G, 1, 'beach-a', -11, 82, undefined, { visible: true });
  createTreat(G, 1, 'beach-b', -27, 66);
  createTreat(G, 1, 'beach-c', 18, 56);
  createPotion(G, 'beach', -16, 90);
  createSnack(G, 4, 72);
  createSnack(G, -20, 70);
  createChest(G, 1, -33, 93, { ry: 0.8 });

  // --- triggers
  G.addTrigger({ pos: G.markers.wreck, radius: 5, enabled: () => flag('awake') && !flag('explored'), onEnter: async () => {
    G.setFlag('explored');
    await G.say([
      { name: 'Yorkie', text: '내 배가… 완전히 부서졌어.' },
      { name: 'Yorkie', text: '이걸 고치려면 부품이 잔뜩 필요하겠는걸. 배 옆 나무 상자 틈으로 엔진이 보이는데… 망치가 있으면 부술 수 있을 텐데!' },
    ]);
  } });

  buildStoneDoor(G);
}

// The stone door between the beach and the camp. Three diamond sockets.
function buildStoneDoor(G) {
  const g = GATES.stoneDoor;
  const y = heightAt(g.x, g.z);
  const door = new THREE.Group();
  door.position.set(g.x, y, g.z);
  const stone = '#9a948c';
  const pillarL = items.part(new THREE.BoxGeometry(1.4, 5.2, 1.6), stone, { x: -3.2, y: 2.6 });
  const pillarR = items.part(new THREE.BoxGeometry(1.4, 5.2, 1.6), stone, { x: 3.2, y: 2.6 });
  const lintel = items.part(new THREE.BoxGeometry(8, 1.1, 1.8), '#8a847c', { y: 5.4 });
  const slab = new THREE.Group();
  slab.add(items.part(new THREE.BoxGeometry(5.0, 4.7, 0.7), '#a9a39a', { y: 2.35 }));
  // a carved face, friendly and a bit spooky
  slab.add(items.part(new THREE.CircleGeometry(0.42, 6), '#6d675f', { x: -1.1, y: 3.4, z: 0.36 }));
  slab.add(items.part(new THREE.CircleGeometry(0.42, 6), '#6d675f', { x: 1.1, y: 3.4, z: 0.36 }));
  slab.add(items.part(new THREE.BoxGeometry(1.6, 0.25, 0.05), '#6d675f', { y: 2.5, z: 0.36 }));
  const sockets = [];
  for (let i = 0; i < 3; i++) {
    const sock = items.part(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 6), '#4d4842', { x: (i - 1) * 1.1, y: 1.3, z: 0.38, rx: Math.PI / 2 });
    slab.add(sock);
    const gem = items.diamond(0.2);
    gem.position.set((i - 1) * 1.1, 1.3, 0.5);
    gem.visible = false;
    slab.add(gem);
    sockets.push(gem);
  }
  door.add(pillarL, pillarR, lintel, slab);
  G.scene.add(door);
  G.look.shadows(door);
  G.physics.addCuboid(g.x - 3.2, y + 2.6, g.z, 0.7, 2.6, 0.8);
  G.physics.addCuboid(g.x + 3.2, y + 2.6, g.z, 0.7, 2.6, 0.8);
  let slabBody = null;
  const pos = new THREE.Vector3(g.x, y, g.z + 1.4);
  G.mark('stoneDoor', pos);

  const open = (instant) => {
    sockets.forEach((s) => { s.visible = true; });
    if (slabBody) { G.physics.remove(slabBody); slabBody = null; }
    if (instant) { slab.position.y = -4.6; return; }
    sfx.grind();
    G.cam?.shake?.(0.3);
    let t = 0;
    G.onUpdate((dt) => { if (t < 1) { t = Math.min(1, t + dt / 2.2); slab.position.y = -4.6 * t; slab.position.x = Math.sin(t * 40) * 0.03; } });
  };

  if (G.flag('doorOpen')) open(true);
  else slabBody = G.physics.addCuboid(g.x, y + 2.35, g.z, 2.5, 2.35, 0.35);

  G.on('shared', ({ key }) => { if (key === 'doorOpen') open(true); }); // a friend opened it

  G.addInteractable({
    pos, radius: 3, enabled: () => !G.flag('doorOpen'),
    label: () => (G.state.diamonds >= 3 ? '다이아몬드 3개 끼우기' : `돌문: 다이아몬드가 3개 필요해요 (${G.state.diamonds}/3)`),
    action: async () => {
      if (G.state.diamonds < 3) {
        await G.say([{ name: 'Yorkie', text: '구멍이 세 개 있어… 다이아몬드를 끼우면 열릴 것 같아!' }]);
        return;
      }
      // pay and open in the same moment (saved together), then animate
      G.state.diamonds -= 3;
      G.setFlag('doorOpen');
      for (let i = 0; i < 3; i++) setTimeout(() => { sockets[i].visible = true; sfx.diamond(); }, i * 300);
      setTimeout(() => { open(false); G.toast('돌문이 열렸어요!'); }, 1100);
    },
  });
}
