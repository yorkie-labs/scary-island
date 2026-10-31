const key = (c) => { dispatchEvent(new KeyboardEvent('keydown', { code: c })); dispatchEvent(new KeyboardEvent('keyup', { code: c })); };
await start(true); await wait(300); await skip();
// meet the guardian, then faint
const s = G.markers.seal; await go(s.x, s.z + 5); await wait(800); await skip();
G.state.hearts = 1; G.refresh();
P.state.invulnerable = 0; G.hurtPlayer(P.position.clone().setX(P.position.x + 1));
await wait(3500);
const cp = G.state.checkpoint;
const ground = G.groundAt(P.position.x, P.position.z);
log.push(['after faint at', pos(), 'ground', +ground.toFixed(2), 'feet above ground', +(P.position.y - ground).toFixed(2), 'grounded', P.state.grounded, 'mode', G.mode]);
await wait(2000);
log.push(['2 s later feet above ground', +(P.position.y - G.groundAt(P.position.x, P.position.z)).toFixed(2)]);
// sniff wave
await go(60, 4); await wait(500);
key('Digit3');
const seen = [];
for (let i = 0; i < 30; i++) { await wait(100); seen.push([...document.querySelectorAll('#labels .label')].filter((e) => e.style.display !== 'none').length); }
log.push(['labels visible over time (every 0.1 s)', seen.join(',')]);
await shot('sniff-labels');
G.state.hearts = 2; G.state.potions = 1; G.refresh(); key('Digit4'); await wait(100);
log.push(['4 → hearts', G.state.hearts]);
return log;
