import { describe, it, expect } from 'vitest';
import { newState, stars, buyUpgrade, addDiamonds, damage, heal, load, save, maxPotions, hasAbility, addTreat } from '../src/core/state.js';
import { currentObjective, STAGES } from '../src/core/quests.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

describe('quests follow the GDD order', () => {
  it('starts on the beach, waking up', () => {
    const o = currentObjective(newState());
    expect(o.stage.id).toBe(1);
    expect(o.text).toBe('해변에서 깨어나기');
  });
  it('Stage 1 keeps the GDD mission order', () => {
    const texts = STAGES[0].steps.map((s) => s.text);
    expect(texts.indexOf('망치 찾기')).toBeLessThan(texts.indexOf('다이아몬드 3개 캐기'));
    expect(texts.at(-1)).toBe('중앙 캠프로 이동하기');
  });
  it('the forest gives the flashlight before the statues (director call)', () => {
    const texts = STAGES[1].steps.map((s) => s.text);
    expect(texts.indexOf('손전등 찾기')).toBeGreaterThan(texts.indexOf('가위로 덩굴 자르기'));
    expect(texts.indexOf('손전등 찾기')).toBeLessThan(texts.indexOf('움직이는 동상을 찾아보기'));
    expect(STAGES[3].steps.some((s) => s.text === '손전등 찾기')).toBe(false);
  });
  it('moves on to the forest once Stage 1 is done', () => {
    const s = newState();
    Object.assign(s.flags, { awake: true, explored: true, rockyWoke: true, rockyEscaped: true, doorOpen: true, campReached: true });
    s.items.hammer = true;
    expect(currentObjective(s).stage.id).toBe(2);
  });
  it('a cleared stage never holds the display back, even with a skipped step', () => {
    const s = newState();
    Object.assign(s.flags, { awake: true, doorOpen: true, campReached: true }); // never walked by the wreck
    s.items.hammer = true;
    s.cleared[1] = true;
    expect(currentObjective(s).stage.id).toBe(2);
  });
  it('shows counts on counted steps', () => {
    const s = newState();
    Object.assign(s.flags, { awake: true, explored: true });
    s.items.hammer = true;
    addDiamonds(s, 2);
    expect(currentObjective(s).text).toBe('다이아몬드 3개 캐기 (2/3)');
  });
});

describe('state', () => {
  it('stars: 1 clear, 2 with treasure, 3 with treasure and 3 treats', () => {
    const s = newState();
    expect(stars(s, 1)).toBe(0);
    s.cleared[1] = true; expect(stars(s, 1)).toBe(1);
    s.treasures[1] = true; expect(stars(s, 1)).toBe(2);
    s.treats[1] = ['a', 'b', 'c']; expect(stars(s, 1)).toBe(3);
  });
  it('buys upgrades with diamonds only once', () => {
    const s = newState();
    expect(buyUpgrade(s, 'shoes')).toBe(false);
    addDiamonds(s, 10);
    expect(buyUpgrade(s, 'shoes')).toBe(true);
    expect(s.diamonds).toBe(2);
    expect(buyUpgrade(s, 'shoes')).toBe(false);
  });
  it('hearts: three, last hit faints, healing caps', () => {
    const s = newState();
    expect(damage(s)).toBe(false);
    expect(damage(s, 2)).toBe(true);
    heal(s, 9);
    expect(s.hearts).toBe(3);
  });
  it('abilities grow with treats: sniff at start, roll after 1, jump after 2', () => {
    const s = newState();
    expect(hasAbility(s, 'sniff')).toBe(true);
    expect(hasAbility(s, 'roll')).toBe(false);
    addTreat(s, 1, 'beach-a');
    expect(hasAbility(s, 'roll')).toBe(true);
    expect(hasAbility(s, 'jump')).toBe(false);
    addTreat(s, 2, 'forest-a');
    expect(hasAbility(s, 'jump')).toBe(true);
  });
  it('bag upgrade raises potion capacity', () => {
    const s = newState();
    expect(maxPotions(s)).toBe(2);
    s.upgrades.bag = true;
    expect(maxPotions(s)).toBe(4);
  });
  it('saves and loads', () => {
    const store = memory();
    const s = newState();
    s.flags.awake = true; s.items.hammer = true;
    save(s, store);
    const l = load(store);
    expect(l.flags.awake).toBe(true);
    expect(l.items.hammer).toBe(true);
    expect(l.items.scissors).toBe(false);
  });
});
