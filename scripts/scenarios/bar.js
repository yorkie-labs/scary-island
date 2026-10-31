await start(true); await wait(300); await skip();
await go(64, 2); await wait(800);
G.state.hearts = 2; G.refresh(); G.emit('faceCursor'); G.emit('flashlight'); await wait(900);
await shot('bar');
log.push(['battery', Math.round(G.battery), 'heart orb', document.getElementById('heart-num').textContent, 'belt', document.querySelectorAll('#belt .slot').length]);
return log;
