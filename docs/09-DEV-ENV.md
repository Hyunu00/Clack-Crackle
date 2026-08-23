# 09 — 개발 환경

## 스택

| 레이어 | 선택 | 확인된 버전 |
|---|---|---|
| 런타임 | Node.js LTS + npm | v22 이상 |
| 언어 | TypeScript (strict) | 5.9.x |
| 렌더 | PixiJS | 8.20.x |
| 큰 수 | break_infinity.js | 2.2.x |
| 오디오 | howler.js | 2.2.4 |
| 에셋 파이프라인 | @assetpack/core | 1.7.0 |
| 번들러 | Vite | 6.4.x |
| 테스트 | Vitest | 3.2.x |
| 스크립트 실행 | tsx | 4.23.x |
| 화면 검증 | Playwright | 1.62.x |
| 린트/포맷 | Biome | 2.5.x |
| 데스크톱 (나중) | Electron + electron-builder + steamworks.js | — |

**웹 스택을 고른 이유는 AI 에이전트 주도 개발이 전제이기 때문이다.**
Unity/Godot 은 씬 조립과 인스펙터가 에디터 GUI 안에 있어 에이전트가
절반만 일한다. 웹 스택은 전부 텍스트 파일이고, 브라우저 + Playwright 로
에이전트가 스스로 화면을 확인하고 고칠 수 있다.

자세한 배경은 `docs/06-DECISIONS.md`.

---

## 설치

```bash
npm create vite@latest keycap-clicker -- --template vanilla-ts
cd keycap-clicker
npm install

# 런타임
npm i pixi.js break_infinity.js howler

# 개발
npm i -D @types/howler @types/node tsx vitest @playwright/test @biomejs/biome @assetpack/core
npx playwright install chromium
npx biome init
```

---

## 폴더 구조

```
src/
  core/                순수 로직. pixi / howler 를 import 하지 않는다
    numbers.ts           Decimal, 포맷, 시드 RNG
    state.ts             GameState (3층 구조), GameEvent
    engine.ts            순수 함수 전부
    save.ts              직렬화 + 버전 마이그레이션
    content/             ★ 모든 밸런스 수치와 콘텐츠 정의
      balls.ts             종류 50 + 등급 5 (직교)
      keycaps.ts           24종
      roulette.ts          확률표, 비용 곡선
      skilltree.ts         노드 + 자동화 3단계
      audio.ts             사운드 정의 (데이터만)
  i18n/                ★ 문자열. 1일차부터 존재해야 한다
    index.ts             t(key) 20줄이면 충분
    locales.ts           LOCALES 배열. 언어 추가 시 고치는 유일한 코드 파일
    ko.json / en.json / ...   docs/10-I18N.md 의 티어 표
  audio/               howler 재생. GameEvent 구독
  render/              Pixi. 상태를 읽고 그리기만
  ui/                  HTML HUD
  platform/            web / steam 추상화
  main.ts

scripts/
  sim.ts               tsx 로 실행하는 밸런스 리포트

assets/                AssetPack 입력 (raw PNG)
public/
  atlas/               AssetPack 출력 (스프라이트시트)
  sfx/                 음원

tests/
  balance.test.ts      페이싱 단언
  engine.test.ts       단위 테스트
  save-migration.test.ts
  fixtures/            버전별 세이브 픽스처
  visual.spec.ts       Playwright 스크린샷
```

---

## 명령어

```json
"scripts": {
  "dev": "vite",
  "assets": "assetpack",
  "sim": "tsx scripts/sim.ts",
  "test": "vitest run",
  "shot": "playwright test",
  "lint": "biome check --write .",
  "check": "biome check . && tsc --noEmit && vitest run"
}
```

| | 언제 |
|---|---|
| `npm run dev` | 항상 켜두고 작업 |
| `npm run assets` | `assets/` 에 PNG 를 추가/수정한 뒤 |
| `npm run sim` | **밸런스 수치를 건드린 뒤 반드시** |
| `npm run shot` | **화면을 건드린 뒤 반드시** |
| `npm run check` | 커밋 전 |

---

## 이 프로젝트의 개발 방식

일반적인 게임 프로젝트와 다른 점 하나.

```ts
tick(state, dt, rng) -> { state, events }
```

`src/core/` 가 렌더와 완전히 분리된 순수 함수라서:

- 20시간치 플레이를 테스트에서 **0.1초**에 시뮬레이션할 수 있다
- 밸런스를 바꾸고 결과를 표로 즉시 확인할 수 있다
- 에이전트가 "돌려보고 알려주세요"라고 묻지 않고 스스로 검증하고 고친다

### 성능 관련 — 최적화하지 말 것

20시간(프레스 약 576,000회) 시뮬레이션을 실측한 결과:

| 방식 | 소요 |
|---|---|
| **불변 (현재 설계)** | **91 ms** |
| 가변 최적화 | 63 ms |
| 초 단위 배치 | 19 ms |

**불변 설계 그대로 간다.** 가챠·환생·스킬 구매 오버헤드를 10배 얹어도 1초다.
순수 함수라는 성질이 이 프로젝트의 핵심 자산인데 성능 때문에 깨뜨릴 이유가 없다.
`{...state}` 스프레드를 mutable 로 바꾸자는 제안이 나오면 이 표를 근거로 거절할 것.

---

## 반드시 지켜야 하는 것 네 가지

### ① i18n 은 콘텐츠 데이터보다 먼저

이름을 전부 placeholder 로 가기로 했고, 왁뿌볼 50 + 키캡 24 =
**고유명사 74개**다. i18n 없이 시작하면 74번 하드코딩하고 전부 뜯어내야 한다.

```ts
// 이렇게
{ id: 1, nameKey: "ball.type.001", rarity: 1, baseValue: 40 }

// 이러면 안 됨
{ id: 1, name: "사과", rarity: 1, baseValue: 40 }
```

게임용이라 i18next 는 과하다. JSON 로드 + `t(key)` 20줄이면 충분하다.

출시 언어가 **9개**이고 출시 후 6개가 더 붙는다. 그래서 요구사항이 하나 더 있다 —
**언어 추가가 JSON 1개 + `locales.ts` 1줄로 끝나야 한다.**
설정 화면의 언어 목록도 `LOCALES` 를 읽어서 그린다. 언어를 추가할 때
UI 코드를 고치는 일이 있으면 설계가 잘못된 것이다.

폰트 프로필, 폴백 규칙, 언어 추가 절차, 검증은 전부 `docs/10-I18N.md`.

### ② 에셋은 스프라이트시트로

왁뿌볼 50 + 키캡 24 + 균열 5 + UI/이펙트 = **90장 이상**.
개별 PNG 로 로드하면 요청 90번에 Pixi 배칭도 못 쓴다.

`assets/` 에 PNG 를 넣고 `npm run assets` → `public/atlas/` 로 패킹된다.
런타임 코드는 아틀라스에서 프레임 이름으로 꺼내 쓴다.

### ③ 콘텐츠 50종은 손으로 쓰지 말 것

`balls.ts` 에 50개 항목을 손으로 나열하면 오타와 불균형이 반드시 생긴다.
**희귀도 테이블 + 공식**으로 생성한다.

```ts
const RARITY_BANDS = [
  { star: 1, count: 18, valueRange: [40, 90] },
  { star: 2, count: 14, valueRange: [120, 260] },
  // ...
];
// 구간 안에서 분산시켜 50개를 만든다
```

값을 바꿀 때 한 줄만 고치면 되고, 종류를 60개로 늘려도 테이블만 수정한다.

### ④ 세이브 마이그레이션 테스트

3층 구조 + 2차 환생 여지가 있으므로 **세이브 버전은 반드시 올라간다.**

```
tests/fixtures/save-v1.json
tests/fixtures/save-v2.json
```

버전별 픽스처를 파일로 남기고, 새 코드가 옛 세이브를 읽는지 검증한다.
**인크리멘탈에서 세이브 손실은 치명적이다.** 수십 시간이 증발한다.
출시 후 패치할 때 이 테스트가 없으면 사고가 난다.

---

## 밸런스 검증

두 경로를 둔다. 목적이 다르다.

| | 무엇 | 언제 |
|---|---|---|
| `tests/balance.test.ts` | 페이싱 **단언**. 깨지면 실패 | `npm run check` 마다 자동 |
| `scripts/sim.ts` | 리포트 **출력**. 판단은 사람이 | 수치를 만질 때 수동 |

### sim.ts 가 출력해야 하는 지표 4개

`docs/02-ECONOMY.md` 참조.

1. **첫 환생까지 시간** — 목표 10분
2. **시간대별 골드 수입 출처 비율** (키캡 / 왁뿌볼 / 방치 / 환급)
   후반에 키캡 클릭 비중이 0 에 수렴하면 **경고할 것.**
   화면 주인공이 무의미해진 것이다
3. **20시간 시점 골드 자릿수** — 최소 `1e12`. 미만이면 장르 기대치 미달
4. **50종 해금 완료 시점** — 목표 8~10시간

---

## 화면 검증

```bash
npx playwright install chromium   # 최초 1회
npm run shot                      # → shots/*.png
```

`window.__game` 디버그 훅으로 상태를 주입한 뒤 촬영한다.
초기 화면 / 중반 / 룰렛 연출 / 보관함 확대 화면 / 도감 등 상태별로 찍을 것.

**에이전트는 찍은 이미지를 직접 보고 판단해야 한다.**
"괜찮아 보입니다"로 끝내지 말 것.

---

## Electron / 스팀은 나중

`src/platform/` 추상화가 자리를 잡아뒀으므로 나중에 무손실로 붙는다.
지금 넣으면 개발 루프만 느려진다.

붙일 때 함정은 `docs/05-SHIP.md` 참조.
