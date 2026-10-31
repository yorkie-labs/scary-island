// The five stages and their missions, in the GDD's own order (§5). Each step
// is done when its test on the game state passes; `at` names a world marker
// the HUD and minimap point to.

const f = (name) => (s) => !!s.flags[name];

export const STAGES = [
  {
    id: 1, key: 'beach', name: 'LOST BEACH', ko: '잃어버린 해변',
    steps: [
      { text: '해변에서 깨어나기', done: f('awake') },
      { text: '주변 탐험하기', done: f('explored'), at: 'wreck', showIf: (s) => !s.items.hammer },
      { text: '망치 찾기', done: (s) => s.items.hammer, at: 'hammer' },
      { text: '다이아몬드 3개 캐기', done: (s) => s.diamondsTotal >= 3 || f('doorOpen')(s), at: 'beachOre', count: (s) => `${Math.min(3, s.diamondsTotal)}/3` },
      { text: '돌 괴물이 깨어났다!', done: f('rockyWoke'), showIf: () => false },
      { text: '괴물을 피해 도망치거나 기절시키기', done: f('rockyEscaped'), showIf: (s) => !!s.flags.rockyWoke && !s.flags.doorOpen },
      { text: '돌문에 다이아몬드를 끼워 문 열기', done: f('doorOpen'), at: 'stoneDoor' },
      { text: '중앙 캠프로 이동하기', done: f('campReached'), at: 'camp' },
    ],
  },
  {
    id: 2, key: 'forest', name: 'WHISPERING FOREST', ko: '속삭이는 숲',
    steps: [
      { text: '숲 입구로 가기', done: f('forestEntrance'), at: 'vines' },
      { text: '가위 찾기', done: (s) => s.items.scissors, at: 'scissors' },
      { text: '가위로 덩굴 자르기', done: f('vinesCut'), at: 'vines' },
      { text: '손전등 찾기', done: (s) => s.items.flashlight, at: 'flashlight' },
      { text: '움직이는 동상을 찾아보기', done: f('watcherSeen'), at: 'watchers', showIf: (s) => !s.flags.pastWatchers },
      { text: '동상을 계속 바라보며 지나가기', done: f('pastWatchers'), at: 'hut' },
      { text: '오두막에서 발전기 부품 찾기', done: (s) => s.parts.generatorPart && s.parts.fuel, at: 'hut' },
      { text: '광산 문 옆 발전기 고치기', done: f('generatorFixed'), at: 'generator' },
      { text: '광산 문 열기', done: f('mineDoorOpen'), at: 'mineDoor' },
    ],
  },
  {
    id: 3, key: 'mine', name: 'DIAMOND MINE', ko: '다이아몬드 광산',
    steps: [
      { text: '광산 엘리베이터 타기', done: f('inMine'), at: 'elevator' },
      { text: '광석 캐기', done: f('mineOreMined'), at: 'mineOre' },
      { text: '광산 다이아몬드 5개 모으기', done: (s) => s.mineDiamonds >= 5 || f('collapseEscaped')(s), count: (s) => `${Math.min(5, s.mineDiamonds)}/5` },
      { text: '무너지는 통로에서 탈출하기', done: f('collapseEscaped'), at: 'collapseEnd' },
      { text: '광산 카트를 타고 도망치기', done: f('cartDone'), at: 'cart' },
      { text: '크리스털 골렘 잠재우기 (등 뒤 크리스털을 노려요)', done: f('golemAsleep'), at: 'golem' },
      { text: '에너지 크리스털 얻기', done: (s) => s.parts.crystal, at: 'energyCrystal' },
    ],
  },
  {
    id: 4, key: 'village', name: 'STATUE VILLAGE', ko: '동상 마을',
    steps: [
      { text: '동상 마을로 들어가기', done: f('villageEntered'), at: 'villageDoor' },
      { text: '동상이 언제 움직이는지 살펴보기', done: f('villageWatcherSeen'), showIf: (s) => !s.flags.ancientGateOpen && s.keys < 3 },
      { text: '손전등으로 동상 멈추기 (오른쪽 클릭)', done: f('watcherFrozen'), showIf: (s) => !s.flags.ancientGateOpen && s.keys < 3 },
      { text: '마을의 열쇠 3개 모으기', done: (s) => s.keys >= 3 || f('ancientGateOpen')(s), at: 'key', count: (s) => `${Math.min(3, s.keys)}/3` },
      { text: '고대 문 열기', done: f('ancientGateOpen'), at: 'ancientGate' },
      { text: '섬의 수호자를 만나기', done: f('guardianMet'), at: 'guardian' },
      { text: '크리스털 장치 3개 켜기', done: (s) => s.devices >= 3 || f('sealReleased')(s), at: 'device', count: (s) => `${Math.min(3, s.devices)}/3` },
      { text: '봉인 해제하기', done: f('sealReleased'), at: 'seal' },
    ],
  },
  {
    id: 5, key: 'harbor', name: 'ESCAPE ISLAND', ko: '섬 탈출',
    steps: [
      { text: '항구에 도착하기', done: f('harborReached'), at: 'sealBarrier' },
      { text: '배 상태 확인하기', done: f('boatChecked'), at: 'boat' },
      { text: '부품 4개 모두 모았는지 확인하기', done: (s) => Object.entries(s.parts).every(([k, v]) => k === 'generatorPart' || v), count: (s) => `${['engine', 'fuel', 'crystal', 'shipKey'].filter((k) => s.parts[k]).length}/4` },
      { text: '엔진 고치기', done: f('engineFixed'), at: 'boat' },
      { text: '연료 넣기', done: f('fuelFilled'), at: 'boat' },
      { text: '크리스털 끼우기', done: f('crystalFitted'), at: 'boat' },
      { text: '엔진이 데워질 때까지 괴물들을 피하기!', done: f('finalChase'), at: 'boat' },
      { text: '배에 타기', done: f('boarded'), at: 'boat' },
      { text: '섬을 탈출하기', done: f('escaped') },
    ],
  },
];

// The first unfinished step of the first unfinished stage.
export function currentObjective(s) {
  for (const stage of STAGES) {
    // a stage that is cleared, or whose last mission is done, is behind us,
    // even if a small earlier step (say, walking past the wreck) was skipped
    if (s.cleared?.[stage.id] || stage.steps.at(-1).done(s)) continue;
    // story beats (showIf) are shown only while they still matter; otherwise
    // the objective moves on to the next thing the child can actually do
    const index = stage.steps.findIndex((step) => !step.done(s) && (!step.showIf || step.showIf(s)));
    if (index === -1) continue;
    const step = stage.steps[index];
    return { stage, index, step, text: step.count ? `${step.text} (${step.count(s)})` : step.text };
  }
  return null; // all done: escaped
}

export function stageDone(s, id) {
  return STAGES.find((st) => st.id === id).steps.every((step) => step.done(s));
}
