import * as THREE from 'three';
import { sfx } from '../audio/sound.js';

// The flashlight (GDD §7.1: "어두운 장소 탐색, 동상 정지"): a short, bright
// beam in front of Yorkie. Statues caught in it freeze for a while, even after
// you look away. The "강력한 손전등" upgrade makes it last longer.
export const FREEZE_SECONDS = 4;
export const STRONG_FREEZE_SECONDS = 7;
const RANGE = 13;
const HALF_ANGLE = 0.45; // radians
// The battery (the right-hand orb): each flash costs a third, it refills by
// itself in about twelve seconds, so the light is precious but never gone.
export const FLASH_COST = 34;
export const RECHARGE_PER_SECOND = 8;

export function inBeam(origin, facing, target, range = RANGE, halfAngle = HALF_ANGLE) {
  const to = new THREE.Vector3().subVectors(target, origin).setY(0);
  const d = to.length();
  if (d > range || d < 0.01) return false;
  return to.normalize().dot(facing) > Math.cos(halfAngle);
}

export function setupFlashlight(G) {
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(Math.tan(HALF_ANGLE) * RANGE, RANGE, 24, 1, true).translate(0, -RANGE / 2, 0).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  cone.renderOrder = 5;
  G.scene.add(cone);
  const glow = G.addLight({ pos: new THREE.Vector3(), color: '#fff2c0', intensity: 14, distance: 16 });
  glow.on = false;
  let t = 0, cooldown = 0;
  G.battery = 100;

  G.on('flashlight', () => {
    if (!G.state.items.flashlight || cooldown > 0 || G.mode !== 'play') return;
    if (G.battery < FLASH_COST) { G.toast('🔋 손전등 배터리가 충전 중이에요', 1200); return; }
    G.battery -= FLASH_COST;
    t = 0.7; cooldown = 1.2;
    sfx.click(); sfx.power();
    const origin = G.player.position.clone().setY(G.player.position.y + 0.6);
    const facing = G.player.facing.clone();
    const seconds = G.state.upgrades.lamp ? STRONG_FREEZE_SECONDS : FREEZE_SECONDS;
    let frozen = 0;
    for (const e of G.enemies) {
      if (!e.freeze) continue;
      if (inBeam(origin, facing, e.pos)) { G.toHost(e, 'freeze', seconds); frozen++; G.emit('frozenByLight', e); }
    }
    if (frozen) G.toast(`반짝! 동상이 ${seconds}초 동안 멈췄어요`, 1500);
  });

  G.onUpdate((dt) => {
    cooldown = Math.max(0, cooldown - dt);
    G.battery = Math.min(100, G.battery + RECHARGE_PER_SECOND * dt);
    t = Math.max(0, t - dt);
    const p = G.player.position;
    cone.position.set(p.x, p.y + 0.6, p.z);
    cone.rotation.y = G.player.state.heading;
    cone.material.opacity = Math.min(0.35, t * 0.6);
    cone.visible = t > 0;
    glow.on = t > 0;
    glow.pos.copy(p).addScaledVector(G.player.facing, 3).setY(p.y + 1.5);
  });
}
