const canvas = G.renderer.domElement;
const screenOf = (v) => { const p = v.clone().project(G.camera); const r = canvas.getBoundingClientRect(); return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height]; };
await start(true); await wait(300); await skip();
await go(62, 62); await wait(600);
const dir = { x: 0.62, z: 0.78 }; const n = Math.hypot(dir.x, dir.z);
const mid = new THREE.Vector3(66 + (dir.x / n) * 8, 1.62, 76 + (dir.z / n) * 8);
const [x, y] = screenOf(mid);
canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true })); await wait(120);
const h = G.pointer.pick();
log.push(['picked', h?.kind, h?.pos?.toArray().map((v) => +v.toFixed(2))]);
canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true, button: 0 })); dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
await wait(50);
log.push(['order target', G.pointer.order?.point?.toArray().map((v) => +v.toFixed(2)), 'path', JSON.stringify(G.pointer.order?.path?.map((p) => [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)]))]);
const trace = [];
for (let i = 0; i < 50; i++) { await wait(120); trace.push(P.position.toArray().map((v) => +v.toFixed(1)).join('/')); if (!G.pointer.order) break; }
log.push(['trace', trace.join(' ')]);
return log;
