import * as THREE from 'three';
import { createFriends } from '../entities/friends.js';
import { tintHoodie } from '../entities/yorkie.js';
import { setSaveTransform, newState } from '../core/state.js';
import { currentObjective } from '../core/quests.js';
import { safeName, sharedOf, newIn, applyShared } from '../net/share.js';
import { josa } from '../ui/lobby.js';
import { sfx } from '../audio/sound.js';

const coopKey = (id) => `scary-island-coop-${id}`;

// Was this tab already playing that game? (a refresh: go straight back in)
export function playedHere(id) {
  try { return !!sessionStorage.getItem(coopKey(id)); } catch { return false; }
}

// The character I play a game with: the one I had in this game before a
// refresh, else a brand-new Yorkie (with my nickname and hoodie).
export function coopCharacter(id, profile) {
  let kept = null;
  try { kept = JSON.parse(sessionStorage.getItem(coopKey(id))); } catch { /* none */ }
  return kept?.version === 1 ? { ...newState(), ...kept, profile } : { ...newState(), profile };
}

// What a friend's progress sounds like here (the rest arrives quietly).
const NEWS = {
  'taken/hammer': '🔨 친구가 망치를 찾았어요!',
  'taken/scissors': '✂️ 친구가 가위를 찾았어요!',
  'taken/flashlight': '🔦 친구가 손전등을 찾았어요!',
  'taken/engine': '⚙️ 친구가 엔진 부품을 찾았어요!',
  'taken/energy-crystal': '💎 친구가 에너지 크리스털을 찾았어요!',
  'taken/ship-key': '🔑 친구가 배의 열쇠를 찾았어요!',
  'taken/village-key-0': '🗝️ 친구가 열쇠를 찾았어요!',
  'taken/village-key-1': '🗝️ 친구가 열쇠를 찾았어요!',
  'taken/village-key-2': '🗝️ 친구가 열쇠를 찾았어요!',
  'parts/generatorPart': '🔧 친구가 발전기 부품과 연료통을 찾았어요!',
  'flags/doorOpen': '친구가 돌문을 열었어요!',
  'flags/vinesCut': '친구가 덩굴을 잘랐어요!',
  'flags/generatorFixed': '친구가 발전기를 켰어요!',
  'flags/mineDoorOpen': '친구가 광산 문을 열었어요!',
  'flags/golemAsleep': '친구가 골렘을 재웠어요!',
  'flags/villageDoorOpen': '친구가 마을 문을 열었어요!',
  'flags/ancientGateOpen': '친구가 고대 문을 열었어요!',
  'flags/sealReleased': '봉인이 풀렸어요!',
  'flags/crystalFitted': '친구가 배를 고쳤어요!',
};

// Playing together, inside the game:
// - my Yorkie's pose goes out through presence (only what changed), and
//   friends' Yorkies come in;
// - world progress is shared both ways: mine goes into the game document, my
//   friends' comes into my state and my world (regions listen to 'shared');
// - I play the game as a new character: my solo save is left as it is, and
//   this game's character is kept for the tab (a refresh doesn't lose it);
// - the monsters run on one client, the host; the others draw them, and send
//   what they do to a monster (a bonk, a light, a bark) to the host, which
//   sends back who got hurt.
export function setupCoop(G, net, own, { onEnd }) {
  G.net = net;
  const friends = G.friends = createFriends(G);
  tintHoodie(G.player.model, G.state.profile.color);
  // saving writes this game's character to the tab and leaves the solo save as it was
  setSaveTransform((s) => {
    try { sessionStorage.setItem(coopKey(net.id), JSON.stringify(s)); } catch { /* private mode */ }
    return { ...own, profile: s.profile };
  });
  net.reportStage(() => currentObjective(G.state)?.stage.id ?? 5); // for the lobby

  // --- world progress
  let pushed = sharedOf(G.state);
  function push() {
    const now = sharedOf(G.state);
    const add = newIn(now, pushed);
    pushed = now;
    net.pushShared(add);
  }
  function pull(shared) {
    const changes = applyShared(G.state, shared);
    if (!changes.length) return;
    pushed = sharedOf(G.state); // nothing of this goes back out
    let news = null;
    for (const [field, key] of changes) {
      if (field === 'taken') G.removePickup(key);
      if (field === 'flags') G.emit('flag', key); // nav, statues...
      G.emit('shared', { field, key }); // doors open, the boat gets fixed...
      news = NEWS[`${field}/${key}`] ?? news;
    }
    // the whole party gets the stage card; the escape is everyone's own (board the boat!)
    const stage = changes.map(([field, key]) => field === 'cleared' && Number(key)).find((id) => id && id < 5);
    if (changes.some(([field, key]) => field === 'cleared' && key === '5')) news = '⛵ 친구가 섬을 탈출했어요! 나도 배에 타요!';
    if (stage) G.clearStage(stage);
    else if (news) { sfx.item(); G.toast(news); }
    G.refresh();
  }
  G.on('progress', push); // every G.refresh(): flags, pickups, parts...
  net.on('shared', pull);
  pull(net.shared()); // anything that happened while the island was built

  // --- my pose
  const r2 = (n) => Math.round(n * 100) / 100;
  const sent = {};
  let lastAction = null, actions = 0;
  function sendPose() {
    const s = G.player.state, p = G.player.position;
    if (s.action && s.action !== lastAction) actions++;
    lastAction = s.action;
    const now = {
      x: r2(p.x), y: r2(p.y), z: r2(p.z), h: r2(s.heading), s: Math.round(s.speed * 10) / 10, g: s.grounded,
      a: s.action?.name ?? null, an: actions, hm: !!G.state.items.hammer, hid: s.hidden,
    };
    const change = {};
    for (const k in now) if (now[k] !== sent[k]) change[k] = now[k];
    if (Object.keys(change).length) { Object.assign(sent, change); net.send(change); }
  }

  // --- monsters
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const arr = (v) => [v.x, v.y, v.z].map((n) => Math.round(n * 100) / 100);
  // what a client may ask the host to do to a monster
  const CALLS = new Set(['wake', 'start', 'freeze', 'blow', 'wakeUp', 'calm', 'reset']);
  const hosting = () => net.amHost();
  net.onMessage('mon', ({ s: snaps }) => { if (!hosting()) for (const [i, ...snap] of snaps) G.enemies[i]?.apply(snap); });
  net.onMessage('fx', ({ i, d }) => { if (!hosting()) G.enemies[i]?.fx?.(d); });
  net.onMessage('call', ({ i, m, a }) => {
    const e = G.enemies[i];
    if (!hosting() || !e || !CALLS.has(m) || typeof e[m] !== 'function') return;
    const args = (a ?? []).map((x) => (Array.isArray(x?.v) ? v3(x.v) : x));
    G.quietly(() => e[m](...args));
  });
  net.onMessage('hit', ({ i, p, from }) => {
    const h = hosting() && G.hittables.find((x) => x.enemy === G.enemies[i]);
    if (h && (!h.enabled || h.enabled())) G.quietly(() => h.onHit(v3(p), null, v3(from)));
  });
  net.onMessage('noise', ({ pos, radius, kind }) => { if (hosting()) G.emit('noise', { pos: v3(pos), radius, kind, remote: true }); });
  // the host says a monster got me: only if it really is close to where I am
  // (the host sees me a moment late, and a child should never be hit unfairly)
  net.onMessage('hurt', ({ to, from, n }) => {
    const at = v3(from);
    if (to === net.me && at.distanceTo(G.player.position) < 3.5) G.hurtPlayer(at, n ?? 1);
  });
  G.on('noise', (n) => { if (!n.remote && !hosting()) net.broadcast('noise', { pos: arr(n.pos), radius: n.radius, kind: n.kind }); });

  // the host's monsters, out a few times a second: what changed, and all of
  // them now and then (someone who just arrived, a lost message)
  const lastSnap = [];
  let snapTimer = 0, fullTimer = 0;
  function sendMonsters(dt) {
    if ((snapTimer += dt) < 0.1) return;
    snapTimer = 0;
    const full = (fullTimer += 0.1) > 2;
    if (full) fullTimer = 0;
    const out = [];
    for (const e of G.enemies) {
      const snap = e.snap();
      const key = snap.join();
      if (full || key !== lastSnap[e.index]) { out.push([e.index, ...snap]); lastSnap[e.index] = key; }
    }
    if (out.length) net.broadcast('mon', { s: out });
  }

  net.on('join', (p) => { sfx.item(); G.toast(`🐶 ${josa(safeName(p.name), '이', '가')} 놀러 왔어요!`); });
  net.on('leave', (p) => G.toast(`👋 ${josa(safeName(p.name), '이', '가')} 집에 갔어요`));
  net.on('end', onEnd);
  addEventListener('pagehide', () => net.goodbye());

  let pushTimer = 0;
  return {
    targets: () => friends.targets(),
    hosting,
    hurtFriend(t, from, amount = 1) { net.broadcast('hurt', { to: t.id, from: arr(from), n: amount }); },
    forward(e, method, args) { net.broadcast('call', { i: e.index, m: method, a: args.map((x) => (x?.isVector3 ? { v: arr(x) } : x)) }); },
    forwardHit(e, point) { net.broadcast('hit', { i: e.index, p: arr(point), from: arr(G.player.position) }); },
    fx(e, d) { if (hosting()) net.broadcast('fx', { i: e.index, d }); },
    update(dt) {
      if (hosting() && G.mode !== 'title') sendMonsters(dt);
      if (G.mode !== 'title') sendPose();
      // progress that did not go through G.refresh() (a few counters)
      if ((pushTimer += dt) > 1) { pushTimer = 0; push(); }
      net.tick();
      friends.update(dt, net.others());
    },
  };
}
