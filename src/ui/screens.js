import { STAGES } from '../core/quests.js';
import { UPGRADES, buyUpgrade, stars } from '../core/state.js';
import { sfx, setMuted, isMuted } from '../audio/sound.js';
import { icon } from './icons.js';

// what each shop thing looks like (the stronger lamp is the flashlight)
const SHOP_ICONS = { bag: 'bag', shoes: 'shoes', lamp: 'flashlight', bone: 'bone' };

const $ = (id) => document.getElementById(id);

export const CONTROLS_HTML = `
  <kbd>왼쪽 클릭</kbd> 땅: 걸어가기(꾹 = 따라가기) · 몬스터/광석: 망치 · 물건/문: 가서 사용<br>
  <kbd>오른쪽 클릭</kbd> 손전등 · <kbd>1</kbd> 냄새(이름표) · <kbd>2</kbd> 구르기 · <kbd>3</kbd> 점프 · <kbd>4</kbd> 포션<br>
  <kbd>Space</kbd> 가까운 것 사용 · 대화 넘기기 · <kbd>B</kbd> 짖기 · 구르기·점프는 강아지 간식을 먹으면 배워요<br>
  <kbd>Tab</kbd> 섬 지도 · 휠 확대 · <kbd>Esc</kbd> 메뉴`;
export const TOUCH_CONTROLS_HTML = `
  <kbd>땅을 톡</kbd> 걸어가기 · <kbd>조이스틱</kbd> 움직이기 · 🔨 망치(가까운 광석·몬스터 쪽으로)<br>
  👃 냄새(이름표) · 🌀 구르기 · ⤴ 점프 · 🔦 손전등 · 🧪 포션: 아래 가방을 톡<br>
  ✋ 가까이 가면 나타나는 버튼을 톡 · 🗺️ 섬 지도 · ☰ 메뉴 · 두 손가락으로 확대/축소<br>
  구르기·점프는 강아지 간식을 먹으면 배워요`;

export function createScreens(G, { onRestart }) {
  const screens = G.screens = {
    menuOpen: false,
    shopOpen: false,

    openMenu() {
      if (G.mode !== 'play' && G.mode !== 'dialog') return;
      screens.menuOpen = true;
      G.mode = 'menu';
      G.input.enabled = false;
      $('menu-stars').innerHTML = STAGES.map((st) => {
        const n = stars(G.state, st.id);
        return `<span>STAGE ${st.id} · ${st.ko}</span><span>${'★'.repeat(n)}${'☆'.repeat(3 - n)} 🦴${G.state.treats[st.id]?.length ?? 0}/3</span>`;
      }).join('');
      $('menu-controls').innerHTML = G.touch ? TOUCH_CONTROLS_HTML : CONTROLS_HTML;
      $('btn-mute').textContent = isMuted() ? '소리 켜기' : '소리 끄기';
      renderCoop();
      $('menu').classList.remove('hidden');
    },
    closeMenu() {
      screens.menuOpen = false;
      $('menu').classList.add('hidden');
      G.settle();
    },

    openShop() {
      screens.shopOpen = true;
      G.mode = 'menu';
      G.input.enabled = false;
      renderShop();
      $('shop').classList.remove('hidden');
    },
    closeShop() {
      screens.shopOpen = false;
      $('shop').classList.add('hidden');
      G.settle();
    },
  };

  function renderShop() {
    $('shop-items').innerHTML = Object.entries(UPGRADES).map(([k, u]) => {
      const owned = G.state.upgrades[k];
      return `<div class="shop-item ${owned ? 'owned' : ''}">${icon(SHOP_ICONS[k], '', 'shop-ico')}<h3>${u.ko}</h3><p>${u.desc}</p>
        <button data-buy="${k}" ${owned ? 'disabled' : ''}>${owned ? '가지고 있어요' : `${icon('diamond', '💎')} ${u.cost}`}</button></div>`;
    }).join('') + `<div class="shop-item">${icon('potion', '', 'shop-ico')}<h3>하트 포션</h3><p>하트 1개를 회복해요</p><button data-buy="potion">${icon('diamond', '💎')} 3</button></div>`;
    $('shop-items').querySelectorAll('[data-buy]').forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.buy;
        let ok;
        if (k === 'potion') {
          const max = G.state.upgrades.bag ? 4 : 2;
          ok = G.state.diamonds >= 3 && G.state.potions < max;
          if (ok) { G.state.diamonds -= 3; G.state.potions++; }
        } else ok = buyUpgrade(G.state, k);
        if (ok) { sfx.item(); G.refresh(); } else { sfx.hurt(); G.toast('다이아몬드가 부족하거나 더 들 수 없어요'); }
        renderShop();
      };
    });
  }

  // playing together: the game's code (and a link to share it), who is here,
  // and leaving. Like Diablo II there is no closing a game on friends: it
  // ends when the last one leaves.
  function renderCoop() {
    const net = G.net;
    $('menu-title').textContent = net ? '메뉴 (게임은 계속돼요!)' : '잠깐 쉬어요';
    $('menu-coop').classList.toggle('hidden', !net);
    $('btn-restart').classList.toggle('hidden', !!net); // no wiping the character mid-game
    $('btn-leave').classList.toggle('hidden', !net);
    if (!net) return;
    const label = document.createElement('b');
    label.textContent = net.secret ? '🔒 코드' : '코드';
    const copy = Object.assign(document.createElement('button'), { id: 'btn-copy-link', textContent: '링크 복사' });
    copy.onclick = () => {
      const url = `${location.origin}${location.pathname}?game=${net.id}`;
      navigator.clipboard?.writeText(url).then(() => G.toast('링크를 복사했어요! 친구에게 보내 주세요'), () => G.toast(url, 6000));
    };
    $('menu-coop-code').replaceChildren(label, ...net.code.map((e) => Object.assign(document.createElement('span'), { textContent: e })), copy);
    $('menu-coop-players').replaceChildren(...net.players().map((p) => {
      const tag = document.createElement('span');
      tag.textContent = `${p.id === net.owner ? '👑 ' : ''}${p.name}${p.me ? ' (나)' : ''}`;
      tag.style.setProperty('--hoodie', p.color);
      return tag;
    }));
  }
  $('btn-leave').onclick = () => screens.onLeave?.();

  $('btn-resume').onclick = () => { screens.closeMenu(); screens.onResume?.(); };
  $('btn-shop-close').onclick = () => { screens.closeShop(); screens.onResume?.(); };
  $('btn-mute').onclick = () => { setMuted(!isMuted()); $('btn-mute').textContent = isMuted() ? '소리 켜기' : '소리 끄기'; };
  // starting over wipes the save: ask with a second press (no native dialog)
  let restartArmed = -Infinity; // performance.now() starts at 0 with the page
  $('btn-restart').onclick = () => {
    if (performance.now() - restartArmed < 3000) { onRestart(); return; }
    restartArmed = performance.now();
    $('btn-restart').textContent = '정말요? 한 번 더 누르면 처음부터!';
    setTimeout(() => { $('btn-restart').textContent = '처음부터'; }, 3000);
  };
  return screens;
}

// Big centred card when a stage is cleared, with its stars (GDD §8.3).
export async function stageClearCard(G, stageId) {
  const st = STAGES.find((s) => s.id === stageId);
  G.state.cleared[stageId] = true;
  G.refresh();
  sfx.fanfare();
  const n = stars(G.state, stageId);
  const hint = n < 3 ? `<p style="font-size:17px;opacity:.85">${G.state.treasures[stageId] ? '' : '숨겨진 보물 상자 · '}간식 ${G.state.treats[stageId]?.length ?? 0}/3 — 나중에 다시 와서 찾아봐요!</p>` : '<p>완벽해요!</p>';
  await G.hud.card(`<p>STAGE ${stageId}</p><h2>${st.name} CLEAR!</h2><div class="stars">${'⭐'.repeat(n)}${'☆'.repeat(3 - n)}</div>${hint}`, 3200);
}
