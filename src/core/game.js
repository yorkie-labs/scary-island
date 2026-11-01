import * as THREE from 'three';
import { save, damage, heal, addTreat, hasAbility, treatsEaten, ABILITY_TREATS } from './state.js';
import { currentObjective } from './quests.js';
import { sfx } from '../audio/sound.js';
import { sparkle } from '../world/items.js';
import { SEA_LEVEL } from '../world/map.js';

// The shared game context ("G"): registries for everything the player can
// touch, hit, pick up or walk into, plus events, flags and dialogue. Region
// builders fill the registries; the main loop calls G.update.
export function createGame({ scene, camera, renderer, look, physics, state, input, hud }) {
  const listeners = new Map();
  let wasSimulating = true;
  let sayQueue = Promise.resolve();
  let stops = 0; // big moments waiting their turn
  const G = {
    scene, camera, renderer, look, physics, state, input, hud,
    mode: 'title',
    time: 0,
    player: null,
    cam: null,
    markers: {},
    interactables: [],
    pickups: [],
    hittables: [],
    triggers: [],
    hideSpots: [],
    enemies: [],
    updaters: [],
    seaLevel: SEA_LEVEL,

    on(name, fn) { (listeners.get(name) ?? listeners.set(name, []).get(name)).push(fn); },
    emit(name, data) { for (const fn of listeners.get(name) ?? []) fn(data); },

    flag(name) { return !!state.flags[name]; },
    setFlag(name, value = true) {
      if (!!state.flags[name] === value) return;
      state.flags[name] = value;
      G.emit('flag', name);
      G.refresh();
    },
    refresh() {
      save(state);
      hud.update(state, currentObjective(state));
      G.emit('progress');
    },

    mark(name, pos) { G.markers[name] = pos; },
    seaLevelAt() { return G.seaLevel; },

    addInteractable(o) { G.interactables.push({ radius: 1.8, enabled: () => true, ...o }); return o; },
    addHittable(o) { G.hittables.push({ radius: 0.8, ...o }); return o; },
    addTrigger(o) { G.triggers.push({ radius: 3, once: true, inside: false, ...o }); return o; },
    addHideSpot(pos, radius = 1.3) { G.hideSpots.push({ pos, radius }); },

    // Warm glows (fires, lamps, crystals, ghosts). A fixed pool of real lights
    // follows the sources nearest Yorkie, so shaders never recompile.
    lightSources: [],
    addLight({ pos, color = '#ffb062', intensity = 6, distance = 10, flicker = 0 }) {
      const src = { pos, color: new THREE.Color(color), intensity, distance, flicker, on: true };
      G.lightSources.push(src);
      return src;
    },
    addEnemy(e) { e.index = G.enemies.length; G.enemies.push(e); return e; },

    // --- monsters, alone or together. Who they go after: my Yorkie and (playing
    // together) my friends' Yorkies, which have the same shape (systems/coop.js).
    targets() { return G.coop ? [G.player, ...G.coop.targets()] : [G.player]; },
    nearestTarget(pos) {
      let best = G.player, bd = Infinity;
      for (const t of G.targets()) {
        const d = t.position.distanceToSquared(pos);
        if (d < bd) { best = t; bd = d; }
      }
      return best;
    },
    hurtTarget(t, from, amount = 1, opts) {
      if (t === G.player) G.hurtPlayer(from, amount, opts);
      else G.coop?.hurtFriend(t, from, amount);
    },
    // Playing together the island never pauses (like Diablo II): the menu and
    // the shop leave the world running, and a monster can still reach you.
    // Alone, they pause it. Dialogues and cutscenes run the world either way.
    running() { return G.mode === 'play' || G.mode === 'dialog' || G.mode === 'cutscene' || (G.mode === 'menu' && !!G.coop); },
    // my own clocks (a chase timer, a collapse): in play, or in a menu that doesn't pause
    ticking() { return G.mode === 'play' || (G.mode === 'menu' && !!G.coop); },
    // Only one client runs the monsters (the host); the others draw them.
    simulating() { return !G.coop || G.coop.hosting(); },
    // Something done to a monster here (a wake-up, a freeze, a gust): shown at
    // once, and done for real by the host.
    toHost(e, method, ...args) {
      e[method](...args);
      if (!G.simulating()) G.coop.forward(e, method, args);
    },
    // Monsters get tougher with more friends around (Diablo II's /players).
    toughness() { return 1 + 0.2 * (G.coop?.targets().length ?? 0); },
    // A friend's hit, run on the host: no toasts meant for the hitter.
    quiet: 0,
    quietly(fn) { G.quiet++; try { fn(); } finally { G.quiet--; } },
    onUpdate(fn) { G.updaters.push(fn); },

    // A floating collectible. `id` makes it remember being taken.
    addPickup({ id, model, pos, radius = 0.9, hidden = false, onCollect, float = 0.5, name }) {
      if (id && state.collected[id]) return null;
      const p = { id, model, pos: pos.clone(), radius, hidden, onCollect, float, alive: true, t: Math.random() * 6, name: name ?? pickupName(id) };
      model.position.copy(pos).setY(pos.y + float);
      scene.add(model);
      look.shadows(model);
      G.pickups.push(p);
      return p;
    },

    // A friend took it first: it vanishes here without being collected.
    removePickup(id) {
      for (const p of G.pickups) {
        if (p.id !== id || !p.alive) continue;
        p.alive = false;
        scene.remove(p.model);
        if (p.marker) scene.remove(p.marker);
        p.onRemove?.();
      }
    },

    inHideSpot(pos) {
      return G.hideSpots.some((h) => Math.hypot(pos.x - h.pos.x, pos.z - h.pos.z) < h.radius);
    },

    // The hammer lands at `point`: bonk the nearest thing there.
    hammerHit(point) {
      let best = null, bd = Infinity;
      for (const h of G.hittables) {
        if (h.enabled && !h.enabled()) continue;
        const hp = typeof h.pos === 'function' ? h.pos() : h.pos;
        const d = Math.hypot(point.x - hp.x, point.z - hp.z) - h.radius;
        const dy = Math.abs(point.y - hp.y);
        if (d < 0.75 && dy < 2.5 && d < bd) { best = h; bd = d; }
      }
      G.emit('noise', { pos: point.clone(), radius: 9, kind: 'hammer' });
      if (best?.enemy && !G.simulating()) G.coop.forwardHit(best.enemy, point);
      if (best) best.onHit(point, G.player.facing.clone(), G.player.position);
      else sfx.bonk();
      return best;
    },

    hurtPlayer(from, amount = 1, { beam = false } = {}) {
      if (!G.ticking()) return;
      // in the mine cart only the beams can bump Yorkie (monsters can't reach)
      if (G.riding?.() && !beam) return;
      G.player.hurt(from, amount);
    },

    // Talk (Diablo III style): by default lines are said while Yorkie keeps
    // playing (hud.speech). Only the big moments (intro, a boss appearing,
    // the seal, the last chase, the ending) pass { stop: true }, which holds
    // the game in the dialogue box until read. Either way it all queues up in
    // order, and a big moment cuts any chatter before it short.
    say(lines, { stop = false } = {}) {
      // once Yorkie has met Polly at the camp, help lines are hers to explain:
      // kept for "지금 뭘 해야 해?", with a nudge instead of a card
      if (!stop && state.flags.campReached && lines.some((l) => l?.name === '도움말')) {
        for (const l of lines) if (l?.name === '도움말') (G.helpLog ??= []).push(l.text);
        G.helpLog.splice(0, G.helpLog.length - 5);
        lines = lines.filter((l) => l?.name !== '도움말');
        if (G.time - (G.lastPollyNudge ?? -1e9) > 90) { G.lastPollyNudge = G.time; G.toast('🦜 궁금하면 캠프의 폴리에게 물어봐요!', 3200); }
        if (!lines.length) return sayQueue;
      }
      if (stop) { stops++; hud.hush(true); }
      const run = stop
        ? () => new Promise((resolve) => {
          if (--stops === 0) hud.hush(false);
          G.mode = 'dialog';
          input.enabled = false;
          hud.dialog(lines, () => {
            G.settle();
            const help = lines.findLast?.((l) => l?.name === '도움말');
            if (help) hud.tip(help.text); // the boss's how-to stays on screen
            resolve();
          });
        })
        : () => hud.speech(lines);
      sayQueue = sayQueue.then(run, run);
      return sayQueue;
    },
    toast(text, ms) { if (!G.quiet) hud.toast(text, ms); },

    // One place decides the mode after anything ends (a dialogue, a menu, a
    // cutscene): an open dialogue wins, then a running cutscene, then a menu,
    // else play. Nothing restores a remembered mode, so nothing gets stuck.
    cutscenes: 0,
    beginCutscene() { G.cutscenes++; G.settle(); },
    endCutscene() { G.cutscenes = Math.max(0, G.cutscenes - 1); G.settle(); },
    settle() {
      if (G.mode === 'title' || G.mode === 'ending') return;
      G.mode = hud.inDialog ? 'dialog' : G.cutscenes > 0 ? 'cutscene' : G.screens?.menuOpen || G.screens?.shopOpen ? 'menu' : 'play';
      input.enabled = G.mode === 'play';
    },

    // Help text that names the right controls: mouse and keys, or (on a
    // phone or tablet) taps, the joystick and the touch buttons.
    hint(name) {
      const T = !!G.touch;
      const H = {
        move: T ? '땅을 톡 하면 그곳으로 걸어가요. 화면 왼쪽을 누르고 밀면 조이스틱으로도 움직여요. 위쪽 미션과 지도의 ⭐ 표시를 따라가 보세요!'
          : '땅을 클릭하면 그곳으로 걸어가요(꾹 누르면 계속 따라가요). 위쪽 미션과 오른쪽 지도의 ⭐ 표시를 따라가 보세요!',
        hammer: T ? '반짝이는 광석을 톡 하거나, 가까이 가서 🔨 버튼을 누르면 망치로 쳐요. 두 번 치면 다이아몬드가 나와요!'
          : '반짝이는 광석을 클릭하면 다가가서 망치로 쳐요. 두 번 치면 다이아몬드가 나와요!',
        flee: T ? '돌 괴물 Rocky예요! 멀리 도망치거나, 꽃 덤불 속에 숨거나, Rocky를 톡(또는 🔨) 해서 망치로 두 번 쳐 기절시킬 수 있어요.'
          : '돌 괴물 Rocky예요! 멀리 땅을 클릭해서 도망치거나, 꽃 덤불 속에 숨거나, Rocky를 클릭해서 망치로 두 번 쳐 기절시킬 수 있어요.',
        roll: !hasAbility(state, 'roll') ? '빨간 원 밖으로 걸어서 피해요' : T ? '🌀 버튼을 누르면 보고 있는 쪽으로 굴러서 피해요' : '2번을 누르면 마우스 쪽으로 굴러서 피해요',
        scissors: T ? '가위는 가지고만 있으면 돼요. 덩굴을 톡 하면 싹둑 잘라요.' : '가위는 가지고만 있으면 돼요. 덩굴을 클릭하면 싹둑 잘라요.',
        watcher: T ? 'Watcher는 요키가 바라보는 쪽에 있으면 움직이지 못해요. 동상 쪽을 보고 🔦 버튼을 누르면 한동안 꽁꽁 얼어요!'
          : 'Watcher는 요키가 바라보는 쪽에 있으면 움직이지 못해요. 동상을 오른쪽 클릭해서 손전등으로 비추면 한동안 꽁꽁 얼어요!',
        flashlight: T ? '🔦 버튼을 누르면 요키가 보는 쪽으로 손전등을 비춰요. 빛에 닿은 동상은 잠깐 꼼짝 못 해요!'
          : '오른쪽 클릭을 하면 마우스 쪽으로 손전등을 비춰요. 빛에 닿은 동상은 잠깐 꼼짝 못 해요!',
        devices: `섬의 수호자는 요키가 바라보면 느려지고, 손전등(${T ? '🔦' : '오른쪽 클릭'}) 빛을 받으면 멈춰요. 그 사이에 빛나는 크리스털 장치 3개를 ${T ? '톡' : '클릭'}해서 켜세요!`,
        cart: T ? '카트를 톡 해서 타요! 노란 표지판이 깜빡이면 화면을 톡(또는 ⤴) 해서 점프해 들보를 넘어요.'
          : '카트를 클릭해서 타요! 노란 표지판이 깜빡이면 Space나 클릭으로 점프해서 들보를 넘어요.',
      };
      return H[name] ?? '';
    },

    checkpoint(pos, region) {
      const y = pos.x < 400 && G.groundAt ? Math.max(pos.y, G.groundAt(pos.x, pos.z)) : pos.y;
      state.checkpoint = { x: pos.x, y, z: pos.z, region };
      save(state);
    },

    sniff(origin) {
      // GDD §3.2 Sniff: a scent wave rolls out from Yorkie; each collectible
      // (even a hidden treat) and each usable thing it reaches sparkles and
      // shows its name tag for a while.
      sniffRings(origin);
      const now = G.time;
      const targets = [];
      for (const p of G.pickups) {
        const d = p.model.position.distanceTo(origin);
        if (p.alive && d <= SNIFF_RANGE) targets.push({ pickup: p, at: now + (d / SNIFF_RANGE) * SNIFF_TIME });
      }
      for (const it of G.interactables) {
        if (!it.enabled()) continue;
        const ip = typeof it.pos === 'function' ? it.pos() : it.pos;
        const d = ip.distanceTo(origin);
        if (d <= SNIFF_RANGE) targets.push({ it, at: now + (d / SNIFF_RANGE) * SNIFF_TIME });
      }
      G.scent = { targets, until: now + SNIFF_TIME + 7 };
      const found = targets.filter((t) => t.pickup).length;
      setTimeout(() => G.toast(found ? `킁킁… 근처에 ${found}개의 냄새가 나요!` : '킁킁… 근처엔 아무것도 없어요'), SNIFF_TIME * 1000);
    },

    update(dt) {
      G.time += dt;
      const pp = G.player.position;

      // pickups: bob, spin, collect on touch
      for (const p of G.pickups) {
        if (!p.alive) continue;
        p.t += dt;
        p.model.visible = !p.hidden;
        p.model.position.y = p.pos.y + p.float + Math.sin(p.t * 2.5) * 0.08;
        p.model.rotation.y += dt * 1.6;
        // the scent wave reaches it: uncover and sparkle
        const scentHit = G.scent?.targets.find((t) => t.pickup === p);
        if (scentHit && !scentHit.done && G.time >= scentHit.at) { scentHit.done = true; p.hidden = false; p.sniffed = 8; }
        if (p.sniffed > 0) {
          p.sniffed -= dt;
          if (!p.marker) { p.marker = sparkle('#fff27a'); p.marker.scale.setScalar(2); scene.add(p.marker); }
          p.marker.position.copy(p.model.position).setY(p.model.position.y + 0.9 + Math.sin(G.time * 5) * 0.15);
          p.marker.rotation.y += dt * 3;
        } else if (p.marker) { scene.remove(p.marker); p.marker = null; }
        if (G.mode === 'play' && Math.hypot(pp.x - p.model.position.x, pp.z - p.model.position.z) < p.radius
          && Math.abs(pp.y + 0.4 - p.model.position.y) < 2.6) {
          p.alive = false;
          scene.remove(p.model);
          if (p.marker) scene.remove(p.marker);
          if (p.id) state.collected[p.id] = true;
          p.onCollect?.(p);
          G.refresh();
        }
      }
      G.pickups = G.pickups.filter((p) => p.alive);

      // triggers
      for (const t of G.triggers) {
        if (t.done) continue;
        // a disabled trigger counts as "outside", so enabling it while Yorkie
        // stands in it fires straight away
        const on = !t.enabled || t.enabled();
        const inside = on && (t.test ? t.test(pp) : Math.hypot(pp.x - t.pos.x, pp.z - t.pos.z) < t.radius);
        if (inside && !t.inside && G.mode === 'play') {
          t.onEnter?.();
          if (t.once) t.done = true;
        }
        t.inside = inside && G.mode === 'play' ? true : inside && t.inside;
      }

      // nearest interactable shows a prompt
      let near = null, nd = Infinity;
      if (G.mode === 'play') {
        for (const it of G.interactables) {
          if (!it.enabled()) continue;
          const ip = typeof it.pos === 'function' ? it.pos() : it.pos;
          const d = Math.hypot(pp.x - ip.x, pp.z - ip.z);
          if (d < it.radius && d < nd && Math.abs(pp.y - ip.y) < 3) { near = it; nd = d; }
        }
      }
      G.nearInteractable = near;
      if (!G.riding?.()) hud.prompt(near ? `${G.touch ? '✋' : 'Space'} ${typeof near.label === 'function' ? near.label() : near.label}` : null);

      // monsters: the host runs them (and keeps them running through its own
      // dialogues when friends are around); everyone else draws the host's
      const sim = G.simulating();
      if (sim && !wasSimulating) for (const e of G.enemies) e.mover?.teleport(e.pos); // taking over as host
      wasSimulating = sim;
      if (!sim) for (const e of G.enemies) e.puppet(dt);
      else if (G.mode === 'play' || G.coop) for (const e of G.enemies) e.update(dt);
      updateLightPool(dt);
      for (const fn of G.updaters) fn(dt);
    },

    interact() {
      const it = G.nearInteractable;
      if (!it || G.mode !== 'play') return;
      G.player.act('interact');
      it.action();
    },

    // Called on 'hurt' events: lose a heart, maybe faint.
    onHurt(amount) {
      const fainted = damage(state, amount);
      hud.update(state, currentObjective(state));
      if (fainted) G.faint();
    },

    async faint() {
      if (G.screens?.menuOpen) G.screens.closeMenu(); // fainted with the menu open (playing together)
      G.beginCutscene();
      G.emit('faint');
      await hud.fade(true);
      const c = state.checkpoint;
      heal(state, 99);
      if (c) G.player.teleport(c, Math.PI);
      // alone, the island starts over around me; with friends it goes on
      if (!G.coop?.targets().length) for (const e of G.enemies) e.reset?.();
      G.refresh();
      await hud.fade(false);
      G.endCutscene();
      G.toast('앗, 기절했어요! 체크포인트에서 다시 시작해요');
    },

    giveTreat(stage, id) {
      const before = { roll: hasAbility(state, 'roll'), jump: hasAbility(state, 'jump') };
      addTreat(state, stage, id);
      sfx.pickup();
      G.toast(`강아지 간식 냠냠! (이 지역 ${state.treats[stage].length}/3)`);
      const learned = ['roll', 'jump'].find((a) => !before[a] && hasAbility(state, a));
      if (learned) {
        sfx.fanfare();
        G.player.act('cheer');
        const how = learned === 'roll'
          ? `${G.touch ? '🌀 버튼을 누르면 보고 있는 쪽으로' : '2번을 누르면 마우스 쪽으로'} 데굴데굴 굴러요. 구르는 동안은 다치지 않아요!`
          : `${G.touch ? '⤴ 버튼을' : '3번을'} 누르면 폴짝 뛰어올라요!`;
        G.say([{ name: '요키', text: `간식을 먹었더니 힘이 솟아! 새 능력: ${learned === 'roll' ? '구르기 🌀' : '점프 ⤴️'}` }, { name: '도움말', text: how }]);
      }
    },
    // A locked ability tells how to get it.
    canUse(ability) {
      if (hasAbility(state, ability)) return true;
      const need = ABILITY_TREATS[ability] - treatsEaten(state);
      G.toast(`아직 못 해요! 강아지 간식을 ${need}개 더 먹으면 배워요 (냄새 맡기로 찾아봐요)`, 2200);
      return false;
    },
  };
  const pool = Array.from({ length: 8 }, () => {
    const l = new THREE.PointLight('#ffffff', 0, 10, 2);
    scene.add(l);
    return l;
  });
  let poolTimer = 0, assigned = [];
  function updateLightPool(dt) {
    poolTimer -= dt;
    const pp = G.player.position;
    const at = (src) => (typeof src.pos === 'function' ? src.pos() : src.pos);
    if (poolTimer <= 0) {
      poolTimer = 0.25;
      assigned = G.lightSources.filter((s) => s.on)
        .map((s) => [s, at(s).distanceToSquared(pp)])
        .sort((a, b) => a[1] - b[1]).slice(0, pool.length).map(([s]) => s);
    }
    pool.forEach((l, i) => {
      const s = assigned[i];
      if (!s || !s.on) { l.intensity = 0; return; }
      l.position.copy(at(s));
      l.color.copy(s.color);
      l.distance = s.distance;
      l.intensity = s.intensity * (1 + (s.flicker ? Math.sin(G.time * 13 + i) * s.flicker + Math.sin(G.time * 7.3) * s.flicker * 0.7 : 0));
    });
  }

  // Two soft scent rings roll out from Yorkie to the edge of the sniffing
  // range and fade, so a child sees how far the nose reaches.
  const rings = [];
  function sniffRings(origin) {
    for (let k = 0; k < 2; k++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.975, 1, 96).rotateX(-Math.PI / 2), // a thin line, even at full size
        new THREE.MeshBasicMaterial({ color: '#fff27a', transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }),
      );
      ring.renderOrder = 6;
      ring.position.copy(origin).setY(origin.y + 0.15);
      scene.add(ring);
      rings.push({ ring, t: -k * 0.35, echo: k > 0 });
    }
  }
  G.onUpdate((dt) => {
    for (const r of rings) {
      r.t += dt;
      // the first ring moves at an even pace, so things light up exactly as it
      // passes them; the second trails behind as a softer echo
      const k = Math.min(1, Math.max(0, r.t) / SNIFF_TIME);
      r.ring.scale.setScalar(0.5 + k * (SNIFF_RANGE - 0.5));
      r.ring.material.opacity = r.t < 0 ? 0 : (r.echo ? 0.4 : 0.8) * (1 - k * k);
      if (k >= 1) { scene.remove(r.ring); r.ring.geometry.dispose(); r.ring.material.dispose(); r.done = true; }
    }
    for (let i = rings.length - 1; i >= 0; i--) if (rings[i].done) rings.splice(i, 1);
  });

  G.on('hurt', ({ amount }) => G.onHurt(amount));
  G.on('sniff', ({ pos }) => G.sniff(pos));
  return G;
}

// How far Yorkie's nose reaches, and how long the scent wave takes to get there.
const SNIFF_RANGE = 10; // narrowed twice at the director's request (28 → 20 → 10 m)
const SNIFF_TIME = 3.5; // the ring keeps the same slow pace as before (≈2.9 m/s)

// What a pickup is called on its Alt label.
const PICKUP_NAMES = { hammer: '망치', scissors: '가위', flashlight: '손전등', engine: '엔진 부품', 'energy-crystal': '에너지 크리스털', 'ship-key': '배의 열쇠' };
function pickupName(id) {
  if (!id) return '다이아몬드';
  if (PICKUP_NAMES[id]) return PICKUP_NAMES[id];
  if (id.startsWith('treat-')) return '강아지 간식';
  if (id.startsWith('potion-')) return '하트 포션';
  if (id.startsWith('village-key')) return '열쇠';
  if (id.startsWith('mine-gem')) return '다이아몬드';
  return '???';
}

// Bobbing helper for decorations that should feel alive.
export function spin(object, dt, speed = 1) { object.rotation.y += dt * speed; }
export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
