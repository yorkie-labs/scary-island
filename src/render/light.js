// Cozy look (tasks/20261106-cozy-look-todo.md): the island's light, on top
// of the Polyfork stage's rig (vendor/polyfork/stage.mjs), whose colours and
// strengths still follow each region's time of day (REGION_TIME).
// - the key shines from the camera's front-left, high (shadowbox.js toKey),
//   so what faces the viewer (ridge fronts, Yorkie's face, props) is lit and
//   the shadows fall up the screen, away from the viewer
// - soft shadows (`shadow.intensity` < 1: the fill shows through, so a
//   shadow reads soft blue, not black) in a box that follows Yorkie, sized
//   from the view's ground corners and snapped to the texel grid
// - the hemisphere tilted a little: its sky cooler, its ground warmer (the
//   sides and undersides warm-dark, the shadows cool), each time the stage
//   sets a new time of day, at the same brightness
// Ported from secret-cave's render/light.js (a cave: always night).
import * as THREE from 'three';
import { shadowBounds, snapToTexel, toKey, viewDrop, viewGroundCorners } from './shadowbox.js';

/** The tints (× each channel, then back to the same brightness) and the shadows. */
export const ISLAND_RIG = {
  sky: [0.88, 0.96, 1.18], // cooler: the shadows are lit a soft blue
  ground: [1.14, 1.0, 0.84], // warmer: sides and undersides warm-dark, not grey
  shadow: 0.62, // how dark a shadow is (1 = only the fill)
  elevation: [30, 50], // ° the key stands above the horizon: the stage's sun height for the time of day, kept in this range
};
/** The key's height (°) for the stage's sun height `stageElev` (low at dusk: longer shadows up the screen). */
export const keyElevation = (stageElev = 50) => Math.min(ISLAND_RIG.elevation[1], Math.max(ISLAND_RIG.elevation[0], stageElev));
const KEY_DIST = 120; // m from the box centre to the light
const MAX_DROP = 16; // m below the focus the box makes room for (ridges, the harbor below the village)

export const lum = (c) => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
/** `c` tinted (× `[r, g, b]`), then brought back to its own brightness. */
export function tintColor(c, [r, g, b]) {
  const l0 = lum(c);
  c.setRGB(c.r * r, c.g * g, c.b * b);
  const l1 = lum(c);
  if (l1 > 0) c.multiplyScalar(l0 / l1);
  return c;
}

/**
 * Takes the stage's key light over: its direction and shadow box, and tilts
 * the hemisphere at every `look.setTime`. `update(feet, view, heightAt)` each
 * frame after `look.update()`: `feet` where the lens looks, `view` the lens
 * ({ dist, pitch, yaw, fovDeg, aspect }, shadowbox.js), `heightAt(x, z)` the
 * ground's height (null: the focus's own level only).
 */
export function islandLight(look, { quality = 'high' } = {}) {
  const { key, hemi } = look;
  const tilt = () => {
    tintColor(hemi.color, ISLAND_RIG.sky);
    tintColor(hemi.groundColor, ISLAND_RIG.ground);
  };
  let TO = null;
  const dir = new THREE.Vector3();
  const aim = () => {
    TO = toKey(keyElevation(look.elevation));
    dir.set(TO.x, TO.y, TO.z);
  };
  const setTime = look.setTime;
  look.setTime = (v) => { const r = setTime(v); tilt(); aim(); return r; };
  tilt(); aim();

  let mapSize = 0;
  const box = { left: 0, right: 0, bottom: 0, top: 0 };
  const setQuality = (q) => {
    const size = q === 'low' ? 1024 : 2048;
    if (size === mapSize) return;
    mapSize = size;
    key.shadow.mapSize.set(mapSize, mapSize);
    key.shadow.map?.dispose(); key.shadow.map = null; // (made again at the new size)
    out.mapSize = mapSize;
    Object.assign(box, { left: 0, right: 0, bottom: 0, top: 0 }); // (the bias is set again for the new texels)
  };
  key.shadow.intensity = ISLAND_RIG.shadow;
  key.shadow.bias = 0;
  key.shadow.radius = 3;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = KEY_DIST * 2 + 40;
  const center = new THREE.Vector3();
  const out = {
    box, toKey: dir, mapSize, setQuality,
    update(feet, view, heightAt = null) {
      const focus = { x: feet.x, y: feet.y + 0.6, z: feet.z };
      const drop = Math.max(0.6, heightAt ? viewDrop(view, focus, heightAt, { max: MAX_DROP }) : 0);
      const need = shadowBounds(viewGroundCorners(view, drop).map((c) => ({ x: c.x, y: c.y + 0.6, z: c.z })), TO);
      // each side grows at once and shrinks only when well inside (a ridge
      // walked along does not flip the texel size back and forth)
      let changed = false;
      for (const [k, s] of [['left', -1], ['right', 1], ['bottom', -1], ['top', 1]]) {
        if (s * need[k] > s * box[k] || s * need[k] < s * box[k] - 4) { box[k] = need[k]; changed = true; }
      }
      if (changed) {
        Object.assign(key.shadow.camera, box);
        key.shadow.camera.updateProjectionMatrix();
        key.shadow.normalBias = (Math.max(box.right - box.left, box.top - box.bottom) / mapSize) * 1.5;
      }
      const s = snapToTexel(feet, TO, (box.right - box.left) / mapSize, (box.top - box.bottom) / mapSize);
      center.set(s.x, s.y, s.z);
      key.target.position.copy(center);
      key.position.copy(center).addScaledVector(dir, KEY_DIST);
      key.target.updateMatrixWorld();
    },
  };
  setQuality(quality);
  return out;
}
