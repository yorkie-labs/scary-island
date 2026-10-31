const canvas = G.renderer.domElement;
const key = (c) => { dispatchEvent(new KeyboardEvent('keydown', { code: c })); dispatchEvent(new KeyboardEvent('keyup', { code: c })); };
await start(true); await wait(300); await skip();
await go(64, 2); await wait(600);
log.push(['hotbar', [...document.querySelectorAll('#slots .slot')].map((e) => e.textContent.trim()).join(' | '), 'L', document.querySelector('#skill-left span').textContent, 'R', document.querySelector('#skill-right span').textContent]);
const p0 = P.position.clone(); key('Digit1'); await wait(80); const rolled = P.state.action?.name; await wait(600);
log.push(['1 → action', rolled, 'moved', +P.position.distanceTo(p0).toFixed(2)]);
await wait(300); const y0 = P.position.y; key('Digit2'); let maxY = y0; for (let i = 0; i < 12; i++) { await wait(50); maxY = Math.max(maxY, P.position.y); }
log.push(['2 → jump height', +(maxY - y0).toFixed(2)]);
G.state.hearts = 2; G.state.potions = 1; G.refresh(); key('Digit3'); await wait(100);
log.push(['3 → hearts', G.state.hearts]);
const b0 = G.battery; canvas.dispatchEvent(new MouseEvent('mousedown', { button: 2, clientX: 600, clientY: 300, bubbles: true })); await wait(150);
log.push(['right click → battery', Math.round(b0), '→', Math.round(G.battery)]);
await shot('hotbar');
return log;
