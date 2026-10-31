await start(true); await wait(300); await skip();
await go(62, 62); await wait(500);
const boat = G.markers.boat;
const res = G.nav.findPath(P.position, boat, { near: 1.4 });
log.push(['boat marker', [+boat.x.toFixed(1), +boat.y.toFixed(2), +boat.z.toFixed(1)], 'path', res ? `${res.points.length} pts partial=${res.partial}` : 'none', 'end', res?.points.at(-1)?.toArray().map((v) => +v.toFixed(1))]);
// walk the dock line: what does the nav grid think of each metre?
const dir = { x: 0.62, z: 0.78 }; const n = Math.hypot(dir.x, dir.z); dir.x /= n; dir.z /= n;
const line = [];
for (let d = -6; d <= 18; d += 1) {
  const x = 66 + dir.x * d, z = 76 + dir.z * d;
  const c = G.nav.cell(G.nav.toIx(x), G.nav.toIx(z));
  line.push(`${d}:${c ? c.y.toFixed(2) : 'X'}(t${G.groundAt(x, z).toFixed(1)})`);
}
log.push(['along dock (d: nav y / terrain)', line.join(' ')]);
return log;
