import * as THREE from 'three';
import { part } from '../world/items.js';
import { heightAt } from '../world/map.js';
import { sfx } from '../audio/sound.js';

// Mushy, the mushroom ghost (GDD §6): floats about, puffs spore clouds at
// Yorkie, and the hammer goes right through it. Only a wind fan blows it away.

export function createMushyModel() {
  const g = new THREE.Group();
  const ghost = new THREE.Group();
  g.add(ghost);
  const bodyMat = { transparent: true, opacity: 0.85, emissive: '#cdb8ff', emissiveIntensity: 0.35, roughness: 0.4 };
  ghost.add(part(new THREE.SphereGeometry(0.42, 10, 8), '#efe6ff', { y: 1.0 }, bodyMat));
  ghost.add(part(new THREE.ConeGeometry(0.4, 0.7, 10, 1, true), '#efe6ff', { y: 0.55, rx: Math.PI }, { ...bodyMat, side: THREE.DoubleSide }));
  // mushroom cap with white spots
  ghost.add(part(new THREE.SphereGeometry(0.55, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#b44be1', { y: 1.22, sy: 0.7 }, { emissive: '#7a2fb0', emissiveIntensity: 0.4 }));
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3;
    ghost.add(part(new THREE.SphereGeometry(0.07, 6, 4), '#ffffff', { x: Math.cos(a) * 0.32, y: 1.45, z: Math.sin(a) * 0.32 }));
  }
  for (const s of [-1, 1]) {
    ghost.add(part(new THREE.SphereGeometry(0.08, 8, 6), '#2b1d40', { x: s * 0.15, y: 1.02, z: 0.37 }));
    ghost.add(part(new THREE.SphereGeometry(0.025, 4, 4), '#ffffff', { x: s * 0.15 + 0.02, y: 1.05, z: 0.44 }));
    ghost.add(part(new THREE.SphereGeometry(0.06, 6, 4), '#ff9ad5', { x: s * 0.28, y: 0.92, z: 0.32 }));
  }
  const zzz = part(new THREE.TorusGeometry(0.12, 0.03, 4, 8), '#ffffff', { y: 1.9 }, { emissive: '#ffffff', emissiveIntensity: 0.6 });
  zzz.visible = false;
  g.add(zzz);
  g.userData.rig = { ghost, zzz };
  return g;
}

const PUFF_SPEED = 3.6;

export function createMushy(G, { x, z, id, range = 10 }) {
  const model = createMushyModel();
  const home = new THREE.Vector3(x, heightAt(x, z), z);
  model.position.copy(home);
  G.scene.add(model);
  G.look.shadows(model);
  const glowPos = new THREE.Vector3();
  const light = G.addLight({ pos: () => glowPos.copy(model.position).setY(model.position.y + 1.2), color: '#c48cff', intensity: 3, distance: 7 });
  const puffs = [];

  const e = {
    id, kind: 'mushy', model, state: 'float', t: 0, cooldown: 2, sleepFor: 0,
    get pos() { return model.position; },
    get active() { return e.state === 'float' && model.position.distanceTo(G.player.position) < range; },
  };

  // blown away by a fan: tumble off, then doze at home for a while
  e.blow = (dir) => {
    if (e.state !== 'float') return;
    e.state = 'blown'; e.t = 0; e.blowDir = dir.clone().setY(0).normalize();
    sfx.ghost();
    for (const p of puffs) p.life = 0;
    G.emit('mushyBlown', e);
  };
  e.reset = () => { e.state = 'float'; model.position.copy(home); e.sleepFor = 0; for (const p of puffs) p.life = 0; };

  function shoot() {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 1), new THREE.MeshStandardMaterial({ color: '#c79cff', transparent: true, opacity: 0.75, emissive: '#9c6bff', emissiveIntensity: 0.4, flatShading: true }));
    puff.position.copy(model.position).setY(model.position.y + 1);
    const dir = G.player.position.clone().setY(G.player.position.y + 0.5).sub(puff.position).normalize();
    G.scene.add(puff);
    puffs.push({ mesh: puff, dir, life: 3.2 });
    sfx.puff();
  }

  G.addHittable({
    radius: 0.6, pos: () => model.position.clone().setY(model.position.y + 0.9), enabled: () => e.state === 'float',
    onHit() { sfx.ghost(); G.toast('휙! 망치가 그냥 통과해요… 바람 장치를 써 보세요', 1800); },
  });

  e.update = (dt) => {
    e.t += dt;
    const p = G.player.position;
    const toP = new THREE.Vector3().subVectors(p, model.position).setY(0);
    const dist = toP.length();
    const { ghost, zzz } = model.userData.rig;

    if (e.state === 'float') {
      ghost.position.y = Math.sin(e.t * 2) * 0.15 + 0.2;
      if (dist < range) {
        model.rotation.y = Math.atan2(toP.x, toP.z);
        // drift toward Yorkie, but stay near home
        const fromHome = model.position.distanceTo(home);
        if (dist > 3 && fromHome < 7) model.position.addScaledVector(toP.normalize(), 0.9 * dt);
        e.cooldown -= dt;
        if (e.cooldown <= 0) { shoot(); e.cooldown = 2.6; }
      } else {
        model.position.lerp(home, 1 - Math.exp(-0.5 * dt));
      }
      model.position.y = heightAt(model.position.x, model.position.z);
      if (dist < 1.0) G.hurtPlayer(model.position);
    } else if (e.state === 'blown') {
      model.position.addScaledVector(e.blowDir, 9 * dt);
      model.position.y = heightAt(model.position.x, model.position.z) + e.t * 2;
      ghost.rotation.z += dt * 10;
      if (e.t > 1.4) { e.state = 'sleep'; e.sleepFor = 25; model.position.copy(home); ghost.rotation.z = 0; }
    } else if (e.state === 'sleep') {
      e.sleepFor -= dt;
      ghost.position.y = 0.05;
      if (e.sleepFor <= 0) e.state = 'float';
    }
    zzz.visible = e.state === 'sleep';
    zzz.position.y = 1.9 + Math.sin(e.t * 2) * 0.1;
    light.intensity = e.state === 'sleep' ? 1 : 3;

    for (const puff of puffs) {
      if (puff.life <= 0) continue;
      puff.life -= dt;
      puff.mesh.position.addScaledVector(puff.dir, PUFF_SPEED * dt);
      puff.mesh.scale.setScalar(1 + (3.2 - puff.life) * 0.25);
      puff.mesh.material.opacity = Math.min(0.75, puff.life);
      if (puff.mesh.position.distanceTo(p.clone().setY(p.y + 0.5)) < 0.7) { G.hurtPlayer(puff.mesh.position); puff.life = 0; }
      if (puff.life <= 0) G.scene.remove(puff.mesh);
    }
    for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].life <= 0) { G.scene.remove(puffs[i].mesh); puffs.splice(i, 1); }
  };

  G.addEnemy(e);
  return e;
}

// The wind device (GDD §6 "바람 장치 활용"): switch it on and it blows any
// Mushy in front of it far away.
export function createFan(G, { x, z, ry = 0 }) {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(0.08, 0.12, 1.4, 6), '#7a5b3a', { y: 0.7 }));
  g.add(part(new THREE.BoxGeometry(0.5, 0.3, 0.5), '#e7c35a', { y: 0.15 }));
  const head = new THREE.Group();
  head.position.y = 1.45;
  head.add(part(new THREE.CylinderGeometry(0.12, 0.12, 0.25, 8), '#4a90c2', { rx: Math.PI / 2 }));
  const blades = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const piv = new THREE.Group();
    piv.rotation.z = (i / 4) * Math.PI * 2;
    piv.add(part(new THREE.BoxGeometry(0.16, 0.55, 0.03), '#9fd8ff', { y: 0.3 }));
    blades.add(piv);
  }
  blades.position.z = 0.15;
  head.add(blades);
  g.add(head);
  g.position.set(x, heightAt(x, z), z);
  g.rotation.y = ry;
  G.scene.add(g);
  G.look.shadows(g);
  G.physics.addCuboid(x, g.position.y + 0.7, z, 0.25, 0.7, 0.25);

  let on = 0;
  const forward = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
  G.addInteractable({
    pos: g.position, radius: 2, label: () => (on > 0 ? '바람이 불고 있어요!' : '바람 장치 켜기'),
    action: () => { if (on <= 0) { on = 5; sfx.whoosh(); } },
  });
  G.onUpdate((dt) => {
    if (on <= 0) return;
    on -= dt;
    blades.rotation.z += dt * 30;
    for (const e of G.enemies) {
      if (e.kind !== 'mushy') continue;
      const to = e.pos.clone().sub(g.position).setY(0);
      const d = to.length();
      if (d < 12 && to.normalize().dot(forward) > 0.6) e.blow(forward);
    }
  });
  return g;
}
