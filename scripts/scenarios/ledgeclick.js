// stand right under a steep bank and click its top: the click must not be ignored
const canvas = G.renderer.domElement;
const screenOf = (v) => { const p = v.clone().project(G.camera); const r = canvas.getBoundingClientRect(); return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height]; };
const mouse = (type, v) => { const [x, y] = screenOf(v); canvas.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 })); };
await start(true); await wait(300); await skip();
let handled = 0, ignored = 0;
for (const [x, z, tx, tz] of [[14, 57, 14, 51], [-26, 12, -31, 12], [26, 2, 31, 2], [6, -27, 6, -31]]) {
  await go(x, z); await wait(300);
  const t = new THREE.Vector3(tx, G.groundAt(tx, tz), tz);
  const before = P.state.heading;
  mouse('mousemove', t); await wait(120); mouse('mousedown', t); await wait(60); dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
  await wait(150);
  const reacted = !!G.pointer.order || Math.abs(P.state.heading - before) > 0.01;
  reacted ? handled++ : ignored++;
  await wait(1500);
}
log.push(['ledge clicks handled', handled, 'ignored', ignored]);
return log;
