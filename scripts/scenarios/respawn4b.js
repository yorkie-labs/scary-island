await start(true); await wait(300); await skip();
// the old bug: checkpoint stored with the arena-centre height in front of the gate
const gate = G.markers.ancientGate;
G.state.checkpoint = { x: gate.x, y: gate.y - 1.5, z: gate.z, region: 'village' };
G.state.hearts = 1; P.state.invulnerable = 0; G.hurtPlayer(P.position.clone().setX(P.position.x + 1));
await wait(3500);
const g = G.groundAt(P.position.x, P.position.z);
log.push(['respawned at', pos(), 'ground', +g.toFixed(2), 'feet - ground', +(P.position.y - g).toFixed(2)]);
await wait(2500);
log.push(['after 2.5 s feet - ground', +(P.position.y - G.groundAt(P.position.x, P.position.z)).toFixed(2), 'grounded', P.state.grounded]);
return log;
