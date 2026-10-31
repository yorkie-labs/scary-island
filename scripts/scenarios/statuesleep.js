await start(true); await wait(300); await skip();
const vw = G.enemies.filter((e) => e.kind === 'watcher' && e.region === 'village');
// get one statue following
await go(56, -2); G.cam.rig.yaw = 0; P.state.heading = Math.PI; await wait(1500); await skip();
log.push(['before gate', vw.map((w) => w.state).join(',')]);
G.state.keys = 3; await goMark('ancientGate', 0); await use(); await wait(1600);
log.push(['after gate', vw.map((w) => w.state).join(','), 'toast', document.getElementById('toast').textContent]);
const p0 = vw.map((w) => w.pos.clone());
P.state.heading = 0; await wait(2500);
log.push(['moved after sleeping (m)', vw.map((w, i) => +w.pos.distanceTo(p0[i]).toFixed(2)).join(',')]);
return log;
