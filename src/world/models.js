import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { heightAt } from './map.js';

// Polyfork models used on the island, by short key. `body` decides physics:
// static (trimesh from its own triangles), box (cheap box), dynamic (pushable),
// none (visual only). Free low-poly assets: https://polyfork.dev/assets
export const MODELS = {
  // Lost Beach (Pirate Cove kit, Coast & Boardwalk kit)
  palm: { id: 'palm-tree-a307da', body: 'trunk' },
  palmSapling: { id: 'palm-sapling-ef7ae4', body: 'none' },
  fern: { id: 'tropical-fern-bush-c70147', body: 'none' },
  coastalBoulder: { id: 'large-coastal-boulder-a2cab1', body: 'static' },
  smallRock: { id: 'small-rock-457be8', body: 'static' },
  driftwood: { id: 'driftwood-log-90340b', body: 'static' },
  wreck: { id: 'wrecked-hull-section-ca6755', body: 'static' },
  seaStack: { id: 'sea-stack-369791', body: 'static' },
  beachGrass: { id: 'beach-grass-tuft-0e699f', body: 'none' },
  campfire: { id: 'campfire-4390aa', body: 'none' },
  chest: { id: 'treasure-chest-c2ac4f', body: 'static' },
  barrel: { id: 'barrel-8d63c4', body: 'dynamic', mass: 20 },
  crate: { id: 'cargo-crate-9afc44', body: 'dynamic', mass: 15 },
  ropeCoil: { id: 'rope-coil-776dcc', body: 'none' },
  anchor: { id: 'ship-anchor-c2b4f1', body: 'static' },
  rowboat: { id: 'rowboat-c42d85', body: 'static' },
  shells: { id: 'shell-scatter-6d36b7', body: 'none' },
  crab: { id: 'shore-crab-6889f5', body: 'none' },
  signpost: { id: 'signpost-ed3d77', body: 'static' },
  sandcastle: { id: 'sandcastle-ddc562', body: 'none' },
  torch: { id: 'torch-stake-d82a2c', body: 'none' },
  // Central Camp (Nature & Forest kit, Pirate Cove parrot)
  tent: { id: 'camp-tent-3c5c89', body: 'static' },
  cookTripod: { id: 'campfire-cook-tripod-d95a1e', body: 'static' },
  firewood: { id: 'firewood-stack-8a2899', body: 'static' },
  leanTo: { id: 'lean-to-shelter-f0709f', body: 'static' },
  picnicTable: { id: 'campsite-picnic-table-361d51', body: 'static' },
  parrot: { id: 'cove-parrot-17850c', body: 'none' },
  trailSign: { id: 'trail-signpost-bd29a7', body: 'static' },
  lantern: { id: 'lantern-post-f47665', body: 'static' },
  stump: { id: 'tree-stump-ec3f48', body: 'static' },
  // Whispering Forest (Nature & Forest kit, mushrooms, statues)
  pine: { id: 'tall-pine-tree-ab4108', body: 'trunk' },
  youngPine: { id: 'young-pine-0d7695', body: 'trunk' },
  oak: { id: 'broadleaf-oak-997c22', body: 'trunk' },
  deadTree: { id: 'dead-tree-6795fa', body: 'trunk' },
  birch: { id: 'birch-tree-181b33', body: 'trunk' },
  fallenLog: { id: 'fallen-log-1685fb', body: 'static' },
  fernPlant: { id: 'fern-plant-1559b8', body: 'none' },
  toadstool: { id: 'toadstool-257a4a', body: 'none' },
  bonnet: { id: 'glowing-bonnet-mushroom-13f518', body: 'trunk' },
  puffball: { id: 'puffball-mushroom-3b1324', body: 'trunk' },
  mushCluster: { id: 'giant-mushroom-cluster-868de6', body: 'none' },
  fence: { id: 'wooden-fence-section-5f04b7', body: 'static' },
  cabin: { id: 'log-cabin-4fac3b', body: 'static' },
  woodshed: { id: 'open-woodshed-050a0a', body: 'static' },
  choppingBlock: { id: 'chopping-block-073b5e', body: 'static' },
  mossBoulder: { id: 'fern-covered-boulder-2e0375', body: 'static' },
  rockSpire: { id: 'rock-spire-13819c', body: 'static' },
  knightStatue: { id: 'standing-knight-statue-8bdcc9', body: 'none' },
  founderStatue: { id: 'founder-s-statue-71c269', body: 'none' },
  lionStatue: { id: 'guardian-lion-statue-5bde18', body: 'none' },
  angelStatue: { id: 'weeping-stone-angel-644ce3', body: 'none' },
  rabbit: { id: 'forest-rabbit-ea2da0', body: 'none' },
  generator: { id: 'site-generator-298792', body: 'static' },
  // Diamond Mine
  headframe: { id: 'mine-headframe-735cf4', body: 'static' },
  mineRail: { id: 'mine-rail-run-d4404c', body: 'none' },
  mineCart: { id: 'mine-cart-21d7f0', body: 'none' },
  crystalCluster: { id: 'crystal-cluster-624138', body: 'static' },
  geode: { id: 'mineral-geode-cluster-299927', body: 'static' },
  minerShack: { id: 'miner-s-shack-68b196', body: 'static' },
  oreChute: { id: 'ore-chute-and-bin-8375ac', body: 'static' },
  timberCrate: { id: 'timber-crate-ba0739', body: 'dynamic', mass: 12 },
  hoodedLantern: { id: 'hooded-lantern-b60021', body: 'none' },
  // Statue Village (Medieval Village kit, Rapa Nui moai)
  chapel: { id: 'stone-chapel-03e774', body: 'static' },
  house2: { id: 'two-story-house-40f6dc', body: 'static' },
  cottage: { id: 'thatched-cottage-0e63f5', body: 'static' },
  villageWell: { id: 'village-well-f8e361', body: 'static' },
  watchtower: { id: 'watchtower-140f78', body: 'static' },
  lowWall: { id: 'low-stone-wall-8a8ea3', body: 'static' },
  lampPost: { id: 'lamp-post-c9e409', body: 'static' },
  marketStall: { id: 'market-stall-94937d', body: 'static' },
  ruin: { id: 'ruined-gable-end-834895', body: 'static' },
  moai: { id: 'standing-moai-caa54f', body: 'none' },
  fountain: { id: 'plaza-fountain-5a5f6e', body: 'static' },
  runeStone: { id: 'glowing-rune-stone-5a5558', body: 'static' },
  oakVillage: { id: 'oak-tree-50ee7c', body: 'trunk' },
  // Escape Harbor (Pirate Cove, Coast kits)
  pier: { id: 'pier-deck-section-7047d7', body: 'static' },
  pierCorner: { id: 'pier-deck-corner-c56248', body: 'static' },
  pierStair: { id: 'pier-access-stair-7369dc', body: 'static' },
  mooring: { id: 'mooring-post-2b83a4', body: 'static' },
  dockLantern: { id: 'dock-lantern-post-5e58a4', body: 'static' },
  lighthouse: { id: 'old-lighthouse-48ca6c', body: 'static' },
  fisherShack: { id: 'fisherman-shack-ea9b2b', body: 'static' },
  boatShed: { id: 'shipwright-boat-shed-9cbbc1', body: 'static' },
  sloop: { id: 'pirate-sloop-d8ead0', body: 'none' },
  sloopHull: { id: 'pirate-sloop-hull-89cd04', body: 'none' },
  netRack: { id: 'drying-net-rack-93ec3b', body: 'static' },
  lobsterPots: { id: 'lobster-pot-stack-d870f0', body: 'static' },
};

const loader = new GLTFLoader();
const sources = new Map();
const base = import.meta.env?.BASE_URL ?? '/';
// Dev: the local copies from `npm run fetch-assets`. Production: Polyfork's CDN
// (see vite.config.js for why), unless self-hosting was explicitly enabled.
const fromCdn = !import.meta.env?.DEV && import.meta.env?.VITE_SELF_HOST_MODELS !== '1';
export const modelUrl = (id) => (fromCdn ? `https://polyfork.dev/cdn/${id}.glb` : `${base}assets/polyfork/${id}.glb`);

export async function loadModels(keys, onProgress) {
  const ids = [...new Set(keys.map((k) => MODELS[k]?.id ?? k))].filter((id) => !sources.has(id));
  let done = 0;
  await Promise.all(ids.map(async (id) => {
    const gltf = await loader.loadAsync(modelUrl(id));
    sources.set(id, bake(gltf.scene));
    onProgress?.(++done, ids.length);
  }));
}

// A model as one mesh per material (its parts' transforms baked in), so each
// copy on the island is a handful of objects, not dozens: a fern-covered
// boulder was 27 nodes and 13 draws (×3 with the shadow and AO passes), and
// three.js walks every node every frame. Rigged models are left as they are
// (their bones move the parts). Parts with several materials stay apart.
export function bake(src) {
  let skinned = false;
  src.traverse((o) => { if (o.isSkinnedMesh) skinned = true; });
  if (skinned) return src;
  src.updateMatrixWorld(true);
  const toRoot = src.matrixWorld.clone().invert();
  const byMat = new Map(), loose = [];
  src.traverse((o) => {
    if (!o.isMesh) return;
    if (Array.isArray(o.material)) { loose.push(o); return; }
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(o);
  });
  const out = new THREE.Group();
  out.name = src.name;
  out.userData = { ...src.userData };
  const m = new THREE.Matrix4();
  const merge = (meshes) => {
    const names = meshes.map((o) => new Set(Object.keys(o.geometry.attributes)));
    const keep = [...names[0]].filter((k) => names.every((n) => n.has(k)));
    const indexed = meshes.every((o) => o.geometry.index);
    const geos = meshes.map((o) => {
      let g = o.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
      for (const k of Object.keys(g.morphAttributes)) delete g.morphAttributes[k];
      if (!indexed && g.index) g = g.toNonIndexed();
      g.clearGroups();
      return g.applyMatrix4(m.multiplyMatrices(toRoot, o.matrixWorld));
    });
    return geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
  };
  for (const [material, meshes] of byMat) {
    const geo = merge(meshes);
    if (!geo) { loose.push(...meshes); continue; } // (parts that would not merge: kept apart)
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = meshes.length === 1 ? meshes[0].name : material.name;
    out.add(mesh);
  }
  for (const o of loose) {
    const mesh = new THREE.Mesh(o.geometry.clone().applyMatrix4(m.multiplyMatrices(toRoot, o.matrixWorld)), o.material);
    mesh.name = o.name;
    out.add(mesh);
  }
  return out;
}

export function instance(key) {
  const id = MODELS[key]?.id ?? key;
  const src = sources.get(id);
  if (!src) throw new Error(`model not loaded: ${key}`);
  // rigged models (animals, characters) need their bones cloned too, or the
  // copy keeps drawing with the original's skeleton, somewhere else or nowhere
  let skinned = false;
  src.traverse((o) => { if (o.isSkinnedMesh) skinned = true; });
  const copy = skinned ? cloneSkinned(src) : src.clone(true);
  if (skinned) copy.traverse((o) => { if (o.isSkinnedMesh) o.frustumCulled = false; });
  return copy;
}

// Places a catalog model on the ground and gives it its physics.
// opts: { y, ry, s (scale, only for "bigger than life" hero props), body }
export function place(G, key, x, z, opts = {}) {
  const def = MODELS[key] ?? { body: 'static' };
  const obj = instance(key);
  obj.name = key;
  if (opts.s) obj.scale.setScalar(opts.s);
  obj.rotation.y = opts.ry ?? 0;
  const y = opts.y ?? groundUnder(x, z, obj);
  obj.position.set(x, y + (opts.lift ?? 0), z);
  (opts.parent ?? G.scene).add(obj);
  G.look.shadows(obj);
  const body = opts.body ?? def.body;
  if (body === 'static') G.physics.addStatic(obj);
  else if (body === 'dynamic') G.physics.addDynamic(obj, { mass: def.mass ?? 10 });
  else if (body === 'trunk') {
    const s = opts.s ?? 1;
    G.physics.addCapsule(x, y, z, { radius: 0.3 * s, height: 3 * s });
  } else if (body === 'box') G.physics.addBox(obj);
  return obj;
}

const box = new THREE.Box3(), size = new THREE.Vector3();
// Lowest ground under the footprint so nothing floats on a slope.
export function groundUnder(x, z, obj) {
  box.setFromObject(obj).getSize(size);
  const hx = Math.min(size.x, 6) * 0.35, hz = Math.min(size.z, 6) * 0.35;
  return Math.min(heightAt(x, z), heightAt(x + hx, z + hz), heightAt(x - hx, z + hz), heightAt(x + hx, z - hz), heightAt(x - hx, z - hz));
}
