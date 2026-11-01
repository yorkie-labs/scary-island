import '@fontsource/jua'; // the Jua font, bundled: no third-party font server for a kids' game
import * as THREE from 'three';
import { stage } from './vendor/polyfork/stage.mjs';
import { createPhysics } from './physics/physics.js';
import { createIslandMesh, createSea } from './world/island.js';
import { heightAt, regionAt } from './world/map.js';
import { loadModels } from './world/models.js';
import { newState, load, clearSave, save, heal, BASE_HEARTS } from './core/state.js';
import { currentObjective } from './core/quests.js';
import { createGame } from './core/game.js';
import { createHud } from './ui/hud.js';
import { createScreens, stageClearCard } from './ui/screens.js';
import { createInput } from './input.js';
import { createPlayer } from './player/player.js';
import { initAudio, resumeAudio, setMusic, sfx } from './audio/sound.js';
import { setupTouch } from './ui/touch.js';
import { REGION_BUILDERS, ALL_MODELS, BEACH_SPAWN, REGION_TIME } from './world/regions/index.js';
import { playIntro } from './story.js';
import { setupFlashlight } from './systems/flashlight.js';
import { buildRidgeWalls, decorateRidges } from './world/walls.js';
import { createIsoCamera } from './player/isoCamera.js';
import { createPointer } from './systems/pointer.js';
import { createNav } from './systems/nav.js';
import { setupLabels } from './ui/labels.js';
import { addSilhouette } from './entities/silhouette.js';
import { createLobbyUI, ensureProfile } from './ui/lobby.js';
import { joinGame } from './net/game.js';
import { isGameId, sharedOf, gameStateFor } from './net/share.js';
import { setupCoop } from './systems/coop.js';

const $ = (id) => document.getElementById(id);

async function boot() {
  // no 3D in this browser: say so kindly instead of failing with an error
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) {
    $('loading-text').textContent = '이 브라우저나 기기에서는 3D 그림을 그릴 수 없어요. 다른 브라우저(크롬, 사파리, 엣지)로 열어 주세요.';
    return;
  }
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  $('app').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 600);
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  const look = stage(renderer, scene, { time: 'golden', shadowSpan: 50, far: 300 });

  const physics = await createPhysics();
  const island = createIslandMesh();
  scene.add(island);
  physics.addStatic(island, { friction: 1 });
  const sea = createSea();
  scene.add(sea);

  const saved = load();
  const state = saved ?? newState();

  // playing together (Diablo II style): the lobby reloads the page on
  // ?game=<id>, and the game is joined before the island is built, so the
  // island is built the way the game has it (net/share.js gameStateFor)
  const JOIN = 'scary-island-join';
  const urlGame = new URLSearchParams(location.search).get('game');
  const gameHere = isGameId(urlGame) ? urlGame : null;
  let joinIntent = null;
  try { joinIntent = JSON.parse(sessionStorage.getItem(JOIN)); sessionStorage.removeItem(JOIN); } catch { /* none */ }
  const joining = gameHere && joinIntent ? joinGame({
    id: gameHere, create: !!joinIntent.create, secret: !!joinIntent.secret,
    profile: ensureProfile(state), stage: currentObjective(state)?.stage.id ?? 5, shared: sharedOf(state),
  }) : null;
  if (joining) $('loading-text').textContent = '친구들과 연결하는 중…';
  joining?.catch(() => {}); // looked at below, once the models are in
  const hud = createHud();
  const input = createInput();
  const G = createGame({ scene, camera, renderer, look, physics, state, input, hud });
  // the ground under a point: the island's height field, or the cave floor
  // (y = 0) in the mine, which lies far off the island at x > 400
  G.groundAt = (x, z) => (x > 400 ? 0 : heightAt(x, z));
  G.groundMeshes = [island]; // what a click on "the ground" may land on

  await loadModels(ALL_MODELS, (d, n) => { $('loading-text').textContent = `섬을 불러오는 중… ${d}/${n}`; });

  // starting over: wipe the save and reload, with saving switched off so the
  // save-on-close below does not write the old game straight back; the new
  // page then goes straight into the new game (no second title screen)
  const AUTOSTART = 'scary-island-autostart';
  let wiping = false;
  const startOver = () => {
    wiping = true; clearSave();
    try { sessionStorage.setItem(AUTOSTART, '1'); } catch { /* private mode: the title shows */ }
    location.reload();
  };
  const screens = createScreens(G, { onRestart: startOver });
  G.clearStage = (id) => stageClearCard(G, id);

  let net = null, own = null, joinError = null;
  if (joining) {
    try {
      net = await joining;
      own = structuredClone(state); // my own adventure, kept for my save
      Object.assign(state, gameStateFor(own, net.shared(), newState()));
    } catch (err) {
      console.error(err);
      joinError = { full: '게임이 꽉 찼어요 (10명). 다른 게임을 골라 봐요!', missing: '그 게임은 끝났거나 없어요. 코드를 확인해 주세요.', taken: '앗, 다시 한 번 눌러 주세요.' }[err.code]
        ?? '섬 밖과 연결할 수 없어요. 인터넷을 확인해 주세요.';
    }
  }

  // spawn: the last checkpoint, else the beach
  const cp = state.checkpoint;
  const spawn = cp ? { x: cp.x, y: cp.y, z: cp.z, heading: Math.PI } : { ...BEACH_SPAWN, y: heightAt(BEACH_SPAWN.x, BEACH_SPAWN.z) };
  G.player = createPlayer(G, spawn);
  look.shadows(G.player.model);
  look.follow(G.player.model);
  // one control scheme: the Diablo-style top-down view, all by mouse plus the
  // number keys (the third-person camera and WASD were removed to keep it simple)
  const iso = createIsoCamera(G);
  G.cam = iso;
  G.pointer = createPointer(G);
  G.useLight = () => useLight(G); // the right click

  buildRidgeWalls(G);
  decorateRidges(G);
  for (const build of REGION_BUILDERS) build(G, { openShop: screens.openShop, clearStage: G.clearStage });
  if (!state.checkpoint) G.checkpoint(new THREE.Vector3(spawn.x, spawn.y, spawn.z), 'beach');
  const home = () => { location.href = location.pathname; };
  if (net) {
    G.coop = setupCoop(G, net, own, {
      onEnd: async (reason) => {
        save(state);
        await hud.card(`<h2>${reason === 'full' ? '게임이 꽉 찼어요' : '게임이 끝났어요'}</h2><p>${reason === 'full' ? '다른 게임을 골라 봐요!' : '방장이 게임을 닫았어요. 다음에 또 같이 놀아요!'}</p>`, 3200);
        home();
      },
    });
    // like Diablo II's town: friends gather at the camp once the game has it
    if (G.flag('campReached')) {
      const at = G.markers.camp.clone().add(new THREE.Vector3(2.5, 0, 2.5));
      G.player.teleport(at);
      G.checkpoint(at, 'camp');
    }
  }

  G.nav = createNav(G);
  // silhouettes through scenery in the top-down view: Yorkie in sky blue, a
  // monster that is chasing in red
  const heroGhost = addSilhouette(G.player.model, '#7fe3ff');
  const monsterGhosts = G.enemies.filter((e) => e.model).map((e) => [e, addSilhouette(e.model, '#ff5d6d')]);
  setupLabels(G);
  setupFlashlight(G);
  bindKeys(G, screens);
  hud.onKey = (code) => input.trigger(code);
  setupTouch(G);

  // title screen: the illustration gives way to the real island, seen from a
  // boat circling slowly offshore
  $('loading-text').textContent = '';
  $('title').classList.add('live');
  if (saved) $('btn-continue').classList.remove('hidden');
  $('btn-new').textContent = saved ? '새로 시작' : '모험 시작!';
  const start = async (fresh) => {
    initAudio(); resumeAudio();
    if (fresh && saved) { startOver(); return; }
    $('title').classList.add('hidden');
    hud.show(true);
    G.refresh();
    G.mode = 'play';
    if (!G.flag('awake')) await playIntro(G);
    G.settle();
    iso.snap(G.player.position);
    if (G.caveUpper) G.caveUpper.visible = false;
  };
  $('btn-new').onclick = () => start(true);
  $('btn-continue').onclick = () => start(false);

  const titleButtons = (on) => $('title-buttons').classList.toggle('hidden', !on);
  const lobby = createLobbyUI(G, {
    onEnter: (id, opts) => {
      try { sessionStorage.setItem(JOIN, JSON.stringify(opts)); } catch { /* private mode: the link page asks again */ }
      location.href = `${location.pathname}?game=${id}`;
      return new Promise(() => {}); // the page is going away
    },
    onBack: () => { titleButtons(true); if (gameHere) history.replaceState(null, '', location.pathname); },
  });
  $('btn-coop').onclick = () => { initAudio(); resumeAudio(); titleButtons(false); lobby.open(); };
  if (net) {
    screens.onLeave = async () => { save(state); await net.leave(); home(); };
    screens.onCloseGame = async () => { save(state); await net.close(); home(); };
    titleButtons(false);
    // straight in from the lobby; sound wakes with the first click
    const wake = () => { resumeAudio(); removeEventListener('pointerdown', wake); removeEventListener('keydown', wake); };
    addEventListener('pointerdown', wake); addEventListener('keydown', wake);
    start(false);
  } else if (gameHere) {
    titleButtons(false);
    lobby.open({ id: joinIntent?.create ? null : gameHere, text: joinError ?? '친구의 게임 코드예요. 들어가기를 눌러요!' });
  }
  let autostart = false;
  try { autostart = sessionStorage.getItem(AUTOSTART) === '1'; sessionStorage.removeItem(AUTOSTART); } catch { /* ignore */ }
  if (autostart && !saved) {
    // no click on this page yet: the sound wakes up with the first one
    const wake = () => { resumeAudio(); removeEventListener('pointerdown', wake); removeEventListener('keydown', wake); };
    addEventListener('pointerdown', wake); addEventListener('keydown', wake);
    start(false);
  }

  // main loop
  const clock = new THREE.Clock();
  let musicTimer = 0;
  let dayTime = REGION_TIME[regionAt(spawn.x, spawn.z)] ?? 0.3;
  look.setTime(dayTime);
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (G.running()) {
      physics.step(dt, (step) => { if (G.mode === 'play') G.player.fixedUpdate(G.pointer.moveInput(input.move), G.cam.yaw, step); });
      physics.recoverDynamics(-3);
      G.player.update(dt);
      G.update(dt);
      G.pointer.update(dt);
      state.playTime += dt;
    }
    G.coop?.update(dt);
    sea.userData.tick(G.time);
    if (G.mode === 'title') titleOrbit(camera, clock.elapsedTime);
    else G.cam.update(G.player.position, dt, G.player.body);
    const iso = G.mode !== 'title';
    heroGhost.visible = iso && G.player.model.visible && !G.riding?.(); // the cart's sides hiding the legs is fine
    for (const [e, ghost] of monsterGhosts) ghost.visible = iso && !!e.active;
    look.update();
    renderer.render(scene, camera);

    // HUD minimap and music mood, a few times a second
    musicTimer -= dt;
    if (musicTimer <= 0 && G.mode !== 'title') {
      musicTimer = 0.1;
      hud.tick({ battery: G.battery ?? 0, hasLight: state.items.flashlight });
      hud.automap({
        show: G.showMap && G.mode !== 'title' && G.mode !== 'menu', player: G.player.position, heading: G.player.state.heading,
        target: currentObjective(state)?.step.at ? G.markers[currentObjective(state).step.at] : null,
        rotation: G.cam.yaw, underground: G.underground?.() ?? false, cave: G.cave,
        checkpoint: state.checkpoint,
        gates: { stoneDoor: G.flag('doorOpen'), vines: G.flag('vinesCut'), mineDoor: G.flag('mineDoorOpen'), villageDoor: G.flag('villageDoorOpen'), sealBarrier: G.flag('sealReleased') },
      });
      const p = G.player.position;
      const obj = currentObjective(state);
      const target = obj?.step.at ? G.markers[obj.step.at] : null;
      const underground = G.underground?.() ?? false;
      hud.minimap({ player: p, heading: G.player.state.heading, target, region: regionAt(p.x, p.z), underground, rotation: G.cam.yaw,
        enemies: G.enemies.filter((e) => e.active).map((e) => e.pos), friends: G.friends?.dots() ?? [] });
      const chasing = G.enemies.some((e) => e.active && e.chasing !== false && e.pos.distanceTo(p) < 14);
      // each region has its own light; drift toward it
      const want = G.timeOverride ?? (underground ? REGION_TIME.mine : REGION_TIME[regionAt(p.x, p.z)]) ?? 0.3;
      if (Math.abs(want - dayTime) > 0.004) { dayTime += Math.sign(want - dayTime) * Math.min(Math.abs(want - dayTime), 0.012); look.setTime(dayTime); }
      setMusic(G.musicOverride ?? (chasing ? 'chase' : underground ? 'cave' : regionAt(p.x, p.z) === 'camp' ? 'calm' : 'explore'));
    }
  });

  // autosave every 20 s
  setInterval(() => { if (G.mode === 'play' && !wiping) save(state); }, 20000);
  // and when the tab is hidden or closed, so a child never loses progress
  // (only once a game is under way: the title screen has nothing new to keep)
  const saveNow = () => { if (!wiping && G.mode !== 'title') save(state); };
  addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
  window.G = G; // for debugging and automated checks
}

function bindKeys(G, screens) {
  const { input, hud } = G;
  const playing = () => G.mode === 'play';
  const advance = (e) => { if (hud.inDialog) { hud.advanceDialog(); if (e) e.usedForDialog = true; return true; } return false; };

  // Kept simple: the mouse does moving, bonking, picking up and the flashlight
  // (see systems/pointer.js); the number keys are Yorkie's dog abilities.
  // Space: the next line of a dialogue, else use whatever is close by (a door,
  // a chest, a device); in the mine cart it is the hop
  input.on('Space', (e) => { if (!advance(e) && playing() && !G.riding?.()) G.interact(); });
  input.on('Enter', (e) => advance(e));
  input.on('KeyB', () => { if (playing()) G.player.act('bark'); });
  input.on('Escape', () => { if (screens.shopOpen) screens.closeShop(); else if (screens.menuOpen) screens.closeMenu(); else screens.openMenu(); });
  input.on('KeyH', () => { if (playing()) screens.openMenu(); });
  input.on('Tab', () => { if (playing() || G.mode === 'dialog') { G.showMap = !G.showMap; sfx.click(); } });
  // the touch buttons' extras (no right click and no Esc on a phone)
  input.on('Light', () => { if (playing()) useLight(G); });
  input.on('Hammer', () => { if (playing()) G.pointer.hammer(); });
  // 1 sniff, 2 roll, 3 jump, 4 potion (like a Diablo hotbar)
  input.on('Digit1', () => { if (playing()) G.player.act('sniff'); });
  input.on('Digit2', () => { if (playing()) G.emit('rollTowardCursor'); });
  input.on('Digit3', () => { if (playing()) G.player.jump(); });
  input.on('Digit4', () => { if (playing()) drinkPotion(G); });
  // a click anywhere advances dialogue
  addEventListener('mousedown', () => { if (hud.inDialog && !screens.menuOpen && !screens.shopOpen) hud.advanceDialog(); });
}

// The title backdrop: a slow circle around the island at golden hour.
function titleOrbit(camera, t) {
  const a = 0.6 + t * 0.03;
  camera.position.set(Math.sin(a) * 150, 48, Math.cos(a) * 150);
  camera.lookAt(0, 4, 0);
}

// The right-hand skill: the flashlight, once Yorkie has it.
export function useLight(G) {
  if (!G.state.items.flashlight) { G.toast('손전등이 아직 없어요'); return; }
  G.emit('faceCursor');
  G.emit('flashlight');
}

function drinkPotion(G) {
  const { state } = G;
  if (state.potions > 0 && state.hearts < BASE_HEARTS) { state.potions--; heal(state, 1); sfx.heal(); G.toast('❤️ 꿀꺽! 하트 회복'); G.refresh(); } else G.toast(state.potions ? '하트가 가득해요' : '포션이 없어요');
}

boot().catch((err) => {
  console.error(err);
  $('loading-text').textContent = `문제가 생겼어요: ${err.message}`;
});
