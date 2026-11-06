import * as THREE from 'three';
import { SEA_LEVEL } from './map.js';
import { groundFields } from './groundFields.js';

// The island's ground: one smooth-shaded mesh on the 1.5 m grid (shared
// vertices, the same triangles and diagonals the collider gets: physics.js
// takes this mesh), painted in the fragment shader of a standard material (so
// shadows, fog and the lights work as before). Sand, rock, roads and cobbles
// sit on the land by blurred masks (groundFields.js) cut at 0.5 with
// low-frequency noise: soft, wavy borders, no saw-tooth. The land carries
// large soft patches and tiny world-space flecks that fade out when they get
// smaller than a few pixels (no shimmer). Colours follow the GDD palette
// (§10.2), as before.
const PALETTE = {
  fleck: '#b9de8a', forestMoss: '#4f6f8f',
  seabed: '#c9b98a', sand: '#f0d9a0', sandLight: '#f6e4b6', wetSand: '#d8bf86',
  rock: '#8d8378', rockDark: '#6d655d', grit: '#5f5851',
  path: '#b98d5a', pathDark: '#a57b4b', cobble: '#a6a3a8', cobbleDark: '#8f8c92',
};

const GROUND_GLSL = /* glsl */ `
varying vec4 vSiMask;
varying vec3 vSiLand;
varying vec3 vSiPos;
varying vec3 vSiNorm;
${Object.keys(PALETTE).map((k) => `uniform vec3 c_${k};`).join('\n')}
float siHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float siNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(siHash(i), siHash(i + vec2(1, 0)), u.x), mix(siHash(i + vec2(0, 1)), siHash(i + vec2(1, 1)), u.x), u.y);
}
float siFbm(vec2 p) { return siNoise(p) * 0.55 + siNoise(p * 2.03 + 7.1) * 0.3 + siNoise(p * 4.1 + 3.7) * 0.15; }
/** Round dots, one chance per cell of 1/k m; gone where a dot gets smaller than a few pixels. */
float siDots(vec2 p, float k, float r, float density, float seed) {
  vec2 q = p * k;
  vec2 c = floor(q);
  float aa = fwidth(q.x) + fwidth(q.y) + 1e-4;
  if (siHash(c + seed) > density) return 0.0;
  vec2 o = vec2(siHash(c + seed + 7.3), siHash(c + seed + 13.1)) * 0.5 + 0.25;
  float d = length(fract(q) - o);
  return (1.0 - smoothstep(r - aa, r + aa, d)) * (1.0 - smoothstep(0.1, 0.3, aa));
}
/** A mask cut at 0.5, the cut moved by noise: a soft border that wanders. */
float siCut(float m, float n, float wobble) { return smoothstep(0.42, 0.58, m + (n - 0.5) * wobble); }

vec3 siGround() {
  vec2 xz = vSiPos.xz;
  float big = siFbm(xz * 0.09);
  float mid = siFbm(xz * 0.45 + 3.1);
  float slope = 1.0 - clamp(normalize(vSiNorm).y, 0.0, 1.0); // 0 flat, 0.23 at 40°

  // land: the region's colour in large soft light patches; on the meadow and
  // the forest floor light flecks and darker leaf marks, moss in the forest
  vec3 land = vSiLand;
  float green = step(land.b * 1.25, land.g); // (meadow and forest, not the village green or the harbor yard)
  float forest = smoothstep(0.12, 0.05, land.r); // (the forest floor is the darkest land)
  land = mix(land, land * 1.2, smoothstep(0.5, 0.8, siFbm(xz * 0.06 + 9.0)) * 0.6);
  land = mix(land, c_forestMoss, smoothstep(0.62, 0.74, big) * forest * 0.4);
  land *= 1.0 + (mid - 0.5) * 0.12;
  land = mix(land, c_fleck * mix(1.0, 0.45, forest), siDots(xz, 1.6, 0.1, 0.45, 1.0) * 0.5 * green);
  land = mix(land, land * 0.72, siDots(xz + 31.0, 1.1, 0.13, 0.3, 5.0) * 0.6 * green);

  // roads: packed earth with darker grit; cobbles in the village
  vec3 road = mix(c_path, c_pathDark, smoothstep(0.4, 0.75, siNoise(xz * 0.7)) * 0.6);
  road = mix(road, c_pathDark * 0.85, siDots(xz, 2.2, 0.12, 0.35, 3.0) * 0.5);
  vec3 cob = mix(c_cobble, c_cobbleDark, smoothstep(0.35, 0.7, siNoise(xz * 1.4)) * 0.7);
  cob = mix(cob * 0.88, cob, siDots(xz, 1.4, 0.38, 1.0, 11.0)); // (stones with darker gaps)
  float cobbled = siCut(vSiMask.w, mid, 0.3);
  road = mix(road, cob, cobbled);
  vec3 col = mix(land, road, max(siCut(vSiMask.z, siNoise(xz * 0.8), 0.25), cobbled));

  // rock on the ridges and steep slopes: two greys in patches, darker grit
  vec3 rock = mix(c_rock, c_rockDark, smoothstep(0.45, 0.65, siFbm(xz * 0.3 + 17.0)));
  rock *= 1.0 + (siNoise(xz * 1.7) - 0.5) * 0.1;
  rock = mix(rock, c_grit, siDots(xz, 1.3, 0.14, 0.4, 7.0) * 0.5);
  col = mix(col, rock, max(siCut(vSiMask.y, big, 0.35), smoothstep(0.5, 0.62, slope + (mid - 0.5) * 0.1)));

  // sand: broad light patches and a fine grain, damp at the water, the seabed below
  vec3 sand = mix(c_sand, c_sandLight, smoothstep(0.45, 0.8, siNoise(xz * 0.25)) * 0.5);
  float aa = fwidth(xz.x) * 5.0;
  sand *= 1.0 + (siNoise(xz * 5.0) - 0.5) * 0.06 * (1.0 - smoothstep(0.2, 0.6, aa));
  float wl = vSiPos.y - ${SEA_LEVEL.toFixed(1)} + (mid - 0.5) * 0.12;
  sand = mix(sand, c_wetSand, 1.0 - smoothstep(0.05, 0.45, wl));
  sand = mix(sand, c_seabed, 1.0 - smoothstep(-0.6, -0.2, wl));
  return mix(col, sand, siCut(vSiMask.x, big, 0.4));
}
`;

export function createIslandMesh() {
  const f = groundFields();
  const { n, step, heights } = f;
  const X = (i) => (-(n - 1) * step) / 2 + i * step;
  const pos = new Float32Array(n * n * 3);
  const land = new Float32Array(n * n * 3);
  const c = new THREE.Color();
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      pos.set([X(i), heights[k], X(j)], k * 3);
      c.setRGB(f.land[k * 3], f.land[k * 3 + 1], f.land[k * 3 + 2], THREE.SRGBColorSpace); // (into the shader's linear light)
      land.set([c.r, c.g, c.b], k * 3);
    }
  }
  // the same two triangles per cell as before, the diagonal alternating like
  // a chequerboard; deep open sea is left out
  const index = [];
  const at = (i, j) => j * n + i;
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      if (Math.max(heights[at(i, j)], heights[at(i + 1, j)], heights[at(i, j + 1)], heights[at(i + 1, j + 1)]) < -6.5) continue;
      if ((i + j) % 2) index.push(at(i, j), at(i, j + 1), at(i + 1, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1));
      else index.push(at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i + 1, j));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('siMask', new THREE.BufferAttribute(f.mask, 4));
  geo.setAttribute('siLand', new THREE.BufferAttribute(land, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 });
  mat.onBeforeCompile = (shader) => {
    for (const [k, hex] of Object.entries(PALETTE)) shader.uniforms[`c_${k}`] = { value: new THREE.Color(hex) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 siMask;\nattribute vec3 siLand;\nvarying vec4 vSiMask;\nvarying vec3 vSiLand;\nvarying vec3 vSiPos;\nvarying vec3 vSiNorm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSiMask = siMask;\nvSiLand = siLand;\nvSiPos = position;\nvSiNorm = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GROUND_GLSL}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= siGround();');
  };
  mat.customProgramCacheKey = () => 'si-ground';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'island';
  mesh.receiveShadow = true;
  return mesh;
}

// A friendly sea with a slow swell; the colour fades into the fog.
export function createSea() {
  const geo = new THREE.CircleGeometry(420, 72).rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: '#3fa6c4', roughness: 0.3, metalness: 0.05, transparent: true, opacity: 0.86,
  }));
  sea.name = 'sea';
  sea.position.y = SEA_LEVEL;
  sea.receiveShadow = true;
  sea.userData.tick = (t) => { sea.position.y = SEA_LEVEL + Math.sin(t * 0.7) * 0.07; };
  return sea;
}
