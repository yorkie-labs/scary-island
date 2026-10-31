const canvas = G.renderer.domElement;
const screenOf = (v) => { const p = v.clone().project(G.camera); const r = canvas.getBoundingClientRect(); return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height]; };
const hover = (v) => { const [x, y] = screenOf(v); canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true })); };
await start(true); await wait(300); await skip();
// Rocky in the cart station, one bonk taken
await goMark('elevator', 1); await use(); await wait(2000); await skip();
const rk = G.enemies.find((e) => e.id === 'mr2');
rk.wake(); await wait(1200); rk.hp = 1;
await go(rk.pos.x + 3, rk.pos.z + 3, 0); await wait(500);
rk.state = 'chase'; rk.hp = 1; hover(rk.pos.clone().setY(0.5)); await wait(120);
log.push(['rocky plate', document.getElementById('hover-plate').innerText.replace(/\n/g, ' | '), document.querySelectorAll('#hover-plate .gauge i.on').length]);
await shot('plate-rocky');
// the golem
const gm = G.enemies.find((e) => e.kind === 'golem');
await go(gm.pos.x + 4, gm.pos.z + 6, 0); await wait(600); await skip();
gm.state = 'stunned'; gm.t = 0; gm.hp = 2; hover(gm.pos.clone().setY(2)); await wait(150);
log.push(['golem plate', document.getElementById('hover-plate').innerText.replace(/\n/g, ' | '), document.querySelectorAll('#hover-plate .gauge i.on').length]);
await shot('plate-golem');
return log;
