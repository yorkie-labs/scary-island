await start(true); await wait(300); await skip();
await go(-10, 80); await wait(800);
P.act('sniff'); await wait(450); await shot('sniff-ring');
log.push(['toast', document.getElementById('toast').textContent]);
return log;
