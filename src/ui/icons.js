import * as THREE from 'three';
import * as items from '../world/items.js';

// Icons drawn from the game's own models (Diablo II's inventory shows the item
// itself, not a symbol): each is rendered once, in a small separate renderer,
// to a picture the HUD and the shop use as <img>. What has no model in the
// world (the shop's bag and shoes) gets a little one here, in the same style.

const SIZE = 96;

function backpack() {
  const g = new THREE.Group();
  g.add(items.part(new THREE.BoxGeometry(0.34, 0.4, 0.2), '#3fa34d', { y: 0.2 }));
  g.add(items.part(new THREE.BoxGeometry(0.26, 0.16, 0.08), '#2f8a3c', { y: 0.12, z: 0.13 }));
  g.add(items.part(new THREE.BoxGeometry(0.36, 0.08, 0.22), '#2f8a3c', { y: 0.42 }));
  g.add(items.part(new THREE.TorusGeometry(0.07, 0.02, 4, 10, Math.PI), '#8a5a3c', { y: 0.47 }));
  return g;
}

function sneaker() {
  const g = new THREE.Group();
  g.add(items.part(new THREE.BoxGeometry(0.42, 0.06, 0.16), '#f2f2f2', { y: 0.03 }));
  g.add(items.part(new THREE.BoxGeometry(0.34, 0.12, 0.15), '#ff6b6b', { x: -0.03, y: 0.12 }));
  g.add(items.part(new THREE.BoxGeometry(0.14, 0.1, 0.15), '#ff6b6b', { x: -0.12, y: 0.22 }));
  g.add(items.part(new THREE.BoxGeometry(0.03, 0.03, 0.16), '#fff27a', { x: 0.06, y: 0.16 }));
  return g;
}

// name -> how to build it, a turn that shows it best, and how close to frame it
const MODELS = {
  diamond: [() => items.diamond(0.2), 0.4, 1.4], // flat and wide: closer, or it reads tiny
  potion: [items.potion, 0.3],
  treat: [items.treat, 0.5],
  bone: [() => { const t = items.treat(); t.traverse((o) => { if (o.isMesh) o.material = items.mat('#ffd34d', { emissive: '#ffb020', emissiveIntensity: 0.35 }); }); return t; }, 0.5],
  key: [items.key, 0.3],
  scissors: [items.scissors, 0.2],
  flashlight: [items.flashlight, 0.7],
  hammer: [items.hammerPickup, 0.6],
  engine: [items.enginePart, 0.7],
  fuel: [items.fuelCan, 0.6],
  crystal: [() => items.energyCrystal(0.3), 0.4, 1.15],
  shipKey: [items.shipKey, 0.3],
  bag: [backpack, 0.6],
  shoes: [sneaker, 0.7],
};

let urls = null;

function renderAll() {
  urls = {};
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  } catch { return; } // no second 3D context: the HUD keeps its emoji
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff8ec', '#5a4a6a', 2.2));
  const sun = new THREE.DirectionalLight('#ffffff', 2.4);
  sun.position.set(1.5, 2.5, 2);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  for (const [name, [build, turn, zoom = 1]] of Object.entries(MODELS)) {
    const model = build();
    model.rotation.y += turn;
    model.rotation.x += 0.25;
    model.traverse((o) => { if (o.userData?.isOutline) o.visible = true; });
    scene.add(model);
    // frame it: centred, filling most of the picture
    const box = new THREE.Box3().setFromObject(model);
    const c = box.getCenter(new THREE.Vector3()), r = box.getBoundingSphere(new THREE.Sphere()).radius;
    camera.position.set(c.x, c.y + r * 0.35, c.z + ((r / Math.sin(THREE.MathUtils.degToRad(15))) * 0.92) / zoom);
    camera.lookAt(c);
    renderer.render(scene, camera);
    urls[name] = renderer.domElement.toDataURL('image/png');
    scene.remove(model);
  }
  renderer.dispose();
  renderer.forceContextLoss();
}

// an <img> of the item (or the emoji it stood for, if icons can't be drawn)
export function icon(name, fallback = '', cls = 'ico') {
  if (!urls) renderAll();
  const url = urls[name];
  return url ? `<img class="${cls}" src="${url}" alt="" draggable="false">` : fallback;
}
