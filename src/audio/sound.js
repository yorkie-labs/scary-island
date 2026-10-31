// Every sound is synthesised with WebAudio: no files to load or license.
// GDD §10.3: cute footsteps, hammer on rock, a low rumble when a rock monster
// wakes, stone grinding, a tense chase loop and a bright escape fanfare. Scary
// sounds stay soft so young players are not startled.

let ctx = null, master = null, musicGain = null, sfxGain = null;
let muted = false;

export function initAudio() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
  return ctx;
}

export function resumeAudio() { initAudio(); if (ctx?.state === 'suspended') ctx.resume(); }
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.8; }
export const isMuted = () => muted;

function tone({ freq = 440, to = null, type = 'sine', dur = 0.15, vol = 0.3, attack = 0.005, delay = 0, dest = sfxGain }) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}

let noiseBuf = null;
function noise({ dur = 0.2, vol = 0.3, filter = 1200, q = 1, type = 'lowpass', to = null, delay = 0 }) {
  if (!ctx || muted) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const bq = ctx.createBiquadFilter(); bq.type = type; bq.Q.value = q; bq.frequency.setValueAtTime(filter, t);
  if (to) bq.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bq); bq.connect(g); g.connect(sfxGain);
  src.start(t); src.stop(t + dur + 0.05);
}

export const sfx = {
  step: () => noise({ dur: 0.06, vol: 0.05, filter: 900 + Math.random() * 400 }),
  jump: () => tone({ freq: 300, to: 620, type: 'triangle', dur: 0.18, vol: 0.15 }),
  land: () => noise({ dur: 0.08, vol: 0.1, filter: 500 }),
  roll: () => noise({ dur: 0.3, vol: 0.12, filter: 2000, to: 400 }),
  swing: () => noise({ dur: 0.18, vol: 0.12, filter: 3000, to: 800, type: 'bandpass', q: 2 }),
  bonk: () => { tone({ freq: 220, to: 90, type: 'square', dur: 0.12, vol: 0.15 }); noise({ dur: 0.12, vol: 0.2, filter: 1500 }); },
  clink: () => { tone({ freq: 1800, to: 1500, type: 'triangle', dur: 0.25, vol: 0.12 }); noise({ dur: 0.08, vol: 0.15, filter: 4000, type: 'highpass' }); },
  ting: () => tone({ freq: 2400, to: 2200, type: 'sine', dur: 0.4, vol: 0.12 }),
  diamond: () => [0, 4, 7, 12].forEach((s, i) => tone({ freq: 880 * 2 ** (s / 12), type: 'triangle', dur: 0.18, vol: 0.12, delay: i * 0.06 })),
  pickup: () => [0, 7, 12].forEach((s, i) => tone({ freq: 660 * 2 ** (s / 12), type: 'sine', dur: 0.2, vol: 0.15, delay: i * 0.07 })),
  item: () => [0, 4, 7, 12, 16].forEach((s, i) => tone({ freq: 523 * 2 ** (s / 12), type: 'triangle', dur: 0.3, vol: 0.14, delay: i * 0.09 })),
  hurt: () => { tone({ freq: 900, to: 500, type: 'sawtooth', dur: 0.18, vol: 0.08 }); tone({ freq: 700, to: 380, type: 'sine', dur: 0.25, vol: 0.12, delay: 0.05 }); },
  bark: () => { tone({ freq: 520, to: 260, type: 'sawtooth', dur: 0.11, vol: 0.12 }); noise({ dur: 0.1, vol: 0.12, filter: 1400, type: 'bandpass', q: 3 }); tone({ freq: 560, to: 280, type: 'sawtooth', dur: 0.11, vol: 0.1, delay: 0.17 }); },
  sniff: () => [0, 0.12, 0.24].forEach((d) => noise({ dur: 0.07, vol: 0.08, filter: 3000, type: 'highpass', delay: d })),
  rumble: () => { tone({ freq: 70, to: 45, type: 'sawtooth', dur: 0.9, vol: 0.12, attack: 0.1 }); noise({ dur: 0.8, vol: 0.12, filter: 200 }); },
  stomp: () => { tone({ freq: 90, to: 50, type: 'sine', dur: 0.3, vol: 0.25 }); noise({ dur: 0.2, vol: 0.15, filter: 300 }); },
  grind: () => noise({ dur: 1.2, vol: 0.15, filter: 400, to: 250, type: 'bandpass', q: 1.5 }),
  stun: () => [0, 1, 2].forEach((i) => tone({ freq: 1400 + i * 300, to: 1100, type: 'sine', dur: 0.12, vol: 0.06, delay: i * 0.1 })),
  snip: () => { noise({ dur: 0.05, vol: 0.18, filter: 5000, type: 'highpass' }); noise({ dur: 0.05, vol: 0.18, filter: 5000, type: 'highpass', delay: 0.1 }); },
  click: () => tone({ freq: 1200, type: 'square', dur: 0.04, vol: 0.05 }),
  whoosh: () => noise({ dur: 0.6, vol: 0.15, filter: 600, to: 3000, type: 'bandpass', q: 0.8 }),
  splash: () => noise({ dur: 0.5, vol: 0.25, filter: 2500, to: 300 }),
  heal: () => [0, 4, 7].forEach((s, i) => tone({ freq: 660 * 2 ** (s / 12), type: 'sine', dur: 0.35, vol: 0.12, delay: i * 0.1 })),
  ghost: () => tone({ freq: 380, to: 520, type: 'sine', dur: 0.6, vol: 0.06, attack: 0.2 }),
  puff: () => noise({ dur: 0.35, vol: 0.12, filter: 900, to: 300 }),
  power: () => { tone({ freq: 110, to: 440, type: 'sawtooth', dur: 0.8, vol: 0.08 }); tone({ freq: 220, to: 880, type: 'sine', dur: 0.8, vol: 0.08 }); },
  fanfare: () => [[0, 0], [4, 0.15], [7, 0.3], [12, 0.45], [7, 0.65], [12, 0.8]].forEach(([s, d]) => tone({ freq: 523 * 2 ** (s / 12), type: 'triangle', dur: 0.35, vol: 0.15, delay: d })),
};

// Music: a tiny step sequencer with three moods.
const MOODS = {
  explore: { bpm: 96, scale: [0, 2, 4, 7, 9], root: 60, bass: [0, 0, 5, 7], lead: 'triangle', density: 0.55 },
  chase: { bpm: 150, scale: [0, 3, 5, 7, 10], root: 57, bass: [0, 0, 3, 5], lead: 'square', density: 0.75 },
  cave: { bpm: 80, scale: [0, 3, 5, 7, 10], root: 55, bass: [0, 5, 3, 7], lead: 'sine', density: 0.35 },
  calm: { bpm: 84, scale: [0, 2, 4, 7, 9], root: 65, bass: [0, 5, 7, 5], lead: 'sine', density: 0.4 },
};
let mood = null, timer = null, stepIndex = 0, seed = 1;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

export function setMusic(name) {
  if (mood === name) return;
  mood = name;
  clearInterval(timer);
  if (!name || !ctx) return;
  const m = MOODS[name];
  const beat = 60 / m.bpm / 2;
  stepIndex = 0; seed = 7;
  timer = setInterval(() => {
    if (muted || !ctx) return;
    const bar = Math.floor(stepIndex / 8) % m.bass.length;
    if (stepIndex % 4 === 0) tone({ freq: midi(m.root - 24 + m.bass[bar]), type: 'triangle', dur: beat * 3, vol: 0.18, dest: musicGain });
    if (rnd() < m.density) {
      const n = m.scale[Math.floor(rnd() * m.scale.length)] + (rnd() < 0.3 ? 12 : 0);
      tone({ freq: midi(m.root + m.bass[bar] + n), type: m.lead, dur: beat * 1.6, vol: m.lead === 'square' ? 0.04 : 0.09, dest: musicGain });
    }
    if (name === 'chase' && stepIndex % 2 === 0) noise({ dur: 0.04, vol: 0.05, filter: 6000, type: 'highpass' });
    stepIndex++;
  }, beat * 1000);
}
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
