await start(true); await wait(300); await skip();
const shop = G.markers.shop; await go(shop.x - 2, shop.z + 4); await wait(1500);
await shot('shop');
const parrot = G.scene.children.find((o) => o.name === 'parrot');
log.push(['parrot', !!parrot, parrot && parrot.position.toArray().map((v) => +v.toFixed(2)), parrot && parrot.visible, 'scale', parrot?.scale.x]);
return log;
