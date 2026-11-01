import * as THREE from 'three';
import { sfx } from '../audio/sound.js';

// Diablo-style mouse control. Left click: on the ground, walk there (hold to
// keep following the cursor); on a monster, ore or planks, walk up and bonk
// it (hold to keep bonking); on an item, door or device, walk up and use it.
// Shift+left: bonk in place toward the cursor. Right click: the flashlight
// toward the cursor. 2: roll toward the cursor.

const ENEMY_NAMES = { rocky: 'Rocky · 돌멩이 괴물', watcher: 'Watcher · 감시하는 동상', mushy: 'Mushy · 버섯 유령', golem: 'Crystal Golem', guardian: '섬의 수호자' };
const ENEMY_SIZE = { rocky: [0.8, 0.5], watcher: [0.8, 1.2], mushy: [0.7, 1.0], golem: [1.8, 2.0], guardian: [1.6, 3.0] };

export function createPointer(G) {
  const dom = G.renderer.domElement;
  const ndc = new THREE.Vector2(9, 9);
  const raycaster = new THREE.Raycaster();
  let held = false, hover = null, order = null, shiftHeld = false, hoverTimer = 0;
  const plate = document.getElementById('hover-plate');
  const tip = document.getElementById('hover-tip');
  let mouseX = 0, mouseY = 0;

  // a ring on the ground where Yorkie is heading
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.4, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd34d', transparent: true, opacity: 0, depthWrite: false }));
  marker.renderOrder = 4;
  G.scene.add(marker);
  // a ring under the hovered target
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.9, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff5d5d', transparent: true, opacity: 0.8, depthWrite: false }));
  halo.renderOrder = 4;
  halo.visible = false;
  G.scene.add(halo);

  const active = () => G.mode === 'play';

  dom.addEventListener('mousemove', (e) => {
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    mouseX = e.clientX; mouseY = e.clientY;
  });
  dom.addEventListener('mousedown', (e) => {
    if (!active() || G.riding?.()) return;
    if (e.button === 0) { held = true; shiftHeld = e.shiftKey; leftClick(e.shiftKey); }
    if (e.button === 2) rightClick();
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) held = false; });
  addEventListener('blur', () => { held = false; });

  // --- picking
  function pick() {
    raycaster.setFromCamera(ndc, G.camera);
    const ray = raycaster.ray;
    let best = null;
    const consider = (kind, pos, radius, data) => {
      const t = ray.origin.distanceTo(pos);
      if (ray.distanceToPoint(pos) < radius && (!best || t < best.t)) best = { kind, pos, t, ...data };
    };
    for (const e of G.enemies) {
      if (!e.model?.visible || e.state === 'sleep' && e.kind !== 'rocky' || e.state === 'asleep') continue;
      const [r, h] = ENEMY_SIZE[e.kind] ?? [0.8, 0.8];
      consider('enemy', e.pos.clone().setY(e.pos.y + h * (e.model.scale?.x ?? 1)), r * (e.model.scale?.x ?? 1), { enemy: e, label: e.kind === 'rocky' && e.state === 'sleep' ? '평범한 돌…?' : ENEMY_NAMES[e.kind] });
    }
    for (const p of G.pickups) if (p.alive && !p.hidden) consider('pickup', p.model.position, 0.7, { pickup: p, label: '줍기' });
    for (const it of G.interactables) {
      if (!it.enabled()) continue;
      const ip = typeof it.pos === 'function' ? it.pos() : it.pos;
      consider('use', ip.clone().setY(ip.y + 0.8), 1.2, { it, label: typeof it.label === 'function' ? it.label() : it.label });
    }
    for (const h of G.hittables) {
      if (h.enabled && !h.enabled()) continue;
      const hp = typeof h.pos === 'function' ? h.pos() : h.pos;
      if (G.enemies.some((e) => e.pos.distanceTo(hp) < 2.2)) continue; // monsters are picked as monsters
      if (hp.distanceTo(G.player.position) > 40) continue;
      consider('hit', hp, h.radius + 0.2, { hit: h, label: '망치로 치기' });
    }
    if (best) return best;
    const g = groundPoint(ray);
    return g ? { kind: 'ground', pos: g } : null;
  }

  // A click means a spot on the ground: the ray is tested against the ground
  // meshes only (island, cave floor, dock), never trees, roofs or the
  // invisible ridge walls. Missing them, the plane at Yorkie's height.
  function groundPoint(ray) {
    raycaster.ray.copy(ray);
    // the first surface that faces up (floor, path, grass): wall faces of the
    // cave and steep bank faces are looked through, never taken as "ground"
    // recursive: the dock is a group of planks, and a click must land on them
    const hit = raycaster.intersectObjects(G.groundMeshes ?? [], true).find((h) => {
      if (!h.face) return true;
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      return Math.abs(n.y) > 0.45; // floors may be wound either way (the cave is double-sided)
    });
    const ground = hit ? hit.point.clone() : planePoint(ray);
    // A house, a tree or a cliff in front of that ground? Then the click means
    // the foot of that thing on our side, not the ground hidden behind it.
    const { RAPIER, world } = G.physics;
    const flags = RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC;
    // invisible walls (the ones along the ridges) never count as "in front"
    const seen = (c) => !G.invisibleColliders?.has(c.handle);
    const solid = world.castRay(new RAPIER.Ray(ray.origin, ray.direction), 400, true, flags, undefined, undefined, undefined, seen);
    if (solid && ground) {
      const t = solid.timeOfImpact ?? solid.toi;
      if (t < ray.origin.distanceTo(ground) - 0.5) {
        const p = ray.origin.clone().addScaledVector(ray.direction, t);
        const toCam = new THREE.Vector3(ray.origin.x - p.x, 0, ray.origin.z - p.z).normalize();
        p.addScaledVector(toCam, 0.8); // step back toward the camera, off the wall
        p.y = G.player.position.y;
        p.blocked = true;
        return p;
      }
    }
    return ground;
  }

  // Where the cursor points on the flat plane through Yorkie's feet: Diablo's
  // "direction" for held movement and for aiming, steady over hills.
  const plane = new THREE.Plane();
  function planePoint(ray) {
    plane.set(new THREE.Vector3(0, 1, 0), -G.player.position.y);
    return ray.intersectPlane(plane, new THREE.Vector3());
  }

  function cursorPoint() {
    raycaster.setFromCamera(ndc, G.camera);
    return planePoint(raycaster.ray);
  }

  // Turn a clicked spot into one Yorkie can actually stand on: the nearest
  // walkable cell, or else the last walkable spot on the way toward it.
  function walkableTarget(p) {
    const nav = G.nav;
    if (!nav || !p) return p;
    const from = G.player.position;
    const c = nav.nearestWalkable(p, 3);
    let closest = null;
    if (c) {
      const spot = nav.at(c);
      // reachable from here? if not (a ridge top, a cliff, an island in the
      // water), go as far as we can straight toward it rather than wandering
      // off sideways…
      const res = nav.findPath(from, spot, { near: 0.6 });
      if (res && !res.partial) return spot;
      closest = res?.points?.at(-1) ?? null;
    }
    const straight = nav.lineReach(from, p);
    if (straight && straight.distanceTo(from) > 0.6) return straight;
    // …and if even that is blocked right at our feet (standing under a ledge),
    // take the reachable spot nearest the click. A click never does nothing.
    if (closest && closest.distanceTo(from) > 0.6) return closest;
    return null;
  }

  function planTo(goal, near) {
    const res = G.nav?.findPath(G.player.position, goal, { near });
    return res?.points?.length ? res.points : [goal.clone()];
  }

  function faceToward(p) {
    if (!p) return;
    const pp = G.player.position;
    if (Math.hypot(p.x - pp.x, p.z - pp.z) > 0.05) G.player.state.heading = Math.atan2(p.x - pp.x, p.z - pp.z);
  }

  // a red cross where Yorkie cannot go (Diablo shows the same "no" feedback)
  const nope = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.35, 4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff5d5d', transparent: true, opacity: 0, depthWrite: false }));
  nope.renderOrder = 4;
  G.scene.add(nope);
  function blocked(p) {
    nope.position.set(p.x, p.y + 0.05, p.z);
    nope.material.opacity = 0.9;
  }

  function showMarker(p) {
    marker.position.set(p.x, p.y + 0.05, p.z);
    marker.material.opacity = 0.9;
    marker.scale.setScalar(1.4);
  }

  // --- clicks
  function leftClick(shift) {
    const h = pick();
    if (!h) return;
    if (shift) { faceToward(cursorPoint()); swing(); order = null; return; }
    switch (h.kind) {
      case 'enemy': order = { type: 'attack', moving: true, target: () => h.enemy.pos, radius: (ENEMY_SIZE[h.enemy.kind]?.[0] ?? 0.8) * (h.enemy.model.scale?.x ?? 1) }; break;
      case 'hit': order = { type: 'attack', target: () => (typeof h.hit.pos === 'function' ? h.hit.pos() : h.hit.pos), radius: h.hit.radius }; break;
      case 'pickup': order = { type: 'move', point: h.pickup.model.position.clone(), exact: true }; showMarker(h.pickup.pos); break;
      case 'use': order = { type: 'use', it: h.it }; break;
      default: {
        const p = walkableTarget(h.pos);
        if (!p) { faceToward(h.pos); blocked(h.pos); return; } // can't go: at least turn and say so
        order = { type: 'move', point: p };
        showMarker(p);
      }
    }
    if (order) plan(order);
  }

  let noHammerToast = 0;
  function swing() {
    if (!G.state.items.hammer) {
      if (performance.now() - noHammerToast > 2500) { noHammerToast = performance.now(); G.toast('망치가 아직 없어요'); }
      return;
    }
    G.player.act('swing');
  }

  // the touch hammer button: bonk right here, turned toward the nearest thing
  // that can be bonked (a rock, a monster, planks) so small thumbs need no aim
  function hammerButton() {
    order = null;
    const pp = G.player.position;
    let best = null, bd = 2.6;
    for (const h of G.hittables) {
      if (h.enabled && !h.enabled()) continue;
      const hp = typeof h.pos === 'function' ? h.pos() : h.pos;
      const d = Math.hypot(hp.x - pp.x, hp.z - pp.z) - h.radius;
      if (d < bd && Math.abs(hp.y - pp.y) < 2.5) { best = hp; bd = d; }
    }
    if (best) faceToward(best);
    swing();
  }

  function rightClick() {
    const p = cursorPoint();
    faceToward(p);
    order = null;
    G.useLight();
  }

  // on a touch screen there is no hovering cursor: roll and shine the way
  // Yorkie is already facing (or pushing the stick)
  let touchInput = false;
  addEventListener('pointerdown', (e) => { touchInput = e.pointerType === 'touch'; }, true);
  G.on('rollTowardCursor', () => { if (active() && G.canUse('roll')) { if (!touchInput) faceToward(cursorPoint()); order = null; G.player.act('roll'); } });
  G.on('faceCursor', () => { if (!touchInput) faceToward(cursorPoint()); });
  // a faint, a fall into the sea or a teleport ends whatever walk was going on
  for (const ev of ['faint', 'fell', 'teleported']) G.on(ev, () => { order = null; held = false; });

  // Work out (or refresh) the path an order follows.
  function plan(o) {
    const goal = o.type === 'move' ? o.point : o.type === 'attack' ? o.target() : (typeof o.it.pos === 'function' ? o.it.pos() : o.it.pos);
    const near = o.type === 'move' ? (o.exact ? 0.3 : 0.5) : o.type === 'attack' ? o.radius + 0.5 : Math.min(o.it.radius * 0.6, 1.4);
    o.path = planTo(goal, near);
    o.planned = performance.now();
    o.lastPos = G.player.position.clone();
    o.stuck = 0;
  }

  // --- every physics step: turn the current order into a world-space move
  function moveInput(keys) {
    if (keys.forward || keys.right) { order = null; return keys; } // the touch stick takes over
    if (!order || G.mode !== 'play') return keys;
    const pp = G.player.position;
    const now = performance.now();
    // held button: keep heading where the cursor points (on Yorkie's plane)
    if (order.type === 'move' && held && !order.exact && now - (order.followed ?? 0) > 250) {
      order.followed = now; // even when the cursor points somewhere unreachable
      const p = walkableTarget(cursorPoint());
      if (p) { order.point = p; plan(order); }
    }
    // chasing a monster that moves: refresh the path now and then
    if (order.type === 'attack' && order.moving && now - order.planned > 500) plan(order);
    // no progress for half a second: think again; after three tries, give up
    if (now - (order.checked ?? order.planned) > 500) {
      order.checked = now;
      if (pp.distanceTo(order.lastPos) < 0.2) {
        order.retries = (order.retries ?? 0) + 1;
        if (order.retries > 3) { blocked(pp); order = null; return { forward: 0, right: 0, run: false }; }
        plan(order);
      } else order.retries = 0;
      order.lastPos.copy(pp);
    }
    let goal, stopAt;
    if (order.type === 'move') { goal = order.point; stopAt = order.exact ? 0.15 : 0.3; }
    else if (order.type === 'attack') { goal = order.target(); stopAt = order.radius + 0.55; }
    else if (order.type === 'use') { goal = typeof order.it.pos === 'function' ? order.it.pos() : order.it.pos; stopAt = Math.min(order.it.radius * 0.6, 1.4); }
    const dx = goal.x - pp.x, dz = goal.z - pp.z;
    const d = Math.hypot(dx, dz);
    if (d > stopAt) {
      // follow the path's waypoints; the last stretch goes straight at the goal
      const path = order.path ?? [];
      while (path.length > 1 && Math.hypot(path[0].x - pp.x, path[0].z - pp.z) < 0.45) path.shift();
      const wp = path.length > 1 ? path[0] : goal;
      const wx = wp.x - pp.x, wz = wp.z - pp.z, wd = Math.hypot(wx, wz) || 1;
      return { forward: 0, right: 0, run: d > 1.2, world: { x: wx / wd, z: wz / wd } };
    }
    // arrived
    if (order.type === 'move') order = null;
    else if (order.type === 'use') {
      faceToward(goal);
      const it = order.it;
      order = null;
      if (it.enabled()) { G.player.act('interact'); it.action(); }
    } else if (order.type === 'attack') {
      faceToward(goal);
      if (!G.player.state.action) { swing(); if (!held) order = null; }
    }
    return { forward: 0, right: 0, run: false };
  }

  // --- every frame: hover feedback
  function update(dt) {
    marker.material.opacity = Math.max(0, marker.material.opacity - dt * 1.5);
    marker.scale.multiplyScalar(1 - dt * 0.8);
    nope.material.opacity = Math.max(0, nope.material.opacity - dt * 1.5);
    if (!active()) { halo.visible = false; plate.classList.add('hidden'); tip.classList.add('hidden'); document.body.dataset.cursor = ''; return; }
    if (held && shiftHeld && !G.player.state.action) { faceToward(cursorPoint()); swing(); }
    hoverTimer -= dt;
    if (hoverTimer <= 0) { hoverTimer = 0.05; hover = pick(); }
    const kind = hover?.kind;
    document.body.dataset.cursor = kind === 'enemy' || kind === 'hit' ? 'attack' : kind === 'use' || kind === 'pickup' ? 'use' : '';
    halo.visible = kind && kind !== 'ground';
    if (halo.visible) {
      const p = kind === 'enemy' ? hover.enemy.pos : hover.pos;
      halo.position.set(p.x, (kind === 'enemy' ? p.y : (G.groundAt && p.x < 400 ? G.groundAt(p.x, p.z) : p.y - 0.8)) + 0.06, p.z);
      halo.material.color.set(kind === 'enemy' || kind === 'hit' ? '#ff5d5d' : '#ffd34d');
      halo.scale.setScalar(kind === 'enemy' ? Math.max(1, (ENEMY_SIZE[hover.enemy.kind]?.[0] ?? 1)) : 0.8);
    }
    if (kind === 'enemy') { plate.innerHTML = plateHtml(hover.enemy, hover.label); plate.classList.remove('hidden'); } else plate.classList.add('hidden');
    if ((kind === 'use' || kind === 'pickup' || kind === 'hit') && hover.label) {
      tip.textContent = hover.label;
      tip.style.left = `${mouseX + 16}px`; tip.style.top = `${mouseY + 12}px`;
      tip.classList.remove('hidden');
    } else tip.classList.add('hidden');
  }

  // The monster plate (Diablo's health bar at the top): instead of hit points,
  // how close it is to being beaten, and how to beat it.
  function gauge(n, of, cls = '') {
    return `<div class="gauge ${cls}">${Array.from({ length: of }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`;
  }
  function timer(seconds, max, cls) {
    return `<div class="gauge ${cls}"><span style="width:${Math.min(100, (seconds / max) * 100)}%"></span></div>`;
  }
  function plateHtml(e, label) {
    let body = '', hint = '';
    switch (e.kind) {
      case 'rocky':
        if (e.state === 'sleep') { hint = '…돌인 척하고 있어요'; break; }
        if (e.state === 'stunned') { body = timer(6 - e.t, 6, 'dizzy'); hint = '어질어질! 지금 도망쳐요'; break; }
        body = gauge(e.hp, 2); hint = '망치로 두 번 치면 기절해요';
        break;
      case 'golem':
        body = gauge(e.hp, 3, 'crystal');
        hint = e.state === 'stunned' ? '지금! 등 뒤 분홍 크리스털을 쳐요' : '쿵! 내려찍은 뒤가 기회예요';
        break;
      case 'guardian':
        body = gauge(3 - (G.state.devices ?? 0), 3, 'crystal');
        hint = e.frozenFor > 0 ? `빛에 멈췄어요 (${Math.ceil(e.frozenFor)}초)` : '크리스털 장치 3개를 켜면 잠들어요';
        break;
      case 'watcher':
        if (e.state === 'asleep') { hint = '쿨쿨 잠들었어요'; break; }
        if (e.frozenFor > 0) { body = timer(e.frozenFor, 7, 'frozen'); hint = '빛에 꽁꽁 얼었어요'; } else hint = '바라보면 멈춰요 · 손전등으로 얼려요';
        break;
      case 'mushy':
        hint = e.state === 'sleep' ? '쿨쿨 자고 있어요' : '망치가 통과해요 · 바람 장치로 날려요';
        break;
      default: break;
    }
    return `<b>${label}</b>${body}${hint ? `<small>${hint}</small>` : ''}`;
  }

  // orders other parts of the UI can give (Alt labels are clickable)
  function goTo(point, exact = true) { order = { type: 'move', point: point.clone(), exact }; plan(order); showMarker(point); }
  function useIt(it) { order = { type: 'use', it }; plan(order); }

  return { goTo, useIt, moveInput, update, hammer: hammerButton, cancel: () => { order = null; held = false; }, get order() { return order; }, pick, cursorPoint };
}
