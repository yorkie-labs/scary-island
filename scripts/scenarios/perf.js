// Where a frame's time goes (tasks/20261106-cozy-look-todo.md, 3rd pass):
// at a few spots, the mean and 95th-percentile frame time with each part of
// the look switched off in turn. Run uncapped, so the numbers are real:
//   UNCAPPED=1 [DPR=2] node scripts/e2e.mjs scripts/scenarios/perf.js <dir>
// (`?q=low` is not needed: the scenario switches the quality itself.)
async function frames(ms = 2500) {
  const times = [];
  let last = performance.now();
  const end = last + ms;
  await new Promise((done) => {
    const tick = (now) => { times.push(now - last); last = now; if (now < end) requestAnimationFrame(tick); else done(); };
    requestAnimationFrame(tick);
  });
  times.splice(0, 5);
  const sorted = [...times].sort((a, b) => a - b);
  return { ms: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(2), p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2) };
}
await start(false); await wait(500); await skip(); await wait(300); await skip();
G.state.hearts = 99;
const post = G.post, key = G.look.key;
let msaa = 0;
// each case: switch something off, measure, switch it back
const cases = [
  ['high (all on)', () => {}, () => {}],
  ['no AO', () => { post.ao.enabled = false; }, () => { post.ao.enabled = true; }],
  ['AO not transparencyAware', () => { post.ao.configuration.transparencyAware = false; }, () => { post.ao.configuration.transparencyAware = true; }],
  ['no shadows', () => { key.castShadow = false; }, () => { key.castShadow = true; }],
  ['no MSAA', () => { msaa = post.composer.multisampling; post.composer.multisampling = 0; }, () => { post.composer.multisampling = msaa; }],
  ['low', () => G.setQuality('low'), () => G.setQuality('high')],
  ['plain render (no post at all)', () => { G.post._render = post.render; post.render = () => G.renderer.render(G.scene, G.camera); }, () => { post.render = G.post._render; }],
];
log.push(['dpr', devicePixelRatio, 'canvas', G.renderer.domElement.width, G.renderer.domElement.height]);
// CPU: the ground lookups the shadow box makes each frame (render/light.js viewDrop)
{ const t0 = performance.now(); let s = 0; for (let i = 0; i < 6400; i++) s += G.groundAt(i % 80 - 40, (i / 80 | 0) - 40); log.push(['groundAt µs/call', +((performance.now() - t0) / 6400 * 1000).toFixed(2), s > 0]); }
for (const [name, x, z, y] of [['camp', -2, 24], ['forest', -50, 8], ['village', 60, -6]]) {
  await go(x, z, y); await wait(6000);
  for (const [label, off, on] of cases) {
    off(); await wait(400);
    log.push([name, label, await frames()]);
    on(); await wait(300);
  }
}
return log;
