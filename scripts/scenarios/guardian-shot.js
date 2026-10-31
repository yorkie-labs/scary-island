await start(true);
const s = G.markers.seal; await go(s.x, s.z + 6); await wait(200);
for (let i = 0; i < 8 && !G.hud.inDialog; i++) await wait(200);
await wait(900); await shot('guardian-intro');
await skip(); await wait(500); await shot('guardian-fight');
return [G.flag('guardianMet')];
