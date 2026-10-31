const canvas = G.renderer.domElement;
const screenOf = (v) => { const p = v.clone().project(G.camera); const r = canvas.getBoundingClientRect(); return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height]; };
const mouse = (type, v) => { const [x, y] = screenOf(v); canvas.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 })); };
const V = (x, z) => new THREE.Vector3(x, G.groundAt(x, z), z);
await start(true); await wait(300); await skip();
// the tent stands at (-6, 14); walk from its south side to its north side
await go(-6, 19.5); await wait(600);
const goal = V(-6, 9);
mouse('mousemove', goal); await wait(150); mouse('mousedown', goal); await wait(60); dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
await wait(100);
const path = G.pointer.order?.path?.map((p) => [+p.x.toFixed(1), +p.z.toFixed(1)]);
const t0 = performance.now(); let maxX = -99, minX = 99;
while (performance.now() - t0 < 7000 && G.pointer.order) { maxX = Math.max(maxX, P.position.x); minX = Math.min(minX, P.position.x); await wait(100); }
log.push(['waypoints', JSON.stringify(path), 'arrived dist', +P.position.distanceTo(goal).toFixed(2), 'swerved x range', +minX.toFixed(1), +maxX.toFixed(1)]);
return log;
