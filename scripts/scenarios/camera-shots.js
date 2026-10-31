await start(false); await wait(400); await skip(); await wait(300); await skip();
await go(2, 74); await wait(1200); await shot('cam-beach');
await go(-2, 24); await wait(1200); await shot('cam-camp');
await go(-50, 8); await wait(1200); await shot('cam-forest');
const c = G.camera.position, p = P.position;
const dx = c.x - p.x, dz = c.z - p.z, dy = c.y - p.y;
log.push(['pitch°', +(Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI).toFixed(1), 'fov', G.camera.fov, 'dist', +Math.hypot(dx, dy, dz).toFixed(1)]);
return log;
