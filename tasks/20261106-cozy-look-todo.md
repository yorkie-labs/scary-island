# 2026-11-06 · 부드러운 룩 + Yorkie 기법 (secret-cave에서 가져오기)

요청: "secret-cave 에서 개선한 그래픽 + 캐릭터 작업을 여기에도 반영해볼 수 있나?"

사용자 결정 (2026-11-06):
- 그래픽: **K1만** (조명·부드러운 그림자·후처리). 지형·소품·물(K2–K4)은 하지 않는다
- 캐릭터: **기법만**. 셀 셰이딩·붓 털·캐릭터 아트에 맞춘 모양(11/1)은 그대로 두고, 귀·꼬리 스프링,
  얼굴에 붙은 눈, 가장자리 빛만 옮긴다

참고: `../secret-cave/tasks/20261105-cozy-look-todo.md`(K1 기록), `../secret-cave/tasks/20261106-maltese-look-todo.md`,
`../secret-cave/src/render/{shadowbox,light,post}.js`, `../secret-cave/test/look.test.js`, `../secret-cave/src/entities/maltese.js`.

## 두 게임의 차이 (그대로 복사하면 안 되는 곳)

| | secret-cave | scary-island |
|---|---|---|
| 시간대 | 늘 `night` 리그 하나 | 지역마다 낮→황금→노을→밤 (`REGION_TIME`), 걸으면 `look.setTime`이 색·세기·고도를 다시 씀 |
| 카메라 피치 | 40° | 35° (`isoCamera.js`), 지하는 거리 17 m 상한 |
| 그림자 | 직접 키 라이트 위치 지정 | `look.follow` + `place()`가 매 프레임 키를 방위 38°에 둠, `shadowSpan` 50 정사각형 |
| 주인공 재질 | MeshStandard + 림 셰이더 | MeshToon(3단 램프) + 붓 털 텍스처 |
| 기타 | 컷신은 `plain` 모드 | 인트로·엔딩(`story.js`), 손전등·마을 등불(점광원), 협동 모드의 다른 Yorkie들, 별 하늘 돔 |

## 계획 (렌더링·외형만; 규칙·충돌·길찾기·클릭 판정·카메라 피치 불변)

- [x] **0 기준 샷** — `scripts/e2e.mjs`에 `SIZE=WxH`, `scripts/scenarios/k1-look.js`: 지역 6곳(해변 낮·캠프·숲 노을·광산 밤·마을·항구)
      같은 자리 스크린샷 + 성능(fps·p95·드로 콜), Yorkie 가까이(정면·3/4·옆·멀리 30 m), `&tag=`, `&q=low`. "before" 먼저 찍는다
- [x] **1 `src/render/shadowbox.js`** (순수, secret-cave에서 이식) — `TO_KEY`(카메라 앞-왼쪽 위), 텍셀 스냅, 시야 모서리 → 그림자 직사각형.
      테스트는 피치 35° 중심으로(카메라 쪽 면 N·L > 0.25, 그림자는 화면 위쪽, 박스가 시야를 모두 담음, 텍셀 크기)
- [x] **2 `src/render/light.js` `islandLight(look)`** — 키 라이트 방향·그림자 박스를 넘겨받는다(`place()`가 덮어쓰지 않게 `look.update()` 다음에
      매 프레임). 시간대 색은 stage 것을 쓰되 **휘도는 그대로 두고** 반구광 하늘을 조금 푸르게·땅을 조금 따뜻하게 기울인다 —
      `setTime`이 색을 다시 쓸 때마다 다시 적용(감싸기). `shadow.intensity` < 1(그림자가 검지 않고 푸른 회색), 림 라이트 유지.
      고도: 시간대 고도(`look.elevation`, 노을엔 낮음) vs 고정 50°는 샷으로 결정
- [x] **3 `src/render/post.js`** — `postprocessing` + `n8ao` 새 의존성(zlib / ISC → README 크레딧). 4× MSAA → high: N8AO(은은, 푸른 기) →
      블룸(밝은 것만: 등불·손전등·수정·버섯 빛) + 색 보정 + 비네트; low: 보정 + 비네트, 그림자 지도 1024. 톤매핑 없음.
      `?q=low|high` → 저장값 → 작은 터치 화면은 low. 메뉴에 `화질: 높음/낮음` 토글. 캔버스 `antialias: false`
- [x] **4 연결** — `main.js` 메인 루프(`look.update()` → `light.update(lens)` → `post.render`), 창 크기. 인트로·엔딩은 효과 켠 판/`plain` 판을
      찍어 보고 결정(secret-cave는 어두운 장면이 망가져 `plain`). 밤 지역(광산·마을)에서 손전등·등불이 블룸으로 너무 번지지 않는지
- [x] **5 Yorkie 눈** — 얼굴 앞면에 붙은 데칼(머리 중심의 구 껍질 조각)로, 3/4에서 튀어나오거나 잘리지 않게. 갈색 홍채·검은 눈동자·반짝임 둘,
      외곽선 없음(`userData.noOutline`, `outline.js`에 한 줄). 깜빡임(`scale.y`)은 그대로 동작
- [x] **6 귀·꼬리 스프링** — 2차 움직임: 귀·꼬리가 몸 기울기·고개·통통 튐을 늦게 따라감(secret-cave `follow`). 지금의 흔들기·바람에 젖힌 귀 위에 더함.
      멈춘 포즈(dt 0)에서는 쉼, 큰 dt에도 안정
- [x] **7 가장자리 빛** — 털 재질(toon)에 약한 프레넬 림, 멀리(30 m)·밤에서도 Yorkie가 땅에서 떨어져 보이게. 셀 셰이딩 3단 톤은 유지
- [x] **8 검증** — `npm test`, `npm run build`, `full.js`(엔딩까지), `mobile.mjs`, 협동(`scripts/coop.mjs` — 다른 Yorkie도 스프링·눈),
      같은 자리 전/후 샷(1100×800 + 1600×900), 성능 표(high/low)
- [x] **문서** — 이 파일 Review, lessons(`20261031-scary-island-gdd-lessons.md`), `tasks/README.md`, README 크레딧

순서: 0 → 1·2 → 3·4 → (샷 확인) → 5·6·7 → 8. 그래픽과 캐릭터는 커밋을 나눈다.

## 가져오는 교훈 (secret-cave / wild-island)
- 해는 카메라 쪽에, 방향은 테스트로 고정 / 그림자 박스는 시야 모서리 광선으로 재고 텍셀 스냅, 정사각형 말고 직사각형
- 톤매핑 없음(이 게임에서 ACES가 Polyfork 색을 바랬다) / 색만 바꾸고 휘도 유지 → 이미 맞춘 팔레트가 그대로
- 깊이를 안 쓰는 가산 빛 밑은 AO를 걷어 냄(`transparencyAware`) / 화면 비율별 확인(16:9도)
- 샷을 직접 보고 고친다. 검사를 통과시키려고 구현을 맞추지 않는다
- 사용자가 자기 Chrome 탭에서 플레이 중 → 헤드리스로만 확인

## Review (2026-11-06)

커밋 두 개: 그래픽 `a8ea568` (조명·그림자·후처리), 그다음 Yorkie (눈·스프링·가장자리 빛)와 문서.

### 그래픽
- `render/shadowbox.js`: secret-cave에서 옮김. `toKey(elevDeg)`로 키 높이를 인자로 받게 했다
- `render/light.js` `islandLight`: stage의 `setTime`을 감싸서 색이 바뀔 때마다 반구광을 곱셈 틴트(하늘 ×(0.88, 0.96, 1.18),
  땅 ×(1.14, 1, 0.84))로 바꾸고 휘도는 되돌린다. 처음엔 secret-cave처럼 정해진 색으로 lerp했는데, 밤하늘(이미 더 푸름)이
  오히려 덜 푸르게 돼서 테스트가 잡았다 → 곱셈으로. 키 높이는 stage의 해 높이를 30–50°로 묶어서 따른다. 고정 50°로 먼저 찍어
  봤더니 노을 숲의 긴 그림자 분위기가 사라져서 바꿨다. 그림자 세기 0.62
- `render/post.js`: secret-cave 그대로(품질 키 `scary-island-quality`). 인트로·엔딩은 효과를 켠 채로 찍어 봤고 문제없어서
  `plain` 모드는 쓰지 않는다
- 메뉴 `화질: 높음/낮음` 토글, `?q=low|high`, 작은 터치 화면은 낮음으로 시작(`mobile.mjs`의 휴대폰·태블릿 정상)
- `isoCamera.js`: `ISO_PITCH`, `DIST_MIN/MAX`를 export(테스트용)
- 샷으로 본 차이(`scratchpad/shots/before-*` / `a2-*`): 캠프·마을·광산을 가로지르던 검고 긴 사선 그림자 띠가 사라지고
  그림자가 화면 위쪽으로 떨어진다. 카메라 쪽 면이 밝다. 밤 마을은 그림자가 옅어져 덜 극적이지만 더 포근하다

### Yorkie
- 눈: `DecalGeometry`로 머리 공(icosahedron)의 면에 투영한 그림 데칼(캔버스: 얇은 어두운 테두리, 갈색 홍채, 큰 눈동자,
  하이라이트 둘, 좌우 대칭). 외곽선 없음, 그림자 안 드리움, 깜빡임은 그대로. 3/4에서 먼 눈이 원반처럼 튀어나오던 게
  주둥이 뒤로 자연스럽게 숨는다
- 귀·꼬리 스프링: 끄덕임·기울기·통통 튐을 늦게 따라감. dt 0이면 쉼, dt 0.1에도 안정
- 털 가장자리 빛: toon 재질에 셀 톤처럼 날카롭게 자른 프레넬 밴드(#ffe6b8 × 0.45). 밤 광산에서도 바닥과 구분된다
- 셀 셰이딩·붓 털·머리 모양은 그대로

### 검증
- `npm test` 7파일 93/93(새 `look.test.js` 21, `yorkie.test.js` 6), `npm run build` PASS
- `full.js` 엔딩까지 두 번(그래픽 뒤, Yorkie 뒤) PASS, 페이지 오류 0. `scripts/coop.mjs` 32/32. `mobile.mjs` 휴대폰 세로·가로·태블릿 정상
- 같은 자리 샷: 1100×800 high/low, 1600×900 high, Yorkie 정면·3/4·옆·게임 각도·노을·밤
- 1600×900 실행 한 번이 "Execution context was destroyed"(페이지 이동)로 중간에 죽었고, 다시 돌리니 통과. Vite 로그엔 그 시각
  새로고침이 없었다. 원인은 못 찾음
- 성능(헤드리스, 60 fps 상한이라 fps는 모두 60, p95 16.7–16.8 ms 동일), 한 프레임 드로 콜:

| 자리 | 전 | high | low | high 16:9 |
|---|---|---|---|---|
| 해변 | — | 744 | 694 | 832 |
| 캠프 | 824 | 810 | 757 | 902 |
| 숲 | 1254 | 837 | 776 | 1082 |
| 마을 | 691 | 771 | 699 | 844 |
| 항구 | 674 | 684 | 627 | 754 |
| 광산 | 362 | 382 | 332 | 369 |

  (숲은 그림자 박스가 50 m 정사각형에서 시야에 맞춘 사각형으로 바뀌어 오히려 줄었다.) 번들 JS 5,355 kB / gzip 1,999 kB
