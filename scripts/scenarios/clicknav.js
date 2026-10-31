const canvas = G.renderer.domElement;
const screenOf = (v) => { const p = v.clone().project(G.camera); const r = canvas.getBoundingClientRect(); return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height]; };
const mouse = (type, v) => { const [x, y] = screenOf(v); canvas.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 })); };
const click = async (v) => { mouse('mousemove', v); await wait(150); mouse('mousedown', v); await wait(60); dispatchEvent(new MouseEvent('mouseup', { button: 0 })); };
const V = (x, z, y) => new THREE.Vector3(x, y ?? G.groundAt(x, z), z);
const settle = async (ms) => { const t0 = performance.now(); let last = P.position.clone(), still = 0; while (performance.now() - t0 < ms) { await wait(200); if (P.position.distanceTo(last) < 0.02) { if (++still > 3) break; } else still = 0; last.copy(P.position); } };
await start(true); await wait(300); await skip();
// 1) a click on top of the ridge between the beach and the camp
await go(14, 62); await wait(500);
const ridgeTop = V(14, 51.5);
await click(ridgeTop); await settle(6000);
log.push(['ridge click: ended at', pos(), 'ridge top y', +ridgeTop.y.toFixed(1), 'climbed?', P.position.y > 4]);
// 2) behind the wreck: from the beach side to the far side
await go(4, 88); await wait(400);
const behind = V(13, 92);
const t0 = performance.now(); const res = G.nav.findPath(P.position, behind); const ms = performance.now() - t0;
log.push(['path to behind wreck', res ? res.points.length + ' pts' : 'none', 'partial', res?.partial, 'ms', +ms.toFixed(1)]);
await click(behind); await settle(8000);
log.push(['behind wreck: dist to goal', +P.position.distanceTo(behind).toFixed(2)]);
// 3) a click on a village roof (the ground under it is inside the house)
await go(60, 0); await wait(500);
const house = V(48, -4);
await click(house.clone().setY(house.y + 7)); await settle(6000);
log.push(['roof click: ended at', pos(), 'dist to house centre', +Math.hypot(P.position.x - 48, P.position.z + 4).toFixed(1)]);
// 4) far click across camp with obstacles
await go(-3, 26); await wait(400);
const far = V(6, 12);
await click(far); await settle(8000);
log.push(['camp across fire: dist', +P.position.distanceTo(far).toFixed(2)]);
log.push(['nav cache cells', G.nav.cacheSize]);
await shot('clicknav');
return log;
