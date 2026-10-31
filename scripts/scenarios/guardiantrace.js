localStorage.clear();
await start(false);
for (let i = 0; i < 60 && !G.flag('awake'); i++) { await skip(); await wait(300); }
for (const f of ['ancientGateOpen', 'guardianMet']) G.setFlag(f);
const g = G.enemies.find((e) => e.kind === 'guardian');
g.state = 'awake';
log.push('home', g.home.toArray().map((v) => +v.toFixed(1)));
await go(72, -8); // just outside the gate, then up the east bank
P.state.heading = 0;
for (let i = 0; i < 14; i++) { await wait(700); log.push(g.pos.toArray().map((v) => +v.toFixed(1)).join(' ') + ' hearts ' + G.state.hearts + ' P ' + pos().join(' ')); if (i === 6) { await go(86, -12); P.state.heading = 0; } }
return log;
