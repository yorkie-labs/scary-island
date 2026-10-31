// From the middle of raised pads, how many spots around their rims can a click reach?
await start(true); await wait(300); await skip();
const rings = [{ name: 'village', c: [64, -4], r: [18, 24] }, { name: 'camp', c: [0, 18], r: [12, 17] }, { name: 'mine yard', c: [0, -42], r: [7, 11] }];
for (const ring of rings) {
  await go(ring.c[0], ring.c[1]); await wait(300);
  let ok = 0, partial = 0, none = 0, unwalk = 0; const bad = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    for (const rr of ring.r) {
      const x = ring.c[0] + Math.cos(a) * rr, z = ring.c[1] + Math.sin(a) * rr;
      if (G.groundAt(x, z) < 0.5) continue;
      const tgt = new THREE.Vector3(x, G.groundAt(x, z), z);
      const c = G.nav.nearestWalkable(tgt, 1);
      if (!c) { unwalk++; continue; }
      const res = G.nav.findPath(P.position, G.nav.at(c), { near: 0.6 });
      if (!res) none++; else if (res.partial) { partial++; const e = res.points.at(-1); bad.push([+x.toFixed(0), +z.toFixed(0), +G.groundAt(x, z).toFixed(1), 'stop', e ? [+e.x.toFixed(0), +e.z.toFixed(0), +e.y.toFixed(1)] : null]); } else ok++;
    }
  }
  log.push([ring.name, 'reachable', ok, 'partial', partial, 'none', none, 'not walkable', unwalk, JSON.stringify(bad)]);
}
return log;
