await start(true);
await goMark('elevator', 1); await use(); await wait(1800); await skip();
const endT = G.triggers.find((t) => t.radius === 3 && t.once === false && t.pos && Math.abs(t.pos.z + 47) < 0.1);
log.push(['end trigger found', !!endT]);
await go(599, -43, 0); await wait(400);
log.push(['at exit before run', JSON.stringify({ inside: endT.inside, on: endT.enabled() })]);
G.state.hearts = 3;
await go(600, -9, 0); await wait(400);
log.push(['started', G.musicOverride, 'end on', endT.enabled(), 'inside', endT.inside]);
for (let z = -10; z >= -48; z -= 1.6) { await go(600, z, 0); await wait(110); }
await wait(400);
log.push(['after run', G.flag('collapseEscaped'), 'end inside', endT.inside, 'on', endT.enabled(), pos(), 'hearts', G.state.hearts]);
return log;
