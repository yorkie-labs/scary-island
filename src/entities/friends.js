import * as THREE from 'three';
import { createYorkie, createYorkieAnimator, tintHoodie } from './yorkie.js';
import { addSilhouette } from './silhouette.js';
import { ACTIONS } from '../player/player.js';
import { sfx } from '../audio/sound.js';

// Friends' Yorkies, drawn from their presence: each wears its own hoodie
// colour and a name tag, glides toward the latest pose it sent, and replays
// the moves it makes (a swing, a bark, a roll). No physics: friends are seen,
// not bumped into.
const HEAR_BARK = 22;

export function createFriends(G) {
  const tags = document.createElement('div');
  tags.id = 'friend-tags';
  document.body.appendChild(tags);
  const friends = new Map(); // clientID -> friend
  const v = new THREE.Vector3();

  function add(p) {
    const model = tintHoodie(createYorkie(), p.color);
    G.scene.add(model);
    G.look.shadows(model);
    const tag = document.createElement('div');
    tag.className = 'friend-tag';
    tag.textContent = p.name;
    tag.style.setProperty('--hoodie', p.color);
    tags.appendChild(tag);
    const f = {
      model, tag, color: p.color, animate: createYorkieAnimator(model), ghost: addSilhouette(model, p.color),
      target: new THREE.Vector3(p.x, p.y, p.z), heading: p.h ?? 0, action: null, seen: p.an,
      // what a monster sees of this friend: the same shape as G.player
      proxy: { id: p.id, position: model.position, facing: new THREE.Vector3(), body: null, state: { hidden: false, speed: 0, grounded: true, action: null } },
    };
    model.position.copy(f.target);
    friends.set(p.clientID, f);
    return f;
  }

  function remove(id) {
    const f = friends.get(id);
    G.scene.remove(f.model);
    f.model.traverse((o) => { if (o.isMesh && !o.userData.isSilhouette && !o.userData.isOutline) o.geometry.dispose(); });
    f.tag.remove();
    friends.delete(id);
  }

  return {
    get count() { return friends.size; },
    targets() { return [...friends.values()].map((f) => f.proxy); },
    dots() { return [...friends.values()].map((f) => ({ x: f.model.position.x, z: f.model.position.z, color: f.color })); },

    update(dt, others) {
      const live = new Set();
      const showTags = G.mode !== 'title';
      for (const p of others) {
        if (typeof p.x !== 'number') continue; // joined, but no pose yet
        live.add(p.clientID);
        const f = friends.get(p.clientID) ?? add(p);
        f.target.set(p.x, p.y, p.z);
        // glide to the latest pose; a jump across the map (a teleport) snaps
        if (f.model.position.distanceTo(f.target) > 6) f.model.position.copy(f.target);
        else f.model.position.lerp(f.target, 1 - Math.exp(-12 * dt));
        const turn = Math.atan2(Math.sin((p.h ?? 0) - f.heading), Math.cos((p.h ?? 0) - f.heading));
        f.heading += turn * (1 - Math.exp(-14 * dt));
        f.model.rotation.y = f.heading;

        if (p.an !== f.seen) {
          f.seen = p.an;
          if (ACTIONS[p.a]) {
            f.action = { name: p.a, t: 0, duration: ACTIONS[p.a].duration };
            if (p.a === 'bark' && f.model.position.distanceTo(G.player.position) < HEAR_BARK) sfx.bark();
          }
        }
        if (f.action && (f.action.t += dt) >= f.action.duration) f.action = null;
        f.model.userData.rig.hammer.visible = !!p.hm;
        Object.assign(f.proxy.state, { hidden: !!p.hid, speed: p.s ?? 0, grounded: p.g ?? true, action: p.a ? { name: p.a } : null });
        f.proxy.facing.set(Math.sin(f.heading), 0, Math.cos(f.heading));
        f.animate(dt, { speed: p.s ?? 0, grounded: p.g ?? true, action: f.action, hidden: !!p.hid });
        f.ghost.visible = showTags;

        v.copy(f.model.position).setY(f.model.position.y + 1.35).project(G.camera);
        const onScreen = showTags && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
        f.tag.style.display = onScreen ? '' : 'none';
        if (onScreen) f.tag.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px) translate(-50%, -100%)`;
      }
      for (const id of [...friends.keys()]) if (!live.has(id)) remove(id);
    },
  };
}
