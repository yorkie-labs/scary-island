import { save } from '../core/state.js';
import { sfx } from '../audio/sound.js';
import { watchLobby } from '../net/lobby.js';
import {
  CODE_EMOJIS, CODE_LENGTH, MAX_PLAYERS, HOODIE_COLORS, codeToId, idToCode, randomGameId, randomName, safeName,
} from '../net/share.js';

const $ = (id) => document.getElementById(id);

// My Yorkie's card for playing together: a private id (it makes me the owner
// of the games I create, even after a refresh), a preset nickname and a
// hoodie colour. Kept in the save, like the rest of the character.
export function ensureProfile(state) {
  if (!state.profile?.id) {
    state.profile = {
      id: crypto.randomUUID().replace(/-/g, '').slice(0, 16),
      name: randomName(),
      color: HOODIE_COLORS[Math.floor(Math.random() * HOODIE_COLORS.length)],
    };
    save(state);
  }
  return state.profile;
}

// Korean particle after a name: 펭귄이 / 강아지가
export const josa = (word, withBatchim, without) => {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  return word + (c >= 0 && c <= 11171 && c % 28 ? withBatchim : without);
};

// The "같이 하기" screen (Diablo II's lobby): my nickname and hoodie, the list
// of open games, make a game (public or secret), or type a friend's code.
export function createLobbyUI(G, { onEnter, onBack }) {
  const profile = () => ensureProfile(G.state);
  let watching = null, code = [], busy = false;

  function renderMe() {
    const p = profile();
    $('coop-name').textContent = p.name;
    $('coop-name').style.setProperty('--hoodie', p.color);
    $('coop-colors').replaceChildren(...HOODIE_COLORS.map((c) => {
      const b = document.createElement('button');
      b.className = `swatch${c === p.color ? ' on' : ''}`;
      b.style.background = c;
      b.title = '후드 색';
      b.onclick = () => { p.color = c; save(G.state); sfx.click(); renderMe(); };
      return b;
    }));
  }

  function renderRows(rows) {
    const list = $('coop-list');
    if (!rows.length) {
      const p = document.createElement('p');
      p.className = 'coop-empty';
      p.textContent = '열린 게임이 없어요. 새 게임을 만들어 친구를 불러요!';
      list.replaceChildren(p);
      return;
    }
    list.replaceChildren(...rows.map((g) => {
      const b = document.createElement('button');
      b.className = 'coop-game';
      b.disabled = g.full;
      const owner = safeName(g.ownerName);
      const stage = Math.min(5, Math.max(1, Number(g.stage) || 1));
      b.innerHTML = '<b></b><span></span>';
      b.querySelector('b').textContent = `${owner}의 모험`;
      b.querySelector('span').textContent = `STAGE ${stage} · 👥 ${Math.min(g.players ?? 0, MAX_PLAYERS)}/${MAX_PLAYERS}${g.full ? ' · 꽉 찼어요' : ''}`;
      b.onclick = () => enter(g.id, {});
      return b;
    }));
  }

  function renderPad() {
    $('coop-slots').replaceChildren(...Array.from({ length: CODE_LENGTH }, (_, i) => {
      const s = document.createElement('span');
      s.textContent = code[i] ?? '·';
      return s;
    }));
    $('coop-join-code').disabled = code.length !== CODE_LENGTH;
  }
  $('coop-keys').replaceChildren(...CODE_EMOJIS.map((e) => {
    const b = document.createElement('button');
    b.textContent = e;
    b.onclick = () => { if (code.length < CODE_LENGTH) { code.push(e); sfx.click(); renderPad(); } };
    return b;
  }));

  const message = (text) => { $('coop-msg').textContent = text ?? ''; };
  function enter(id, opts) {
    if (busy) return;
    busy = true;
    sfx.click();
    message('들어가는 중…');
    Promise.resolve(onEnter(id, opts)).catch((err) => message(err.message)).finally(() => { busy = false; });
  }

  $('coop-reroll').onclick = () => { profile().name = randomName(); save(G.state); sfx.click(); renderMe(); };
  $('coop-create').onclick = () => enter(randomGameId(), { create: true, secret: false });
  $('coop-create-secret').onclick = () => enter(randomGameId(), { create: true, secret: true });
  $('coop-code-open').onclick = () => { $('coop-pad').classList.toggle('hidden'); renderPad(); };
  $('coop-back-key').onclick = () => { code.pop(); renderPad(); };
  $('coop-join-code').onclick = () => { const id = codeToId(code); if (id) enter(id, {}); };
  $('coop-back').onclick = () => { ui.close(); onBack(); };

  const ui = {
    // open the lobby; `id` fills the code pad (a friend's link)
    async open({ id, text } = {}) {
      renderMe();
      code = id ? idToCode(id) : [];
      $('coop-pad').classList.toggle('hidden', !id);
      renderPad();
      message(text);
      $('coop').classList.remove('hidden');
      if (watching) return;
      $('coop-list').innerHTML = '<p class="coop-empty">열린 게임을 찾는 중…</p>';
      try {
        watching = await watchLobby(renderRows);
      } catch (err) {
        console.error(err);
        $('coop-list').innerHTML = '<p class="coop-empty">섬 밖과 연결할 수 없어요. 인터넷을 확인해 주세요.</p>';
      }
    },
    close() {
      $('coop').classList.add('hidden');
      watching?.stop();
      watching = null;
    },
    message,
  };
  return ui;
}
