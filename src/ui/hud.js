import { BASE_HEARTS, maxPotions, ABILITY_TREATS, treatsEaten } from '../core/state.js';
import { heightAt, ridgeAt, REGIONS, WORLD_HALF, regionAt, GATES } from '../world/map.js';
import { sfx } from '../audio/sound.js';

const $ = (id) => document.getElementById(id);

// The hotbar (keys 1-3) holds dog abilities, like Diablo's skill keys; 4 is
// the potion belt. Roll and jump unlock with treats (see ABILITY_TREATS).
export const ACTIONS = [
  { key: 'sniff', icon: '👃', ko: '냄새 맡기' },
  { key: 'roll', icon: '🌀', ko: '구르기' },
  { key: 'jump', icon: '⤴️', ko: '점프' },
];

const PART_ICONS = { engine: '⚙️', fuel: '⛽', crystal: '🔮', shipKey: '🔑' };

export function createHud() {
  // clicking a hotbar slot, the potion belt or the flashlight icon presses its key
  document.getElementById('bar')?.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    const slot = e.target.closest('[data-key]');
    if (slot) hud.onKey?.(slot.dataset.key);
  });
  let lastObjective = '';
  let toastTimer = 0;
  let dialogQueue = null;
  let speechNow = null, hushed = false, tipTimer = 0;
  $('speech').addEventListener('pointerdown', (e) => { e.stopPropagation(); hud.skipSpeech(); });
  $('tip-close').addEventListener('pointerdown', (e) => { e.stopPropagation(); clearTimeout(tipTimer); $('tip').classList.add('hidden'); });

  // minimap background, drawn once from the height field
  const mapImage = document.createElement('canvas');
  mapImage.width = mapImage.height = 180;
  const autoImage = document.createElement('canvas');
  autoImage.width = autoImage.height = 180;
  {
    const c = mapImage.getContext('2d');
    const img = c.createImageData(180, 180);
    for (let j = 0; j < 180; j++) for (let i = 0; i < 180; i++) {
      const x = -WORLD_HALF + (i / 180) * WORLD_HALF * 2, z = -WORLD_HALF + (j / 180) * WORLD_HALF * 2;
      const h = heightAt(x, z);
      let col;
      if (h < 0) col = [44, 111, 143];
      else if (ridgeAt(x, z).k > 0.4) col = [128, 118, 108];
      else if (h < 1.4) col = [240, 217, 160];
      else if (h > 16) col = [160, 150, 140];
      else {
        const r = regionAt(x, z);
        col = r === 'forest' ? [63, 122, 76] : r === 'village' ? [150, 160, 170] : [121, 184, 90];
      }
      const o = (j * 180 + i) * 4;
      img.data.set([...col, 255], o);
    }
    c.putImageData(img, 0, 0);
    // the automap shows land only, like Diablo II's: the sea becomes see-through
    for (let i = 0; i < img.data.length; i += 4) if (img.data[i] === 44 && img.data[i + 1] === 111) img.data[i + 3] = 0;
    autoImage.getContext('2d').putImageData(img, 0, 0);
  }

  const hud = {
    show(v) { $('hud').classList.toggle('hidden', !v); document.body.classList.toggle('playing', v); },

    // set by main: 'diablo' or 'third', decides what the L/R skill icons show

    update(state, objective) {
      // heart orb: three segments, drains from the top like Diablo's life globe
      const orb = $('heart-orb');
      const fill = Math.max(0, state.hearts) / BASE_HEARTS;
      if (orb.dataset.hearts !== String(state.hearts)) {
        if (orb.dataset.hearts && Number(orb.dataset.hearts) > state.hearts) { orb.classList.remove('hit'); void orb.offsetWidth; orb.classList.add('hit'); }
        orb.dataset.hearts = String(state.hearts);
      }
      orb.querySelector('.fill').style.height = `${fill * 100}%`;
      $('heart-num').textContent = `${state.hearts}/${BASE_HEARTS}`;
      $('diamonds').textContent = state.diamonds;
      $('keys').textContent = state.keys;
      $('keys-wrap').classList.toggle('hidden', !state.flags.villageEntered || state.flags.ancientGateOpen);

      // skills: left click and right click, like D2's two attack icons
      const hammer = state.items.hammer ? '🔨' : '🐾';
      const light = state.items.flashlight ? '🔦' : '❔';
      $('skill-left').querySelector('span').textContent = hammer;
      $('skill-right').querySelector('span').textContent = light;
      $('skill-left').title = '왼쪽 클릭: 이동 · 망치';
      $('skill-right').title = '오른쪽 클릭: 손전등';

      // hotbar: 1 sniff, 2 roll, 3 jump; the belt holds potions (key 4)
      $('slots').innerHTML = ACTIONS.map((t, i) => {
        const need = ABILITY_TREATS[t.key] - treatsEaten(state);
        return need > 0
          ? `<div class="slot locked-ability" data-key="Digit${i + 1}" title="${t.ko}: 강아지 간식 ${need}개 더 먹으면 배워요"><small>${i + 1}</small>🔒<b>🦴${need}</b></div>`
          : `<div class="slot" data-key="Digit${i + 1}" title="${t.ko} (${i + 1})"><small>${i + 1}</small>${t.icon}</div>`;
      }).join('');
      const max = maxPotions(state);
      $('belt').innerHTML = Array.from({ length: max }, (_, i) => `<div class="slot ${i < state.potions ? '' : 'empty'}" data-key="Digit4" title="하트 포션 (4)">${i === 0 ? '<small>4</small>' : ''}🧪</div>`).join('');
      // key items you just carry (the scissors open the vines by themselves)
      const keyItems = state.items.scissors ? '<span class="have" title="가위 (덩굴 앞에서 저절로 써요)">✂️</span>' : '';
      $('parts').innerHTML = keyItems + Object.entries(PART_ICONS).map(([k, icon]) => `<span class="${state.parts[k] ? 'have' : ''}" title="${k}">${icon}</span>`).join('');

      const text = objective ? objective.text : '섬 탈출 성공!';
      $('stage-name').textContent = objective ? `STAGE ${objective.stage.id} · ${objective.stage.name}` : 'THE END?';
      $('objective-text').textContent = text;
      if (text !== lastObjective) {
        const el = $('objective');
        el.classList.remove('new'); void el.offsetWidth; el.classList.add('new');
        if (lastObjective) sfx.click();
        lastObjective = text;
      }
    },

    // every frame bits: the flashlight battery orb
    tick({ battery = 0, hasLight = false }) {
      const orb = $('battery-orb');
      orb.classList.toggle('empty', !hasLight);
      orb.querySelector('.fill').style.height = `${hasLight ? battery : 0}%`;
      $('battery-num').textContent = hasLight ? `${Math.round(battery)}%` : '?';
    },

    // Tab: the whole island (or the mine) over the play area, see-through so the
    // game keeps running behind it, turned to match the top-down camera.
    automap({ show, player, heading, target, rotation = 0, underground, cave, gates = {}, checkpoint }) {
      const cv = $('automap');
      cv.classList.toggle('hidden', !show);
      if (!show) return;
      const W = innerWidth, H = innerHeight;
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const c = cv.getContext('2d');
      c.clearRect(0, 0, W, H);
      c.fillStyle = 'rgba(18, 12, 32, 0.45)';
      c.fillRect(0, 0, W, H);
      const size = Math.min(W, H) * 0.86;
      c.save();
      c.translate(W / 2, H / 2);
      c.rotate(rotation);
      let toMap;
      if (underground && cave) {
        // the mine: rooms and tunnels from the cave grid
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (const [a, b, cc, d] of cave.rects) { x0 = Math.min(x0, a); z0 = Math.min(z0, b); x1 = Math.max(x1, cc + 1); z1 = Math.max(z1, d + 1); }
        const k = size / Math.max(x1 - x0, z1 - z0);
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        toMap = (x, z) => [((x - cave.origin.x) / cave.cell - cx) * k, ((z - cave.origin.z) / cave.cell - cz) * k];
        c.fillStyle = 'rgba(127, 227, 255, 0.35)'; c.strokeStyle = 'rgba(200, 240, 255, 0.9)'; c.lineWidth = 2;
        for (const [a, b, cc, d] of cave.rects) { c.fillRect((a - cx) * k, (b - cz) * k, (cc - a + 1) * k, (d - b + 1) * k); c.strokeRect((a - cx) * k, (b - cz) * k, (cc - a + 1) * k, (d - b + 1) * k); }
      } else {
        const k = size / (WORLD_HALF * 2);
        toMap = (x, z) => [x * k, z * k];
        c.globalAlpha = 0.8;
        c.drawImage(autoImage, -size / 2, -size / 2, size, size);
        c.globalAlpha = 1;
        c.textAlign = 'center'; c.font = `${Math.round(size / 34)}px Jua, sans-serif`;
        for (const r of Object.values(REGIONS)) {
          const [x, y] = toMap(r.x, r.z);
          c.save(); c.translate(x, y); c.rotate(-rotation);
          c.lineWidth = 4; c.strokeStyle = 'rgba(20,10,30,.8)'; c.strokeText(r.ko, 0, 0);
          c.fillStyle = '#fff8ec'; c.fillText(r.ko, 0, 0);
          c.restore();
        }
        c.font = `${Math.round(size / 30)}px sans-serif`;
        for (const [name, g] of Object.entries(GATES)) {
          const [x, y] = toMap(g.x, g.z);
          c.save(); c.translate(x, y); c.rotate(-rotation);
          c.fillStyle = 'rgba(20,10,30,.75)'; c.beginPath(); c.arc(0, 0, size / 34, 0, 7); c.fill();
          c.fillText(gates[name] ? '🔓' : '🔒', 0, 8);
          c.restore();
        }
        if (checkpoint && checkpoint.x < 400) {
          const [x, y] = toMap(checkpoint.x, checkpoint.z);
          c.save(); c.translate(x, y); c.rotate(-rotation); c.fillText('🔥', 0, 8); c.restore();
        }
      }
      if (target && (target.x > 400) === !!underground) {
        const [x, y] = toMap(target.x, target.z);
        c.fillStyle = '#ffd34d'; c.strokeStyle = '#5a2d00'; c.lineWidth = 3;
        c.beginPath(); star(c, x, y, 13, 6); c.fill(); c.stroke();
      }
      const [px, py] = toMap(player.x, player.z);
      c.translate(px, py); c.rotate(-heading + Math.PI);
      c.fillStyle = '#ff9f1c'; c.strokeStyle = '#fff'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, -14); c.lineTo(11, 11); c.lineTo(0, 5); c.lineTo(-11, 11); c.closePath(); c.fill(); c.stroke();
      c.restore();
      c.fillStyle = 'rgba(255,248,236,.8)'; c.font = '15px Jua, sans-serif'; c.textAlign = 'center';
      if (!document.body.classList.contains('touch')) c.fillText('Tab 지도 닫기 · ⭐ 다음 목표 · 🔒 아직 닫힌 길 · 🔥 체크포인트', W / 2, H - 140);
      // phones: under the objective box when upright; no room for it lying down
      else if (H > W) c.fillText('🗺️ 지도 닫기 · ⭐ 다음 목표 · 🔒 닫힌 길 · 🔥 체크포인트', W / 2, 152);
    },

    minimap({ player, heading, target, region, underground, enemies = [], friends = [], rotation = 0 }) {
      const cv = $('minimap'), c = cv.getContext('2d');
      const S = 180;
      c.clearRect(0, 0, S, S);
      if (underground) {
        c.fillStyle = '#2a2236'; c.fillRect(0, 0, S, S);
        c.fillStyle = '#fff8ec'; c.font = '16px Jua, sans-serif'; c.textAlign = 'center';
        c.fillText('지하 광산', S / 2, S / 2 - 6);
        c.font = '28px sans-serif'; c.fillText('⛏️', S / 2, S / 2 + 28);
      } else {
        // a zoomed window around the player
        c.save();
        // the top-down camera looks along `rotation`; turn the map to match the screen
        c.translate(S / 2, S / 2); c.rotate(rotation); c.translate(-S / 2, -S / 2);
        const zoom = 2.2, view = (WORLD_HALF * 2) / zoom;
        const px = ((player.x + WORLD_HALF) / (WORLD_HALF * 2)) * S, pz = ((player.z + WORLD_HALF) / (WORLD_HALF * 2)) * S;
        c.save();
        c.translate(S / 2, S / 2); c.scale(zoom, zoom); c.translate(-px, -pz);
        c.drawImage(mapImage, 0, 0);
        c.restore();
        const toMap = (x, z) => [S / 2 + ((x - player.x) / view) * S, S / 2 + ((z - player.z) / view) * S];
        for (const e of enemies) {
          const [ex, ez] = toMap(e.x, e.z);
          if (Math.hypot(ex - S / 2, ez - S / 2) < S / 2) { c.fillStyle = '#ff4d6d'; c.beginPath(); c.arc(ex, ez, 3, 0, 7); c.fill(); }
        }
        for (const f of friends) {
          const [fx, fz] = toMap(f.x, f.z);
          if (Math.hypot(fx - S / 2, fz - S / 2) < S / 2) { c.fillStyle = f.color; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(fx, fz, 4, 0, 7); c.fill(); c.stroke(); }
        }
        if (target) {
          let [tx, tz] = toMap(target.x, target.z);
          const d = Math.hypot(tx - S / 2, tz - S / 2), max = S / 2 - 10;
          if (d > max) { tx = S / 2 + ((tx - S / 2) / d) * max; tz = S / 2 + ((tz - S / 2) / d) * max; }
          c.fillStyle = '#ffd34d'; c.strokeStyle = '#5a2d00'; c.lineWidth = 2;
          c.beginPath(); star(c, tx, tz, 8, 4); c.fill(); c.stroke();
        }
      }
      // player arrow (inside the same turn as the map)
      c.save(); c.translate(S / 2, S / 2); c.rotate(-heading + Math.PI);
      c.fillStyle = '#ff9f1c'; c.strokeStyle = '#fff'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, -9); c.lineTo(7, 7); c.lineTo(0, 3); c.lineTo(-7, 7); c.closePath(); c.fill(); c.stroke();
      c.restore();
      if (!underground) c.restore();
      $('region-name').textContent = underground ? REGIONS.mine.ko : REGIONS[region]?.ko ?? '';
    },

    prompt(text) {
      const el = $('prompt');
      el.classList.toggle('hidden', !text);
      if (text && el.textContent !== text) el.textContent = text;
    },

    toast(text, ms = 2200) {
      const el = $('toast');
      el.textContent = text;
      el.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.classList.remove('show'), ms);
    },

    // Diablo III style talk: lines in a small panel that move on by
    // themselves while Yorkie keeps playing (tap it to skip ahead). Help lines
    // become a tip card that stays until read. Resolves when it is all said.
    speech(lines) {
      const queue = lines.map((l) => (typeof l === 'string' ? { text: l } : l));
      return new Promise((resolve) => {
        const next = () => {
          clearTimeout(speechNow?.timer);
          const l = queue.shift();
          if (!l || hushed) { speechNow = null; $('speech').classList.add('hidden'); resolve(); return; }
          if (l.name === '도움말') { hud.tip(l.text); next(); return; }
          const ms = 2200 + 80 * l.text.length; // time for a child to read it
          speechNow = { next, timer: setTimeout(next, ms) };
          // just above the bar (and the ✋ prompt), wherever this layout puts them
          const barTop = Math.min(...['bar', 'prompt'].map((id) => $(id)).filter((el) => !el.classList.contains('hidden'))
            .map((el) => el.getBoundingClientRect().top).filter((t) => t > 0));
          const el = $('speech');
          el.style.top = '';
          el.style.bottom = Number.isFinite(barTop) ? `${innerHeight - barTop + 10}px` : '';
          $('speech-name').textContent = l.name ?? '';
          $('speech-text').textContent = l.text;
          el.classList.remove('hidden'); // (shown before measuring it)
          // never over Yorkie (a tall layout or the ✋ prompt can push it up to
          // the middle): then it goes up top, under the mission
          const r = el.getBoundingClientRect(), y = hud.heroY?.();
          if (y != null && y > r.top - 30 && y < r.bottom + 50) {
            el.style.bottom = 'auto';
            el.style.top = `${$('objective').getBoundingClientRect().bottom + 10}px`;
          }
          const bar = $('speech-time');
          bar.style.transition = 'none'; bar.style.transform = 'scaleX(1)';
          void bar.offsetWidth;
          bar.style.transition = `transform ${ms}ms linear`; bar.style.transform = 'scaleX(0)';
          el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
        };
        next();
      });
    },
    skipSpeech() { if (!speechNow) return false; sfx.click(); speechNow.next(); return true; },
    // a big moment is coming: cut the chatter short, and say nothing until it starts
    hush(on) { hushed = on; if (on) speechNow?.next(); },
    tip(text) {
      $('tip-text').textContent = text;
      $('tip').classList.remove('hidden', 'pop'); void $('tip').offsetWidth; $('tip').classList.add('pop');
      clearTimeout(tipTimer);
      tipTimer = setTimeout(() => $('tip').classList.add('hidden'), Math.max(12000, 140 * text.length));
    },

    // A big moment (stop: true): the box that holds the game until read.
    // lines: [{ name, text }] or strings
    dialog(lines, done) {
      dialogQueue = { lines: lines.map((l) => (typeof l === 'string' ? { text: l } : l)), i: 0, done };
      $('dialog').classList.remove('hidden');
      showLine();
    },
    advanceDialog() {
      if (!dialogQueue) return false;
      sfx.click();
      dialogQueue.i++;
      if (dialogQueue.i >= dialogQueue.lines.length) {
        const done = dialogQueue.done;
        dialogQueue = null;
        $('dialog').classList.add('hidden');
        done?.();
      } else showLine();
      return true;
    },
    get inDialog() { return !!dialogQueue; },

    fade(on) {
      $('fade').classList.toggle('on', on);
      return new Promise((r) => setTimeout(r, 650));
    },

    card(html, ms = 2600) {
      const el = $('card');
      el.innerHTML = html;
      el.classList.remove('hidden', 'show'); void el.offsetWidth; el.classList.add('show');
      return new Promise((r) => setTimeout(() => { el.classList.add('hidden'); r(); }, ms));
    },
  };

  function showLine() {
    const l = dialogQueue.lines[dialogQueue.i];
    $('dialog-name').textContent = l.name ?? '';
    $('dialog-text').textContent = l.text;
  }

  return hud;
}

function star(c, x, y, r1, r2) {
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? r2 : r1, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    if (i) c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
}
