const canvas = G.renderer.domElement;
const screenOf = (v) => { const p = v.clone().project(G.camera); const r = canvas.getBoundingClientRect(); return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height]; };
await start(true); await wait(300); await skip();
await goMark('elevator', 1); await use(); await wait(2000); await skip();
const C = (cx, cz) => new THREE.Vector3(600 + cx * 2 + 1, 0, cz * 2 + 1);
let good = 0; const aims = [C(-3, -2), C(2, -1), C(-1, -10), C(0, -18), C(-3, 2), C(3, 3)];
for (const v of aims) {
  const [x, y] = screenOf(v);
  canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true })); await wait(120);
  const h = G.pointer.pick();
  const err = h?.pos ? Math.hypot(h.pos.x - v.x, h.pos.z - v.z) : 99;
  if (err < 1.5 || h?.kind !== 'ground') good++;
  log.push(['aim', [v.x, v.z], h?.kind, h?.pos ? [+h.pos.x.toFixed(1), +h.pos.z.toFixed(1)] : null, +err.toFixed(2)]);
}
// and a real walk by click across the landing
const goal = C(-3, -3); const [gx, gy] = screenOf(goal);
canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: gx, clientY: gy, bubbles: true })); await wait(120);
canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: gx, clientY: gy, bubbles: true, button: 0 })); dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
await wait(3500);
log.push(['click-walk in mine: dist to goal', +P.position.distanceTo(goal).toFixed(2), 'on target', good, 'of', aims.length]);
await go(0, 22); await wait(1500); await shot('camp-swapped');
return log;
