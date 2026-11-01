import * as THREE from 'three';
import { heightAt } from './world/map.js';
import { sfx } from './audio/sound.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// GDD §2.1, told over a camera flight across the island.
export async function playIntro(G) {
  G.beginCutscene();
  const narrator = '이야기';
  G.cam.fly(v(0, 70, 190), v(0, 5, 0), 0.01);
  await new Promise((r) => setTimeout(r, 50));
  const flight = G.cam.fly(v(-60, 40, 120), v(0, 8, -20), 9);
  await G.say([
    { name: narrator, text: '아주 먼 어느 나라에, 모험을 좋아하는 요크셔테리어 강아지 Yorkie가 살고 있었어요.' },
    { name: narrator, text: '어느 날 Yorkie는 오래된 탐험 지도를 발견했어요. 지도에는 아무도 가 본 적 없는 섬이 그려져 있었지요.' },
    { name: narrator, text: '섬의 이름은 SCARY ISLAND. "세상에서 가장 아름다운 보물이 잠들어 있는 곳."' },
  ], { stop: true });
  await flight;
  sfx.whoosh();
  G.cam.shake(0.6);
  await G.say([
    { name: narrator, text: '작은 배를 타고 섬에 다가가던 순간, 거대한 파도가 몰려왔어요. 쾅! 배는 바위에 부딪혀 부서지고 말았어요.' },
  ], { stop: true });
  await G.hud.fade(true);
  const p = G.player.position;
  G.cam.release();
  G.cam.fly(v(p.x + 3, heightAt(p.x, p.z) + 2.2, p.z + 3.5), v(p.x, p.y + 0.6, p.z), 0.01);
  await new Promise((r) => setTimeout(r, 100));
  await G.hud.fade(false);
  G.player.act('cheer');
  await G.say([
    { name: 'Yorkie', text: '으으… 여긴 어디지? 내 배는…?' },
    { name: '도움말', text: G.hint('move') },
  ], { stop: true });
  G.cam.release();
  G.setFlag('awake');
  G.endCutscene();
}

// GDD §2.3: Yorkie sails away and sighs with relief... but a little pebble left
// on the beach blinks. THE END? Then the credits, as the GDD §14 team table.
export async function playEnding(G, { ship, dir }) {
  G.beginCutscene();
  G.musicOverride = 'calm';
  const pm = G.player.model;
  G.player.state.frozen = true;
  pm.position.copy(ship.position).setY(ship.position.y + 1.9);
  pm.rotation.y = Math.atan2(dir.x, dir.z);
  G.player.act('cheer');
  sfx.fanfare();
  // turn the bow out to sea before sailing (it was moored facing the shore)
  ship.rotation.y = Math.atan2(dir.x, dir.z);
  ship.rotation.z = 0;
  const start = ship.position.clone();
  let sail = 0;
  G.onUpdate((dt) => {
    sail += dt;
    const d = Math.min(1, sail / 14) ** 1.4 * 110;
    ship.position.copy(start).addScaledVector(dir, d);
    pm.position.copy(ship.position).setY(ship.position.y + 1.9);
  });
  G.cam.fly(start.clone().add(new THREE.Vector3(-dir.x * 8 + 6, 6, -dir.z * 8)), start.clone().setY(2), 2);
  await G.say([{ name: 'Yorkie', text: '안녕, 무서운 섬! 다시는 안 올 거야~!' }], { stop: true });
  G.cam.fly(start.clone().add(new THREE.Vector3(-dir.x * 25, 18, -dir.z * 25)), start.clone().addScaledVector(dir, 40), 7);
  await G.say([{ name: '이야기', text: 'Yorkie는 배를 타고 섬을 탈출했어요. 멀어지는 섬을 바라보며 휴, 안도의 한숨을 쉬었지요.' }], { stop: true });
  await new Promise((r) => setTimeout(r, 2500));

  // the beach, one last time: a little pebble opens its eyes
  await G.hud.fade(true);
  const pebble = new THREE.Group();
  const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: '#8e8a84', flatShading: true }));
  stone.scale.y = 0.75;
  pebble.add(stone);
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff3b0', emissiveIntensity: 0.6 }));
    e.position.set(s * 0.07, 0.04, 0.16);
    e.scale.y = 0.05;
    pebble.add(e);
    eyes.push(e);
  }
  const bx = 2, bz = 88;
  pebble.position.set(bx, heightAt(bx, bz) + 0.15, bz);
  G.scene.add(pebble);
  G.timeOverride = 0.6;
  G.cam.fly(new THREE.Vector3(bx, heightAt(bx, bz) + 0.5, bz + 1.4), pebble.position.clone(), 0.01);
  await new Promise((r) => setTimeout(r, 400));
  await G.hud.fade(false);
  await new Promise((r) => setTimeout(r, 1500));
  sfx.rumble();
  for (const blink of [0.15, 1, 0.1, 1]) { eyes.forEach((e) => { e.scale.y = blink; }); await new Promise((r) => setTimeout(r, blink < 0.5 ? 180 : 600)); }
  await G.hud.card('<h2>THE END?</h2>', 3500);
  G.state.cleared[5] = true;
  G.setFlag('escaped');
  showCredits(G);
}

function showCredits(G) {
  const total = [1, 2, 3, 4, 5].reduce((n, id) => n + (G.state.cleared[id] ? 1 : 0) + (G.state.treasures[id] ? 1 : 0) + ((G.state.treats[id]?.length ?? 0) >= 3 && G.state.treasures[id] ? 1 : 0), 0);
  const mins = Math.round(G.state.playTime / 60);
  const el = document.getElementById('menu');
  el.innerHTML = `
    <h2>SCARY ISLAND — Find the Way Out!</h2>
    <p style="font-size:22px">Yorkie가 무사히 섬을 탈출했어요! 🐶⛵</p>
    <p>별 ${total}/15 · 다이아몬드 ${G.state.diamondsTotal}개 · 플레이 시간 ${mins}분</p>
    <div style="line-height:1.9;font-size:17px;max-width:560px">
      <b>Game Director · Story Writer · Monster Designer · Fun & Difficulty</b><br>Jiyu<br>
      <b>Character & Environment · Gameplay Programming</b><br>Hackerwins<br>
      <b>AI Asset Production · Play Testing</b><br>Jiyu & Hackerwins<br>
      <b>3D Assets</b><br>Polyfork (polyfork.dev)
    </div>
    <p style="opacity:.8">An adventure that's cute, spooky, and full of surprises.</p>
    <div class="row"><button id="btn-again">다시 탐험하기</button></div>`;
  el.classList.remove('hidden');
  document.getElementById('btn-again').onclick = () => location.reload();
}
