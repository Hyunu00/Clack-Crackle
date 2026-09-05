/**
 * 룰렛 — 단일 슬롯 (`docs/02-ECONOMY.md` §6).
 *
 * 키캡이 무료 공급원이면 룰렛은 **유료 업그레이드 경로**다.
 * 비용 곡선이 환생 타이밍을 시스템에서 만들어낸다 —
 * 이게 없으면 골드 수입이 커질수록 무한 연타가 되고 골드가 무의미해진다
 * (`docs/06-DECISIONS.md` "룰렛 비용 지수 상승 + 환생 리셋").
 *
 * ⚠️ 확률표는 전부 잠정값이다. 시스템이 다 돌아간 뒤 일괄 정리한다.
 */

import type { Grade, RouletteOutcome } from "../state";
import { GRADES } from "../state";
import { RARITY_BANDS } from "./balls";

/** 결과 4종의 가중치(%). 합이 100 이다 */
export const OUTCOME_WEIGHTS: Readonly<Record<RouletteOutcome, number>> = {
	ball: 55,
	fragment: 40,
	type: 4,
	fail: 1,
};

export const OUTCOME_ORDER: readonly RouletteOutcome[] = ["ball", "fragment", "type", "fail"];

/** 왁뿌볼이 나왔을 때의 등급 확률(%). 배열 순서는 `GRADES` 와 같다 */
export const BALL_GRADE_WEIGHTS: readonly number[] = [55, 28, 12, 4.5, 0.5];

/** 조각이 나왔을 때의 등급 확률(%) */
export const FRAGMENT_GRADE_WEIGHTS: readonly number[] = [60, 26, 10, 3.5, 0.5];

/** 한 번에 들어오는 조각 수 */
export const FRAGMENTS_PER_HIT = 1;

/**
 * 종류 슬롯 안에서 **신규 해금**이 나올 비율. 나머지는 레벨업이다.
 *
 * 🟡 `docs/02-ECONOMY.md` 가 "신규/레벨업 비중은 미정"이라고만 적어두고
 *    잠정값도 없어서 여기서 임의로 잡았다. **`npm run sim` 의 지표 4번
 *    (50종 해금 완료 시점, 목표 8~10시간)이 이 값에 가장 민감하다.**
 *    미보유가 없으면 이 값과 무관하게 전부 레벨업이 된다.
 */
export const NEW_UNLOCK_SHARE = 0.7;

/** 신규 해금 시 희귀도 추첨 가중치. `balls.ts` 의 밴드 표에서 그대로 온다 */
export const RARITY_UNLOCK_WEIGHTS: readonly number[] = RARITY_BANDS.map((b) => b.unlockWeight);

// ─────────────────────────────────────────────────────────────────────────────
// 비용 곡선
// ─────────────────────────────────────────────────────────────────────────────

/** `비용 = BASE × GROWTH ^ (이번 판 누적 횟수)` */
export const COST_BASE = 100;
export const COST_GROWTH = 1.04;

/** 등급 인덱스 → 등급. 가중치 배열과 `GRADES` 를 잇는다 */
export function gradeAt(index: number): Grade {
	return GRADES[Math.min(index, GRADES.length - 1)] as Grade;
}
