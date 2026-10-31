const canvas = G.renderer.domElement;
const screenOf = (v) => { const p = v.clone().project(G.camera); const r = canvas.getBoundingClientRect(); return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height]; };
const mouse = (type, v, opts = {}) => { const [x, y] = screenOf(v); canvas.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: opts.button ?? 0, shiftKey: !!opts.shift })); };
const click = async (v, opts) => { mouse('mousemove', v); await wait(120); mouse('mousedown', v, opts); await wait(60); dispatchEvent(new MouseEvent('mouseup', { button: opts?.button ?? 0 })); };
await start(false); await wait(400); await skip(); await wait(300); await skip();
log.push(['mode', G.controlMode, 'cam height above player', +(G.camera.position.y - P.position.y).toFixed(1)]);
await shot('diablo-01-start');
// 1) click the ground a few metres away
const from = P.position.clone();
const goal = from.clone().add(new THREE.Vector3(3, 0, -5)); goal.y = G.groundAt(goal.x, goal.z);
await click(goal); await wait(2500);
log.push(['click-move: distance to goal', +P.position.distanceTo(goal).toFixed(2), 'moved', +P.position.distanceTo(from).toFixed(2)]);
// 2) hover + click the hammer pickup
const ham = G.pickups.find((p) => p.id === 'hammer');
mouse('mousemove', ham.model.position); await wait(200);
log.push(['hover on hammer', document.getElementById('hover-tip').textContent, document.body.dataset.cursor]);
await click(ham.model.position); await wait(5000); await skip();
log.push(['hammer', G.state.items.hammer]);
// 3) hold the mouse on an ore: walk up and keep bonking
const ore = new THREE.Vector3(-5, G.groundAt(-5, 75) + 0.5, 75);
await go(-5, 79); await wait(300);
mouse('mousemove', ore); await wait(200);
log.push(['hover on ore', document.getElementById('hover-tip').textContent]);
mouse('mousedown', ore); await wait(3500); dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
await wait(300); await skip();
log.push(['ore mined → diamonds dropped', G.pickups.filter((p) => !p.id).length, 'diamonds', G.state.diamonds]);
await shot('diablo-02-ore');
// 4) hover a Rocky: name plate
const rk = G.enemies.find((e) => e.kind === 'rocky');
rk.wake(); await wait(1200);
mouse('mousemove', rk.pos.clone().setY(rk.pos.y + 0.5)); await wait(250);
log.push(['plate on rocky', document.getElementById('hover-plate').textContent, document.getElementById('hover-plate').className]);
await shot('diablo-03-rocky');
// 5) space rolls toward the cursor (rolling is learned from the first treat)
G.state.treats[1] = ['beach-a']; G.refresh();
const before = P.position.clone();
mouse('mousemove', P.position.clone().add(new THREE.Vector3(3, 0, 0))); await wait(100);
dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
await wait(600);
log.push(['roll dx', +(P.position.x - before.x).toFixed(2), 'dz', +(P.position.z - before.z).toFixed(2)]);
// 6) V toggles back to third person and again
dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyV' })); await wait(300);
log.push(['after V', G.controlMode]);
dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyV' })); await wait(300);
log.push(['after V again', G.controlMode]);
return log;
