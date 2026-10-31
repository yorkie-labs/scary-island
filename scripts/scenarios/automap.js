await start(true); await wait(300); await skip();
dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'Tab' }));
await wait(500); await shot('automap-surface');
log.push(['shown', !document.getElementById('automap').classList.contains('hidden')]);
await goMark('elevator', 1); await use(); await wait(2000); await skip(); await go(600, -40, 0); await wait(500);
await shot('automap-mine');
dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'Tab' })); await wait(300);
log.push(['hidden after 2nd Tab', document.getElementById('automap').classList.contains('hidden')]);
return log;
