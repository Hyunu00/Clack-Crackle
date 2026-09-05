# 11 — 작업 분담 (2인)

**"뭐 하면 되나요?" 의 답이 이 문서에 있다.**
자기 레인의 "다음 작업" 표에서 맨 위에 있는 미완료 항목이 지금 할 일이다.

---

## 어디서 자르나

이 프로젝트는 이미 분할선을 갖고 있다. `CLAUDE.md` 절대 규칙 1번 —
**`src/core/` 는 `pixi.js` 를 import 하지 않는다.**

그 선이 그대로 두 사람의 경계다. 억지로 만든 게 아니라 원래 있던 선이라
**두 레인의 파일 목록이 겹치지 않는다.**

```
        ┌──────────────────────────────┐
        │   A · 엔진      숫자를 만든다  │
        │   src/core/  scripts/         │
        └───────────┬──────────────────┘
                    │
          GameState / GameEvent   ← 유일한 접점. 이게 계약이다
                    │
        ┌───────────┴──────────────────┐
        │   B · 감각      소리와 그림   │
        │   render/ audio/ ui/ assets/  │
        └──────────────────────────────┘
```

`CLAUDE.md` 의 설계 논지가 **"소리가 보상이고, 숫자는 페이싱 장치다"** 이므로,
**B 가 보상을 만들고 A 가 페이싱을 만든다.** 판단이 갈리면 우선순위 1번이
"부수는 순간의 손맛"이라는 걸 기억할 것 — 그 항목의 주인은 B다.

---

## 레인

| | **A · 엔진** | **B · 감각** |
|---|---|---|
| 한 줄 | 상태·경제·밸런스 | 손맛·화면·소리 |
| 언어 | 순수 함수, `Decimal`, 시드 RNG | Pixi, howler, HTML |
| 검증 | `npm test` / `npm run sim` | `npm run shot` / 직접 듣기 |
| 실패하면 | 지루한 게임 | 아무것도 아닌 게임 |

---

## 파일 소유권

**겹치는 파일이 0이 되게 짰다.** 표에 없는 새 파일을 만들 때도
자기 레인 폴더 안에 만들면 자동으로 지켜진다.

### A · 엔진

```
src/core/state.ts        GameState 3층 + GameEvent
src/core/engine.ts       순수 함수 전부
src/core/save.ts         직렬화 + 버전 마이그레이션
src/core/numbers.ts      Decimal, 포맷, 시드 RNG
src/core/content/        balls / keycaps / roulette / skilltree   ★ audio.ts 는 제외
scripts/sim.ts
tests/engine.test.ts  balance.test.ts  save-migration.test.ts  fixtures/
```

### B · 감각

```
src/render/**            Pixi. 상태를 읽고 그리기만
src/audio/**             howler. GameEvent 구독
src/ui/**                HTML HUD
src/core/content/audio.ts   ★ 예외. 데이터지만 B 의 영역이다 (아래 설명)
src/main.ts              부팅 배선
index.html
assets/**  public/sfx/**
tests/visual.spec.ts  env.test.ts
```

> **`src/core/content/audio.ts` 가 왜 B 인가**
> `docs/04-AUDIO.md` 가 "사운드 정의는 데이터"라고 못박아서 위치는 `core/` 다.
> 하지만 **A 는 이 파일을 절대 읽지 않는다** — 엔진은 이벤트만 뱉고 소리를 모른다.
> 사운드 키 목록을 관리하는 건 전적으로 B 의 일이라 소유권을 B 에 준다.
> 순수 데이터이므로 `core` 가 howler 를 import 하지 않는다는 규칙은 그대로다.

### 공동 — 규칙을 지키면 안 부딪힌다

```
src/i18n/en.json  ko.json     네임스페이스로 가른다 (아래)
src/debug.ts                  window.__game 훅. 자기 레인 필드만 append
tests/i18n.test.ts            거의 안 고친다. 출시 전 STRICT 를 켤 때 정도
docs/06-DECISIONS.md          append 만. 남의 항목을 고치지 않는다
```

### 아무도 안 건드림

```
src/platform/**       Electron 붙일 때 (PROMPTS 14). 그전엔 열지 말 것
src/i18n/index.ts     다 됐다. 고칠 일이 생기면 그건 설계 문제다
src/i18n/locales.ts   언어를 추가할 때만
src/i18n/*.json (ko·en 외 7개)   번역이 들어올 때만. 빈 파일이 정상이다
설정 파일 전부         package.json  tsconfig  vite  biome  playwright
                      .assetpack.js  .gitignore
```

**설정 파일을 고쳐야 하면 상대에게 먼저 말한다.** 여기가 깨지면 두 사람이
동시에 멈춘다. `npm i` 로 패키지가 늘어나는 것도 마찬가지다 —
`package-lock.json` 은 충돌이 나면 풀기 가장 귀찮은 파일이다.

---

## 문서 소유권

| 문서 | 주인 | 비고 |
|---|---|---|
| `02-ECONOMY.md` | **A** | 사양서. 수치를 조정했으면 여기도 같이 고친다 |
| `07-ACHIEVEMENTS.md` | **A** | 판정이 `core/` 순수 함수다 |
| `03-ART.md` | **B** | 캐주얼 아트 규격, 에셋 목록 |
| `04-AUDIO.md` | **B** | 사운드 스펙 |
| `10-I18N.md` | 공동 | 키 추가는 아래 네임스페이스 규칙대로 |
| `06-DECISIONS.md` | 공동 | **append 만.** 남의 항목을 고치지 않는다 |
| `01-OPEN-QUESTIONS.md` | 오너 | **혼자 정하지 말 것.** 아래 "막혔을 때" |
| `08-NAMING.md` | 오너 | 이름은 임의로 짓지 않는다 |
| `00 / 05 / 09 / 11 / CLAUDE.md` | 오너 | 방향·환경·분담 |

**"오너"는 기획 결정을 내리는 사람이다.** 코드 작업자는 여기에 질문을 올리고
답을 기다린다. 임의로 정하고 진행하면 나중에 전부 뜯는다.

---

## 유일한 접점 — 계약

두 레인이 만나는 곳은 **`src/core/state.ts` 하나뿐**이다.

```ts
GameState   B 가 읽고 그린다. B 는 절대 쓰지 않는다
GameEvent   A 가 뱉고 B 가 구독한다. 소리와 연출이 전부 여기 달린다
```

### ★ 시작하기 전에 반드시 같이 볼 것

**A 가 `GameEvent` 를 먼저 정의하고, B 가 그걸 검수한다.**
여기서 이벤트 하나가 빠지면 **B 는 그 소리를 영원히 못 낸다.**
`docs/04-AUDIO.md` 의 사운드 17종이 전부 트리거될 수 있는지 대조한다:

```
cap_press        ball_crack_1~5   ball_shatter    ball_spawn   coin
sting_rare/epic/legendary/supreme
roulette_roll    roulette_result  roulette_fail
type_unlock      type_levelup     frag_get        cap_complete
dex_new          rebirth          skill_buy       ui_denied     field_full
```

이 대조가 끝나야 두 레인이 갈라진다. **계약 전에는 병렬로 못 간다.**

### 이름이 저절로 맞는 두 곳

둘 다 규칙이 이미 문서에 있어서, **각자 규칙만 지키면 자동으로 일치한다.**
서로 물어볼 필요가 없다.

| | A 가 쓰는 것 | B 가 만드는 것 | 규칙 |
|---|---|---|---|
| 스프라이트 | `spriteKey: "ball_001.png"` | `assets/balls{tps}/ball_001.png` | `docs/03-ART.md` 파일명 규칙 |
| i18n | `nameKey: "ball.type.001"` | — | `docs/10-I18N.md` 키 규칙 |

### i18n 키 네임스페이스

`en.json` / `ko.json` 은 두 사람이 같이 여는 유일한 파일이다.
**네임스페이스로 가른다. 남의 구역에 키를 넣지 않는다.**

| 접두사 | 주인 |
|---|---|
| `ball.` `cap.` `skill.` `auto.` `ach.` `grade.` `rarity.` | **A** — 콘텐츠 데이터에서 나온다 |
| `ui.` | **B** — 화면에서 나온다 |
| `sys.` `game.` | **이미 12+1개가 등록돼 있다. 추가하지 말 것** |

추가 절차는 `docs/10-I18N.md` 의 "문자열을 추가하는 절차".

---

## 다음 작업 — A · 엔진

원본 프롬프트는 `prompts/PROMPTS.md` 의 같은 번호에 있다.

| | 작업 | 근거 문서 | 완료 판정 |
|---|---|---|---|
| **A1** | GameState 3층 + **GameEvent 계약** (P3) | `02-ECONOMY` 2차 환생 여지 + `04-AUDIO` 사운드 17종 | B 가 이벤트만 보고 오디오 배선을 시작할 수 있다 |
| **A2** | 세이브 + 마이그레이션 하네스 (P4) | `09-DEV-ENV` ④ | `tests/fixtures/save-v1.json` 이 현재 코드로 로드된다 |
| **A3** | 콘텐츠 데이터 (P5) | `02-ECONOMY` 전체 | 50종이 **공식 생성**이고 `nameKey` 가 i18n 키와 1:1 |
| **A4** | 엔진 순수 함수 (P6) 🔴 **Q1 필요** | `02-ECONOMY` | `npm test` + 20시간 시뮬이 100ms 안 |
| **A5** | sim + balance 단언 (P7) | `02-ECONOMY` 감시 지표 4개 | `npm run sim` 이 지표 4개를 실제 숫자로 출력 |

**A1 을 먼저 끝낼 것.** B 가 여기 막혀 있다.

A4 는 Q1(자동 파괴 판정 단위)이 필요하다. **막히면 A5 로 넘어가지 말고**
— sim 은 엔진이 있어야 돌므로 — A2·A3 를 먼저 끝내고 Q1 을 기다린다.

## 다음 작업 — B · 감각

| | 작업 | 근거 문서 | 완료 판정 |
|---|---|---|---|
| **B1** | A1 계약 검수 | `04-AUDIO` 사운드 목록 | 17종이 전부 트리거 가능하다고 확인 |
| **B2** | 오디오 시스템 (P9) | `04-AUDIO` 필수 처리 7가지 | 음원 0개여도 돌고, 빈 키 목록이 콘솔에 찍힌다 |
| **B3** | 왁뿌볼 렌더 (P8) 🟡 Q4 일부 | `03-ART` 직교 구조 | 종류×등급을 **런타임 조합**. 250텍스처가 아니다 |
| **B4** | HUD 뼈대 + 설정 화면 | `05-SHIP` 게임 내 필수 | 언어 목록이 `LOCALES` 를 읽어서 그려진다 |
| **B5** | 보관함 확대 화면 (P11) 🔴 **Q5 필요** | `02-ECONOMY` 4번 | 자동 파괴 ON 이면 안 뜬다 |
| **B6** | 스크린샷 리뷰 (P12) | `09-DEV-ENV` 화면 검증 | 이미지를 **직접 보고** 구체적으로 말한다 |

**B2 는 엔진이 없어도 된다.** 가짜 `GameEvent` 를 던져서 배선을 검증할 수 있고,
`docs/04-AUDIO.md` 가 "음원 파일이 없으면 조용히 넘어가고 콘솔에 비어 있는 키
목록을 찍는다"고 이미 정해놨다. **그 목록이 그대로 녹음 체크리스트가 된다.**

### Q3(화면 레이아웃)은 B 가 푼다

`01-OPEN-QUESTIONS.md` 가 "프로토타입 보면서 결정하기로 함"이라고 적어놨다.
**결정을 기다리는 게 아니라 B 가 안을 만들어 오너에게 보여주는 순서다.**
논점은 키캡과 필드 사이 거리 — 수천 번 왕복할 동선이다.

`npm run shot` 으로 안을 2~3개 찍어서 올리면 된다.

---

## 막혔을 때

```
미결 항목에 걸렸다
   │
   ├─ 수치인가?        → docs/02-ECONOMY.md 의 잠정값으로 진행.
   │                      시뮬레이션 뒤 일괄 확정하기로 이미 정해져 있다
   │
   ├─ 이름인가?        → placeholder 로 진행. "[sys.rebirth]" 가 화면에
   │                      보이는 건 정상이다. docs/08-NAMING.md
   │
   └─ 그 외 (Q1/Q4/Q5) → 진행하지 말고 오너에게 묻는다.
                          답이 나오면 01-OPEN-QUESTIONS → 06-DECISIONS 로 옮긴다
```

**지금 열려서 코드를 막고 있는 것:**

| | 무엇 | 막는 레인 |
|---|---|---|
| **Q1** | 자동 파괴 판정 단위 (조합 vs 종류) | **A4** |
| **Q5** | 보관함 확대 화면 조작 | **B5** |
| **Q4** | 프리즘(Supreme) 표현 | B3 일부 |
| Q3 | 화면 레이아웃 | B 가 안을 만들어 올린다 |

---

## 충돌 규칙

1. **소유권 표에 없는 남의 파일을 고치지 않는다.** 필요하면 요청한다.
   "잠깐이면 되는데" 가 이 프로젝트에서 가장 비싼 문장이다.
2. 브랜치는 `lane-a` / `lane-b`. **main 으로 자주 머지한다.**
   계약(`state.ts`)이 바뀌면 즉시 머지한다.
3. **커밋 전 `npm run check`** (`CLAUDE.md` 절대 규칙 10).
   빨간불인 채로 push 하면 상대 레인이 자기 코드를 의심하며 시간을 태운다.
4. 밸런스를 건드렸으면 `npm run sim`, 화면을 건드렸으면 `npm run shot`.
   **A 는 sim, B 는 shot 이 자기 몫이다.**
5. 문서 수정은 **코드 커밋과 분리한다.** 나중에 왜 그랬는지 읽기 위해서다.

---

## 주기적으로 같이 하는 것

`prompts/PROMPTS.md` 13번 (규칙 위반 점검). 절대 규칙 10개를 훑는다.
**각자 자기 레인 항목만 본다:**

| 점검 | 레인 |
|---|---|
| `src/core/` 의 pixi / howler import | A |
| `engine.ts` 의 숫자 리터럴 / `content/` 밖의 밸런스 수치 | A |
| `rarity` 와 `grade` 를 혼용한 곳 | A |
| core 가 mutable 로 바뀐 곳 | A |
| 오프라인 진행 코드 | A |
| 에셋이 2배 해상도 미만으로 제작된 곳 (`CLAUDE.md` 규칙 4) | B |
| 종류×등급 조합을 미리 구운 텍스처 | B |
| 종류 그림이 베이스컬러/셰이딩 레이어로 안 나뉜 곳 (틴트가 안 먹는다) | B |
| 하드코딩된 한국어 문자열 | 둘 다 |
