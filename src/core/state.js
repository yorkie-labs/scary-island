// Everything the game remembers: hearts, bag, progress flags, collectibles,
// upgrades and the last checkpoint. Plain data so it saves as JSON.

export const SAVE_KEY = 'scary-island-save-v1';
export const BASE_HEARTS = 3;

export const UPGRADES = {
  bag: { ko: '탐험 가방', desc: '하트 포션을 2개 더 들 수 있어요', cost: 6 },
  shoes: { ko: '빠른 신발', desc: '더 빨리 달려요', cost: 8 },
  lamp: { ko: '강력한 손전등', desc: '동상을 더 오래 멈춰요', cost: 10 },
  bone: { ko: '행운의 뼈다귀', desc: '광석에서 다이아몬드가 더 나와요', cost: 12 },
};

export const PARTS = {
  engine: { ko: '엔진 부품', where: '해변 난파선' },
  fuel: { ko: '연료통', where: '숲속 오두막' },
  crystal: { ko: '에너지 크리스털', where: '다이아몬드 광산' },
  shipKey: { ko: '배의 열쇠', where: '동상 마을' },
};

export function newState() {
  return {
    version: 1,
    hearts: BASE_HEARTS,
    diamonds: 0,
    diamondsTotal: 0,
    potions: 0,
    items: { hammer: false, scissors: false, flashlight: false },
    parts: { engine: false, fuel: false, crystal: false, shipKey: false, generatorPart: false },
    keys: 0,
    devices: 0,
    devicesLit: [],
    mineDiamonds: 0,
    flags: {},
    collected: {}, // pickup ids already taken, so they never come back
    treats: {}, // stage -> [treat ids]
    treasures: {}, // stage -> true
    cleared: {}, // stage -> true
    upgrades: { bag: false, shoes: false, lamp: false, bone: false },
    checkpoint: null, // { x, z, region }
    playTime: 0,
  };
}

export const maxPotions = (s) => (s.upgrades.bag ? 4 : 2);

// Dog abilities grow with the treats Yorkie eats (director's call): sniffing
// from the start, rolling after the first treat, jumping after the second.
// Neither is needed to finish the game (every danger can be walked away from),
// so they reward exploring rather than gate it.
export const ABILITY_TREATS = { sniff: 0, roll: 1, jump: 2 };
export const treatsEaten = (s) => Object.values(s.treats ?? {}).reduce((n, list) => n + list.length, 0);
export const hasAbility = (s, name) => treatsEaten(s) >= (ABILITY_TREATS[name] ?? 0);

export function heal(s, n = 1) { s.hearts = Math.min(BASE_HEARTS, s.hearts + n); }

// Returns true when that hit was the last heart.
export function damage(s, n = 1) {
  s.hearts = Math.max(0, s.hearts - n);
  return s.hearts === 0;
}

export function addDiamonds(s, n) {
  s.diamonds += n;
  s.diamondsTotal += n;
}

export function spend(s, n) {
  if (s.diamonds < n) return false;
  s.diamonds -= n;
  return true;
}

export function buyUpgrade(s, key) {
  const u = UPGRADES[key];
  if (!u || s.upgrades[key] || !spend(s, u.cost)) return false;
  s.upgrades[key] = true;
  return true;
}

export function addTreat(s, stage, id) {
  const list = (s.treats[stage] ??= []);
  if (!list.includes(id)) list.push(id);
}

// GDD §8.3: 1 star to clear, 2 with the stage treasure, 3 with treasure + 3 treats.
export function stars(s, stage) {
  if (!s.cleared[stage]) return 0;
  if (!s.treasures[stage]) return 1;
  return (s.treats[stage]?.length ?? 0) >= 3 ? 3 : 2;
}

export function save(s, storage = globalThis.localStorage) {
  try { storage?.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

export function load(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.version !== 1) return null;
    // fill fields added after the save was written
    const base = newState();
    return { ...base, ...data, items: { ...base.items, ...data.items }, parts: { ...base.parts, ...data.parts },
      upgrades: { ...base.upgrades, ...data.upgrades }, flags: { ...data.flags } };
  } catch {
    return null;
  }
}

export function clearSave(storage = globalThis.localStorage) {
  try { storage?.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
