await start(true); await wait(300); await skip();
const shop = G.markers.shop; await go(shop.x + 1, shop.z + 2); await wait(1500); await shot('shop');
const names = ['parrot', 'rabbit', 'crab'];
for (const n of names) {
  const o = G.scene.children.find((c) => c.name === n);
  let skinned = 0; o?.traverse((c) => { if (c.isSkinnedMesh) skinned++; });
  const box = o ? new (P.position.constructor)() : null;
  log.push([n, 'found', !!o, 'skinned meshes', skinned, 'pos', o?.position.toArray().map((v) => +v.toFixed(1))]);
}
return log;
