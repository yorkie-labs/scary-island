const canvas = G.renderer.domElement;
const screenOf = (v) => { const p = v.clone().project(G.camera); const r = canvas.getBoundingClientRect(); return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height]; };
const click = async (v) => { const [x, y] = screenOf(v); canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true })); await wait(120); canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true, button: 0 })); dispatchEvent(new MouseEvent('mouseup', { button: 0 })); };
await start(true); await wait(300); await skip();
await go(62, 62); await wait(600);
const dir = { x: 0.62, z: 0.78 }; const n = Math.hypot(dir.x, dir.z);
const onDock = (d) => new THREE.Vector3(66 + (dir.x / n) * d, 1.62, 76 + (dir.z / n) * d);
// 1) click the middle of the dock
const mid = onDock(8);
await click(mid);
let wet = false; for (let i = 0; i < 60 && G.pointer.order; i++) { await wait(100); if (P.position.y < 0.5) wet = true; }
log.push(['dock middle: dist', +P.position.distanceTo(mid).toFixed(2), 'y', +P.position.y.toFixed(2), 'went into water?', wet]);
// 2) click the far end of the dock, then the boat itself
const end = onDock(14);
await click(end); for (let i = 0; i < 60 && G.pointer.order; i++) { await wait(100); if (P.position.y < 0.5) wet = true; }
log.push(['dock end: dist', +P.position.distanceTo(end).toFixed(2), 'went into water?', wet]);
await go(62, 62); await wait(400);
const boat = G.markers.boat;
await click(boat.clone().setY(boat.y + 0.8)); for (let i = 0; i < 80 && G.pointer.order; i++) { await wait(100); if (P.position.y < 0.5) wet = true; }
log.push(['clicked boat: dist to boat spot', +P.position.distanceTo(boat).toFixed(2), 'went into water?', wet, 'dialog', G.hud.inDialog]);
return log;
