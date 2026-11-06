// Cozy look (tasks/20261106-cozy-look-todo.md): the same spots in every
// region and Yorkie up close, for before/after screenshots, plus frame
// timing. Run with GAME_URL='http://localhost:5179/?tag=after' (the tag
// prefixes the shots), '&q=low' for the low quality, SIZE=1600x900 for 16:9,
// '&only=yorkie' for Yorkie's close-ups alone.
const q = new URLSearchParams(location.search);
const tag = q.get('tag') ?? 'shot';
const onlyYorkie = q.get('only') === 'yorkie';
// per frame: fps, the 95th-percentile frame time and the draw calls of one
// frame (all passes: shadows, post-processing)
async function perf(ms = 3000) {
  const info = G.renderer.info;
  info.autoReset = false;
  const times = [], calls = [];
  let last = performance.now();
  const end = last + ms;
  await new Promise((done) => {
    const tick = (now) => {
      times.push(now - last); last = now;
      calls.push(info.render.calls); info.reset();
      if (now < end) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });
  info.autoReset = true;
  times.shift(); calls.shift();
  const sorted = [...times].sort((a, b) => a - b);
  return { fps: +(1000 / (times.reduce((a, b) => a + b, 0) / times.length)).toFixed(1), p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1), calls: Math.max(...calls) };
}
await start(false); await wait(500); await skip(); await wait(300); await skip();
G.state.hearts = 99; // (nothing ends the walk)
const spots = [
  ['beach', 2, 74], ['camp', -2, 24], ['forest', -50, 8], ['village', 60, -6], ['harbor', 60, 66],
];
for (const [name, x, z] of onlyYorkie ? [] : spots) {
  await go(x, z); await wait(8000); // (each region's light drifts in)
  await shot(`${tag}-${name}`);
  log.push([name, await perf()]);
}
// the mine (underground, night)
if (!onlyYorkie) {
  await go(600, 0, 0); await wait(8000); await shot(`${tag}-mine`);
  log.push(['mine', await perf()]);
}
// Yorkie up close at the camp (golden hour): front, three-quarter, side, from far
await go(-2, 24); await wait(8000);
P.state.heading = Math.PI / 4; // facing the default lens
await wait(600);
const p = P.position;
const at = new THREE.Vector3(p.x, p.y + 0.55, p.z);
for (const [name, ang, d, h] of [['front', Math.PI / 4, 2.2, 0.9], ['34', Math.PI / 4 + 0.75, 2.2, 0.9], ['side', Math.PI / 4 + Math.PI / 2, 2.2, 0.7], ['game', Math.PI / 4, 9, 6]]) {
  const to = new THREE.Vector3(p.x + Math.sin(ang) * d, p.y + h, p.z + Math.cos(ang) * d);
  G.cam.fly(to, at, 0.01); await wait(500);
  await shot(`${tag}-yorkie-${name}`);
}
G.cam.release();
// from the game's lens at dusk and at night: does Yorkie stand out from the ground?
for (const [name, x, z, y] of [['forest', -50, 8], ['mine', 600, 0, 0]]) {
  await go(x, z, y); G.cam.zoom(0.01); await wait(8000);
  await shot(`${tag}-yorkie-${name}`);
  G.cam.zoom(100);
}
log.push(['quality', G.quality ?? 'none']);
return log;
