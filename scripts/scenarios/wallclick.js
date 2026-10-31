// Stand near a ridge and click ordinary ground just beyond the crest line and
// on our own side: every click should land where it was aimed.
const canvas = G.renderer.domElement;
const screenOf = (v) => { const p = v.clone().project(G.camera); const r = canvas.getBoundingClientRect(); return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height]; };
await start(true); await wait(300); await skip();
const tests = [
  // near the camp|village ridge (x≈32), standing on the camp side
  { at: [27, 12], aim: [22, 4] }, { at: [27, 12], aim: [20, 16] }, { at: [27, 12], aim: [25, 0] },
  // near the beach|camp ridge (z≈50), standing on the camp side
  { at: [12, 44], aim: [6, 36] }, { at: [12, 44], aim: [16, 38] },
];
let good = 0;
for (const t of tests) {
  await go(t.at[0], t.at[1]); await wait(400);
  const v = new THREE.Vector3(t.aim[0], G.groundAt(t.aim[0], t.aim[1]), t.aim[1]);
  const [x, y] = screenOf(v);
  canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true })); await wait(120);
  const h = G.pointer.pick();
  const err = h?.pos ? Math.hypot(h.pos.x - v.x, h.pos.z - v.z) : 99;
  if (err < 1.5) good++;
  log.push(['aim', t.aim, 'picked', h?.kind, h?.pos ? [+h.pos.x.toFixed(1), +h.pos.z.toFixed(1)] : null, 'err', +err.toFixed(2)]);
}
log.push(['on target', good, 'of', tests.length]);
return log;
