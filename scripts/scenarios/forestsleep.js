// Reaching the hut after the statue walk: the relief line, then the forest statues sleep.
localStorage.clear();
await start(false);
for (let i = 0; i < 60 && !G.flag('awake'); i++) { await skip(); await wait(300); }
G.setFlag('awake'); G.setFlag('vinesCut'); G.setFlag('watcherSeen');
await go(-50, 8);
const ws = G.enemies.filter((e) => e.kind === 'watcher' && e.homeRegion === 'forest');
log.push('before', ws.map((w) => w.state).join(','));
await go(-66, -6);
await wait(600);
log.push('line', document.getElementById('dialog-text')?.textContent ?? '');
log.push('after', ws.map((w) => w.state).join(','));
await skip();
log.push('flag', G.flag('pastWatchers'));
return log;
