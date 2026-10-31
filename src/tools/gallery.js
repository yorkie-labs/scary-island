// Character gallery: look at Yorkie and the monsters up close, play each action.
// Open /gallery.html on the dev server.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { stage } from '../vendor/polyfork/stage.mjs';
import { createYorkie, createYorkieAnimator } from '../entities/yorkie.js';
import registerMonsters from './gallery-monsters.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 200);
camera.position.set(1.6, 1.2, 2.6);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.55, 0);
const look = stage(renderer, scene, { time: 'day', shadowSpan: 8 });
const ground = new THREE.Mesh(new THREE.CircleGeometry(6, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e8d6a8' }));
ground.receiveShadow = true;
scene.add(ground);

const entries = [];
export function register(name, object, animate, actions = []) {
  entries.push({ name, object, animate, actions });
}

const yorkie = createYorkie();
const animYorkie = createYorkieAnimator(yorkie);
const yorkieState = { speed: 0, grounded: true, vy: 0, action: null, hidden: false };
register('Yorkie', yorkie, (dt) => {
  if (yorkieState.action) { yorkieState.action.t += dt; if (yorkieState.action.t > yorkieState.action.duration) yorkieState.action = null; }
  animYorkie(dt, yorkieState);
}, [
  ['서기', () => { yorkieState.speed = 0; }],
  ['걷기', () => { yorkieState.speed = 2.2; }],
  ['달리기', () => { yorkieState.speed = 4.6; }],
  ['망치', () => { yorkieState.action = { name: 'swing', t: 0, duration: 0.45 }; }],
  ['구르기', () => { yorkieState.action = { name: 'roll', t: 0, duration: 0.5 }; }],
  ['짖기', () => { yorkieState.action = { name: 'bark', t: 0, duration: 0.6 }; }],
  ['냄새', () => { yorkieState.action = { name: 'sniff', t: 0, duration: 1.2 }; }],
  ['환호', () => { yorkieState.action = { name: 'cheer', t: 0, duration: 1.2 }; }],
]);

registerMonsters(register);

const bar = document.getElementById('bar');
let current = null;
function show(entry) {
  if (current) scene.remove(current.object);
  current = entry;
  scene.add(entry.object);
  look.shadows(entry.object);
  bar.innerHTML = '';
  for (const e of entries) {
    const b = document.createElement('button');
    b.textContent = e.name; b.className = e === entry ? 'on' : '';
    b.onclick = () => show(e); bar.appendChild(b);
  }
  bar.appendChild(document.createElement('br'));
  for (const [label, fn] of entry.actions) {
    const b = document.createElement('button'); b.textContent = label; b.onclick = fn; bar.appendChild(b);
  }
  const box = new THREE.Box3().setFromObject(entry.object);
  const h = box.max.y - box.min.y;
  controls.target.set(0, h * 0.5, 0);
  camera.position.set(h * 1.5, h * 1.1, h * 2.5);
}
show(entries[Number(new URLSearchParams(location.search).get('i') ?? 0)] ?? entries[0]);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  current.animate(dt);
  controls.update();
  look.update();
  renderer.render(scene, camera);
});
window.gallery = { entries, show };
