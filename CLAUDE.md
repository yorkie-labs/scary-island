# Scary Island

아이들을 위한 귀엽고 살짝 무서운 3D 섬 탈출 어드벤처(주인공 강아지 Yorkie, 5개 스테이지). three.js + Rapier + Vite (JavaScript).
배포: https://yorkie-labs.github.io/scary-island/ (공개 저장소 `yorkie-labs/scary-island`)

## 명령
- `npm run dev` → http://localhost:5173 (predev가 Polyfork 에셋을 받아 옴)
- `npm test` (vitest), `npm run build` (prebuild로 에셋 받은 뒤 `vite build`), `npm run preview`
- `node scripts/e2e.mjs scripts/scenarios/<name>.js` — 헤드리스 Chrome 시나리오(개발 서버 필요, `GAME_URL`로 대상 변경). `full.js`는 새 게임 → 엔딩 전체 플레이
- 완료 전에는 `npm test`, `npm run build`, 관련 시나리오(가능하면 `full.js`)를 통과시킨다

## 구조
- `src/main.js` 부트·메인 루프·키 바인딩 / `src/core/` 게임 컨텍스트(G)·상태(save)·퀘스트(데이터)
- `src/world/map.js` 섬 지형(순수 함수) / `src/world/regions/*.js` 스테이지별 빌더 / `src/world/models.js` Polyfork 모델 목록
- `src/entities/` Yorkie·몬스터 / `src/systems/` 클릭 이동(pointer)·길찾기(nav)·손전등 / `src/player/` 컨트롤러·디아블로식 카메라 / `src/ui/` HUD·메뉴·터치
- `src/render/` 조명(카메라 쪽 키 라이트·그림자 박스)·후처리(N8AO·블룸·색 보정, `?q=low`/메뉴 화질 토글)
- 조작은 디아블로식 한 가지(마우스 + 숫자 1~4, Space, Tab, Esc). WASD·3인칭은 일부러 제거함
- 디버그: 페이지에서 `window.G`

## 배포
- main에 푸시 → `.github/workflows/pages.yml`이 테스트·빌드 후 Pages 배포. 즉 **main 푸시 = 공개 배포**
- `vite.config.js`의 base는 `'./'`(상대 경로). 에셋 URL은 `/`로 시작하지 않는다

## 라이선스 제약 (중요)
- Polyfork 모델: 재배포 금지 → 프로덕션은 polyfork.dev CDN에서 런타임 로드, 빌드가 `dist/assets/polyfork`를 지움. 로컬 사본(`public/assets/polyfork/`, `src/vendor/polyfork/`)은 gitignore, 절대 커밋하지 않음
- Jua 폰트: OFL, `@fontsource/jua`로 번들
- 새 외부 에셋을 넣을 때는 라이선스를 먼저 확인하고 README 크레딧에 추가

## 작업 방식
- 작업 문서는 `tasks/`(목차 `tasks/README.md`). lessons는 `tasks/20261031-scary-island-gdd-lessons.md`에 누적
- 브라우저 확인은 헤드리스(`scripts/e2e.mjs`)로. 사용자가 자기 Chrome 탭에서 플레이 중이므로 그 탭은 건드리지 않는다
- 크레딧: 딸 Jiyu, 아빠 Hackerwins
