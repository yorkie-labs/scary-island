import * as THREE from 'three';

// Diablo-style camera: a fixed three-quarter view from above that follows
// Yorkie. The wheel zooms; trees and roofs between the lens and Yorkie fade
// out so the hero is never lost behind them.
//
// Diablo's look comes from a low-ish, far-away, narrow lens: ARPG cameras sit
// about 30-35° above the horizon (Diablo 4 is often quoted as "30/60") and use
// a narrow field of view from far back, so the world reads almost flat, like
// classic isometric art. A steep angle with a wide lens instead looks down on
// the top of the hero's head.
export const ISO_YAW = Math.PI / 4;
export const ISO_FOV = 35;
const PITCH = THREE.MathUtils.degToRad(35);
const DIST_MIN = 13, DIST_MAX = 30;
const NEVER_FADE = new Set(['island', 'sea', 'sky', 'cave', 'caveUpper']);

export function createIsoCamera(G) {
  const camera = G.camera;
  const rig = { yaw: ISO_YAW, pitch: PITCH, distance: DIST_MAX }; // start zoomed all the way out
  const focus = new THREE.Vector3();
  const offset = new THREE.Vector3();
  let shake = 0, override = null, fadeTimer = 0;
  const faded = new Set();

  G.renderer.domElement.addEventListener('wheel', (e) => {
    rig.distance = THREE.MathUtils.clamp(rig.distance + THREE.MathUtils.clamp(e.deltaY * 0.02, -2, 2), DIST_MIN, DIST_MAX); // small steps for trackpads
  }, { passive: true });

  function setFaded(obj, on) {
    obj.traverse((o) => {
      if (!o.isMesh || o.userData.isOutline) return;
      if (on) {
        if (!o.userData.solidMaterial) {
          o.userData.solidMaterial = o.material;
          o.material = o.material.clone();
          o.material.transparent = true;
          o.material.depthWrite = false;
        }
        o.material.opacity = 0.28;
      } else if (o.userData.solidMaterial) {
        o.material.dispose();
        o.material = o.userData.solidMaterial;
        delete o.userData.solidMaterial;
      }
    });
  }

  // An object fades only if it really stands between the lens and Yorkie: the
  // line of sight hits its box well before reaching Yorkie, and Yorkie is not
  // standing on or inside it (a dock, a floor, the deck beside a ship).
  const ray = new THREE.Ray(), hitPoint = new THREE.Vector3();
  function updateFades(head) {
    const toHead = head.clone().sub(camera.position);
    const dist = toHead.length();
    ray.set(camera.position, toHead.normalize());
    const feet = G.player.position;
    const now = new Set();
    for (const obj of G.scene.children) {
      if (!obj.visible || NEVER_FADE.has(obj.name) || obj === G.player.model || obj.isLight || obj.userData.noFade) continue;
      if (G.groundMeshes?.includes(obj)) continue; // what we walk on never fades
      if (G.enemies.some((e) => e.model === obj)) continue; // monsters move (and have silhouettes)
      // the box in the object's own frame (turned with it), so a ship lying at
      // an angle is not taken for the whole square of water around it
      if (!obj.userData.fadeBox) {
        obj.updateMatrixWorld(true);
        const inv = obj.matrixWorld.clone().invert();
        const b = new THREE.Box3();
        obj.traverse((m) => {
          if (!m.isMesh || m.userData.isOutline || m.userData.isSilhouette) return;
          if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
          b.union(m.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld)));
        });
        if (b.isEmpty() || b.getSize(new THREE.Vector3()).length() < 1.2) { obj.userData.noFade = true; continue; }
        obj.userData.fadeBox = b;
        obj.userData.fadeInv = inv;
      }
      const b = obj.userData.fadeBox, inv = obj.userData.fadeInv;
      const localFeet = feet.clone().applyMatrix4(inv);
      // standing on it or in it: not an obstacle to the view of Yorkie
      if (localFeet.x > b.min.x && localFeet.x < b.max.x && localFeet.z > b.min.z && localFeet.z < b.max.z && b.max.y < localFeet.y + 0.4) continue;
      const localRay = ray.clone().applyMatrix4(inv);
      if (!localRay.intersectBox(b, hitPoint)) continue;
      hitPoint.applyMatrix4(obj.matrixWorld);
      if (camera.position.distanceTo(hitPoint) < dist - 0.8 && b.max.y > localFeet.y + 0.5) now.add(obj);
    }
    for (const o of faded) if (!now.has(o)) { setFaded(o, false); faded.delete(o); }
    for (const o of now) if (!faded.has(o)) { setFaded(o, true); faded.add(o); }
  }

  function update(target, dt) {
    if (override) {
      override.t += dt;
      const k = Math.min(1, override.t / override.duration), e = k * k * (3 - 2 * k);
      camera.position.lerpVectors(override.from, override.to, e);
      camera.lookAt(override.lookFrom.clone().lerp(override.lookAt, e));
      return;
    }
    if (camera.fov !== ISO_FOV) { camera.fov = ISO_FOV; camera.updateProjectionMatrix(); }
    const underground = G.underground?.() ?? false;
    const dist = underground ? Math.min(rig.distance, 17) : rig.distance;
    focus.lerp(new THREE.Vector3(target.x, target.y + 0.6, target.z), 1 - Math.exp(-10 * dt));
    if (focus.distanceTo(target) > 30) focus.set(target.x, target.y + 0.6, target.z); // after a teleport
    const cp = Math.cos(rig.pitch);
    offset.set(Math.sin(rig.yaw) * cp, Math.sin(rig.pitch), Math.cos(rig.yaw) * cp);
    camera.position.copy(focus).addScaledVector(offset, dist);
    if (shake > 0) {
      shake = Math.max(0, shake - dt);
      camera.position.x += (Math.random() - 0.5) * shake * 0.6;
      camera.position.y += (Math.random() - 0.5) * shake * 0.6;
    }
    camera.lookAt(focus);
    if (G.caveUpper) G.caveUpper.visible = false;
    fadeTimer -= dt;
    if (fadeTimer <= 0) { fadeTimer = 0.15; updateFades(focus.clone().setY(focus.y + 0.3)); }
  }

  return {
    rig, update,
    get yaw() { return rig.yaw; },
    shake(amount = 0.4) { shake = Math.max(shake, amount); },
    fly(to, lookAt, duration = 2) {
      const lookFrom = new THREE.Vector3();
      camera.getWorldDirection(lookFrom).multiplyScalar(10).add(camera.position);
      override = { from: camera.position.clone(), to: to.clone(), lookFrom, lookAt: lookAt.clone(), t: 0, duration };
      return new Promise((r) => setTimeout(r, duration * 1000));
    },
    release() { override = null; },
    snap(target) { focus.set(target.x, target.y + 0.6, target.z); },
    clearFades() { for (const o of faded) setFaded(o, false); faded.clear(); },
  };
}
