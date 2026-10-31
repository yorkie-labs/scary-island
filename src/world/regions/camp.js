import * as THREE from 'three';
import { place } from '../models.js';
import { ISO_YAW } from '../../player/isoCamera.js';
import { groundPos, createSnack } from '../interactables.js';
import { heal } from '../../core/state.js';
import { sfx } from '../../audio/sound.js';

// CENTRAL CAMP (GDD §4.2): the hub every region connects to. Campfire =
// checkpoint and full heal; Polly the parrot trades diamonds for upgrades.

export const CAMP_MODELS = ['tent', 'cookTripod', 'firewood', 'leanTo', 'picnicTable', 'parrot', 'trailSign', 'lantern', 'stump', 'campfire', 'barrel', 'crate', 'marketStall'];

// A wooden board with words painted on, drawn with a canvas texture.
function shopSign(title, sub) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 192;
  const g = cv.getContext('2d');
  g.fillStyle = '#7a4e2c'; g.fillRect(0, 0, 512, 192);
  g.fillStyle = '#9c6a3e'; g.fillRect(10, 10, 492, 172);
  g.textAlign = 'center'; g.fillStyle = '#fff3d6';
  g.font = 'bold 64px Jua, sans-serif'; g.fillText(title, 256, 92);
  g.font = '40px Jua, sans-serif'; g.fillStyle = '#ffe08a'; g.fillText(sub, 256, 150);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  board.name = 'shopSign';
  return board;
}

export function buildCamp(G, { openShop, clearStage }) {
  const c = { x: 0, z: 18 };
  place(G, 'campfire', c.x, c.z);
  place(G, 'cookTripod', c.x, c.z, { body: 'none' });
  place(G, 'tent', c.x - 7, c.z + 5, { ry: Math.atan2(c.x + 7, c.z - (c.z + 5)) });
  place(G, 'leanTo', c.x + 6.5, c.z - 4.5, { ry: -0.6 });
  place(G, 'picnicTable', c.x + 5, c.z + 3, { ry: 0.3 });
  place(G, 'firewood', c.x - 3.5, c.z + 2.5, { ry: 1.2 });
  place(G, 'stump', c.x + 2.4, c.z - 2.2);
  place(G, 'stump', c.x - 2.2, c.z - 2.6);
  for (const [x, z] of [[-8, 26], [8, 26], [-10, 10], [10, 10]]) place(G, 'lantern', x, z, { ry: Math.atan2(-x, -(z - 18)) });
  // signposts at each road out of camp
  place(G, 'trailSign', -14, 15, { ry: Math.PI / 2 });
  place(G, 'trailSign', 0, -14, { ry: 0 });
  place(G, 'trailSign', 14, 9, { ry: -Math.PI / 2 });

  // the fire: a warm point light and a flicker
  G.addLight({ pos: groundPos(c.x, c.z, 1), color: '#ffa040', intensity: 8, distance: 14, flicker: 0.12 });

  const firePos = groundPos(c.x, c.z);
  G.mark('camp', firePos);
  G.addInteractable({
    pos: firePos, radius: 2.8, label: '모닥불에서 쉬기 (저장 · 회복)',
    action: () => {
      heal(G.state, 99);
      G.checkpoint(groundPos(c.x, c.z + 2.5), 'camp');
      sfx.heal();
      G.toast('❤️ 몸이 따뜻해졌어요. 저장했어요!');
      G.refresh();
    },
  });

  // Polly the parrot runs a little market stall north-west of the fire, out
  // in the open where the top-down camera sees it, facing the campfire.
  const st = { x: c.x - 6, z: c.z - 4 };
  const facing = Math.atan2(c.x - st.x, c.z - st.z);
  const stall = place(G, 'marketStall', st.x, st.z, { ry: facing });
  stall.userData.noFade = true;
  const front = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
  const perch = place(G, 'crate', st.x + front.x * 0.9, st.z + front.z * 0.9, { ry: facing, body: 'static' });
  const parrot = place(G, 'parrot', perch.position.x, perch.position.z, { y: perch.position.y + 0.8, ry: facing, body: 'none' });
  G.onUpdate(() => {
    parrot.position.y = perch.position.y + 0.8 + Math.abs(Math.sin(G.time * 2)) * 0.06;
    parrot.rotation.y = facing + Math.sin(G.time * 0.8) * 0.4;
  });
  // a painted sign over the stall
  const sign = shopSign('🦜 폴리의 가게', '💎 업그레이드');
  sign.position.set(st.x - front.x * 0.2, stall.position.y + 2.9, st.z - front.z * 0.2);
  sign.rotation.y = ISO_YAW; // turned to the top-down camera so it always reads
  G.scene.add(sign);
  G.addLight({ pos: sign.position.clone().addScaledVector(front, 1), color: '#ffd59a', intensity: 3, distance: 6 });
  const shopPos = groundPos(st.x + front.x * 2.2, st.z + front.z * 2.2);
  G.mark('shop', shopPos);
  G.addInteractable({ pos: shopPos, radius: 2.4, label: '폴리의 가게 (업그레이드)', action: openShop });

  createSnack(G, c.x - 2.5, c.z + 8);

  // arriving at camp clears Stage 1
  G.addTrigger({
    test: (p) => p.z < 42 && p.z > -10 && Math.abs(p.x) < 31, enabled: () => G.flag('doorOpen') && !G.flag('campReached'),
    onEnter: async () => {
      G.setFlag('campReached');
      G.checkpoint(groundPos(c.x, c.z + 2.5), 'camp');
      await clearStage(1);
      await G.say([
        { name: 'Yorkie', text: '휴, 여기는 안전해 보여. 모닥불도 있고… 앵무새도 있네?' },
        { name: '폴리', text: '안녕, 꼬마 강아지! 이 섬에서 나가고 싶으면 배를 고쳐야 해. 부품은 섬 곳곳에 흩어져 있지.' },
        { name: '폴리', text: '서쪽 숲부터 가 봐. 다이아몬드를 모아 오면 내가 좋은 물건도 줄게! 깍!' },
      ]);
    },
  });
}
