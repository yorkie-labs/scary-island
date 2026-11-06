// Cozy look (tasks/20261106-cozy-look-todo.md): the island's post-processing
// (pmndrs postprocessing + N8AO), ported from secret-cave's render/post.js:
//   high: render (MSAA: 4×, 2× on a dense screen) → N8AO contact shadows (half res, cool blue) →
//         one effect pass: bloom (only what glows: lamps, the campfire, the
//         flashlight, glowing mushrooms, gems), the colour grade, a vignette;
//   low (`?q=low`): render (MSAA) → grade + vignette (no AO, no bloom).
// No tone mapping: the Polyfork models were made for plain sRGB output (ACES
// washed them out here); the grade is a gentle look instead.
// Transparent things (glows, the sea, faded trees) write no depth or are
// see-through, and `transparencyAware` keeps N8AO from darkening what lies
// beneath them a second time.
import * as THREE from 'three';
import { BlendFunction, BloomEffect, Effect, EffectComposer, EffectPass, RenderPass, VignetteEffect } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

/** `?q=low`: no AO, no bloom, a smaller shadow map (slow machines). */
export function qualityFromUrl(search) {
  return new URLSearchParams(search).get('q') === 'low' ? 'low' : 'high';
}

/**
 * The quality a page starts with: `?q=low|high` in the address first, else
 * what the menu's 화질 toggle saved, else low on a phone or a small tablet (a
 * touch screen whose short side is at most `SMALL` css px: full AO and bloom
 * cost them too much) and high everywhere else.
 */
export const QUALITY_KEY = 'scary-island-quality';
export const SMALL = 820;
export function chooseQuality({ search = '', saved = null, touch = false, shortSide = Infinity } = {}) {
  const q = new URLSearchParams(search).get('q');
  if (q === 'low' || q === 'high') return q;
  if (saved === 'low' || saved === 'high') return saved;
  return touch && shortSide <= SMALL ? 'low' : 'high';
}

// Cozy grade in linear light: a little more saturation, the shadows lifted
// towards a soft lavender blue (no crushed blacks at night), the highlights
// warmed a touch.
const GRADE_FRAG = /* glsl */ `
uniform float saturation;
uniform vec3 lift;
uniform vec3 warm;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = max(inputColor.rgb, 0.0);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, saturation);
  c = c * (1.0 - lift) + lift;
  c *= mix(vec3(1.0), warm, smoothstep(0.2, 0.9, l));
  outputColor = vec4(c, inputColor.a);
}
`;

/** MSAA samples for a pixel ratio: 4 on a 1× screen, 2 on a denser one. */
export const msaaFor = (pixelRatio) => (pixelRatio > 1.01 ? 2 : 4);

/** The grade's numbers (linear light), shared with the tests. */
export const GRADE = { saturation: 1.1, lift: [0.008, 0.008, 0.02], warm: [1.04, 1.0, 0.95] };

class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', GRADE_FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ['saturation', new THREE.Uniform(GRADE.saturation)],
        ['lift', new THREE.Uniform(new THREE.Vector3(...GRADE.lift))],
        ['warm', new THREE.Uniform(new THREE.Vector3(...GRADE.warm))],
      ]),
    });
  }
}

/**
 * The composer for one renderer. `render(dt, scene, camera, plain)` draws a
 * frame of whatever scene and lens it is given, through the same buffers.
 */
export function createPost(renderer, scene, camera, quality) {
  // (4× MSAA on a 1× screen; on a denser one 2× is enough: the pixels are smaller, and it halves the cost)
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: msaaFor(renderer.getPixelRatio()) });
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  // (the menu's 화질 toggle switches live: the high chain's AO and bloom are
  // made the first time they are wanted, and each quality has its own effect
  // pass; only the current one is on)
  let ao = null, bloom = null, highPass = null, lowPass = null;
  const makeAo = () => {
    const size = renderer.getSize(new THREE.Vector2());
    ao = new N8AOPostPass(lastScene, lastCamera, size.x, size.y);
    ao.setQualityMode('Low');
    Object.assign(ao.configuration, {
      halfRes: true,
      depthAwareUpsampling: true,
      aoRadius: 2.0,
      distanceFalloff: 1.0,
      intensity: 3.5,
      color: new THREE.Color('#252a4a'), // cool, not black: soft blue contact shadows
      gammaCorrection: false,
      transparencyAware: true, // (the glows lift the AO under them; see the top)
    });
    composer.addPass(ao, 1); // (right after the render)
  };
  const makeHigh = () => {
    bloom = new BloomEffect({ luminanceThreshold: 0.95, luminanceSmoothing: 0.1, intensity: 0.5, mipmapBlur: true, radius: 0.6 });
    highPass = new EffectPass(lastCamera, bloom, new GradeEffect(), new VignetteEffect({ offset: 0.3, darkness: 0.45 }));
    highPass.renderToScreen = true;
    composer.addPass(highPass, composer.passes.indexOf(plainPass));
  };
  const makeLow = () => {
    lowPass = new EffectPass(lastCamera, new GradeEffect(), new VignetteEffect({ offset: 0.3, darkness: 0.45 }));
    lowPass.renderToScreen = true;
    composer.addPass(lowPass, composer.passes.indexOf(plainPass));
  };
  // `plain`: the same multisampled render, straight out (no AO, no bloom, no
  // grade, no vignette; an effect pass with no effects is a copy with the
  // output colour space)
  const plainPass = new EffectPass(camera);
  plainPass.enabled = false;
  plainPass.renderToScreen = true; // (only one pass out is on at a time)
  composer.addPass(plainPass);
  let lastScene = scene, lastCamera = camera, wasPlain = false;
  function apply() {
    const high = post.quality === 'high';
    if (high && !ao) makeAo();
    if (high && !highPass) makeHigh();
    if (!high && !lowPass) makeLow();
    if (ao) ao.enabled = high && !wasPlain;
    if (highPass) highPass.enabled = high && !wasPlain;
    if (lowPass) lowPass.enabled = !high && !wasPlain;
    plainPass.enabled = wasPlain;
    post.ao = ao; post.bloom = bloom;
  }
  const post = {
    quality, composer, ao, bloom,
    /** One frame of `s` seen by `c` (the game's by default); `plain`: no effects (see above). */
    render(dt, s = scene, c = camera, plain = false) {
      if (s !== lastScene || c !== lastCamera) {
        lastScene = s; lastCamera = c;
        renderPass.mainScene = s; renderPass.mainCamera = c;
        if (ao) { ao.scene = s; ao.camera = c; }
        for (const p of [highPass, lowPass, plainPass]) if (p) p.mainCamera = c;
      }
      if (plain !== wasPlain) { wasPlain = plain; apply(); }
      composer.render(dt);
    },
    /** 'high' | 'low', live (the menu's 화질 toggle). */
    setQuality(q) {
      if (q !== 'high' && q !== 'low') return;
      post.quality = q;
      apply();
      if (ao) { ao.scene = lastScene; ao.camera = lastCamera; }
      for (const p of [highPass, lowPass]) if (p) p.mainCamera = lastCamera;
    },
    setSize: (w, h) => composer.setSize(w, h),
  };
  apply();
  return post;
}
