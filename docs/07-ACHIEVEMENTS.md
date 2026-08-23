# 07 — 업적 (26개)

클리커에서 업적은 콘텐츠다. 이름은 임시 — 출시 전 확정할 것.
스팀 업적은 출시 후 이름/조건 변경이 곤란하다.

## 첫 경험 (5)

| ID | 조건 |
|---|---|
| `FIRST_BREAK` | 왁뿌볼 1개 파괴 |
| `FIRST_ROULETTE` | 룰렛 1회 |
| `FIRST_CAP` | 키캡 1개 완성 |
| `FIRST_REBIRTH` | 환생 1회 |
| `FIRST_UNLOCK` | 왁뿌볼 종류 신규 해금 |

## 누적 파괴 (5)

| ID | 조건 |
|---|---|
| `BREAK_100` | 누적 100 |
| `BREAK_1K` | 누적 1,000 |
| `BREAK_10K` | 누적 10,000 |
| `BREAK_100K` | 누적 100,000 |
| `BREAK_1M` | 누적 1,000,000 |

## 등급 첫 획득 (4)

`GRADE_RARE` / `GRADE_EPIC` / `GRADE_LEGEND` / `GRADE_SUPREME`

## 왁뿌볼 도감 (5)

| ID | 조건 |
|---|---|
| `DEX_10` | 종류 10개 해금 |
| `DEX_25` | 종류 25개 해금 |
| `DEX_50` | **종류 50개 전부 해금** |
| `DEX_STARS` | ★5 종류 2개 모두 해금 |
| `DEX_FULL_ROW` | 한 종류의 등급 점 5개 전부 채움 |

## 키캡 컬렉션 (3)

`CAPS_50` (50%) / `CAPS_100` (24종 완성) / `CAP_SUPREME` (Supreme 키캡 완성)

## 환생 (2)

`REBIRTH_10` / `REBIRTH_50`

## 특수 (2)

| ID | 조건 |
|---|---|
| `BAD_LUCK` | 꽝 뽑기 |
| `TYPE_LV10` | 왁뿌볼 종류 하나를 Lv.10 까지 |

---

## 구현 메모

- 판정은 `src/core/` 에서 순수 함수로. `checkAchievements(state) -> string[]`
- 해금은 `platform().unlockAchievement(id)` 로만. 브라우저는 콘솔 로그
- **누적 카운터는 환생을 넘어 유지된다.** 세이브 3층 중 "영구"층에 둘 것
