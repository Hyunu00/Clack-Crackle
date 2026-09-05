/**
 * 스킬트리 — 노드 8개 + 자동화 3단계 (`docs/02-ECONOMY.md` §8).
 *
 * 환생재화로만 산다. 첫 판에는 성장 장치가 아예 없다는 뜻이고,
 * 그래서 첫 환생 10분이 중요하다.
 *
 * ★ "골드 획득량" 과 "방치 수입" 에 **상한을 두지 않는다.** 엔딩이 없는
 *   게임이므로 100시간째에도 올릴 게 남아야 한다 (`CLAUDE.md`).
 *
 * ⚠️ 비용 곡선과 효과 계수는 전부 잠정값이다. `docs/01-OPEN-QUESTIONS.md` A
 *    에 "스킬트리 노드 비용 곡선" 이 미결로 올라 있다. `npm run sim` 을 보고
 *    일괄 확정한다.
 */

import type { Grade } from "../state";

export const INFINITE = Number.POSITIVE_INFINITY;

export interface SkillNode {
	id: string;
	nameKey: string;
	descKey: string;
	/** `INFINITE` 면 무한 축이다 */
	maxLevel: number;
	/** `비용 = costBase × costGrowth ^ (현재 레벨)` — 환생재화 */
	costBase: number;
	costGrowth: number;
	/**
	 * 레벨 1당 효과. 의미는 노드마다 다르고 해석은 `engine.ts` 가 한다.
	 * (`CLAUDE.md` 절대 규칙 2 — 수치는 여기에만 둔다)
	 */
	perLevel: number;
}

function node(
	id: string,
	maxLevel: number,
	costBase: number,
	costGrowth: number,
	perLevel: number,
): SkillNode {
	return {
		id,
		nameKey: `skill.${id}.name`,
		descKey: `skill.${id}.desc`,
		maxLevel,
		costBase,
		costGrowth,
		perLevel,
	};
}

export const SKILL_NODES: readonly SkillNode[] = [
	/** 전체 골드 ×1.15 씩 누적. 상한 없음 */
	node("goldMult", INFINITE, 1, 1.6, 1.15),
	/** 미장착 키캡 방치 수입 ×1.2 씩 누적. 상한 없음 */
	node("idleIncome", INFINITE, 1, 1.55, 1.2),
	/** 필드 슬롯 5 → 12. 레벨당 +1, 상한 7 */
	node("fieldSlots", 7, 3, 2.2, 1),
	/** 상위 개체 등급 가중치 ×1.1 씩. 상한 10 */
	node("gradeOdds", 10, 2, 1.8, 1.1),
	/** 상위 조각 등급 가중치 ×1.1 씩. 상한 10 */
	node("fragOdds", 10, 2, 1.8, 1.1),
	/** 룰렛 종류 슬롯 확률 +0.5%p 씩. 상한 8 → 4% + 4%p */
	node("discoveryRate", 8, 3, 2.0, 0.5),
	/** 부수는 데 걸리는 시간 -5% 씩. 상한 8 → ×0.6 */
	node("breakEfficiency", 8, 2, 1.9, 0.05),
	/** 환생 직후 지급 골드 ×4 씩. 상한 없음 */
	node("startingGold", INFINITE, 2, 1.7, 4),
];

// ─────────────────────────────────────────────────────────────────────────────
// 자동화 (별도 트리)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 인크리멘탈에서 자동화는 선택이 아니라 필수다. 손가락 속도가 게임의 상한이
 * 되면 안 된다 (`docs/06-DECISIONS.md` "자동화 3단계 전부 도입").
 *
 * ★ 자동 파괴는 **등급 단위 해금**이다 (🟢 2026-09 — Q1). 노드 레벨이 곧
 *   자동으로 깨지는 등급의 상한이다. "처음 보는 조합" 규칙은 폐기됐다.
 */
export const AUTO_NODES: readonly SkillNode[] = [
	/** 왁뿌볼 자동 생산. 해금 시점 목표 = 환생 2~3회 */
	node("keycap", 1, 25, 1, 1),
	/** 등급별 해금. Lv.1 Common … Lv.5 전부. 해금 시점 목표 = 환생 8~10회 */
	node("break", 5, 60, 5, 1),
	/** 골드 여유분 자동 소비. 해금 시점 목표 = 환생 20회+ */
	node("roulette", 1, 3_000, 1, 1),
];

/** 자동화 노드는 `auto.` 접두사로 구분한다. i18n 키도 `auto.*` 다 */
export const AUTO_PREFIX = "auto.";

export const ALL_NODES: readonly SkillNode[] = [
	...SKILL_NODES,
	...AUTO_NODES.map((n) => ({
		...n,
		id: `${AUTO_PREFIX}${n.id}`,
		nameKey: `${AUTO_PREFIX}${n.id}.name`,
		descKey: `${AUTO_PREFIX}${n.id}.desc`,
	})),
];

const BY_ID = new Map(ALL_NODES.map((n) => [n.id, n]));

export function skillNode(id: string): SkillNode {
	const hit = BY_ID.get(id);
	if (!hit) throw new Error(`없는 스킬 노드: ${id}`);
	return hit;
}

// ─────────────────────────────────────────────────────────────────────────────
// 자동화 파라미터
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 자동 파괴 노드 레벨 → 자동으로 깨지는 등급의 상한.
 * `docs/02-ECONOMY.md` §8 "자동 파괴의 판정 규칙" 표 그대로다.
 */
export const AUTO_BREAK_GRADES: readonly (readonly Grade[])[] = [
	[],
	["common"],
	["common", "rare"],
	["common", "rare", "epic"],
	["common", "rare", "epic", "legendary"],
	["common", "rare", "epic", "legendary", "supreme"],
];

/**
 * 자동 키캡의 초당 타수.
 *
 * 🟡 `docs/02-ECONOMY.md` 에 값이 없어 잠정으로 잡았다. 이 값이 후반
 *    왁뿌볼 공급량을 통째로 결정하므로 `npm run sim` 의 지표 2번
 *    (수입 출처 비율)에 직접 걸린다.
 */
export const AUTO_KEYCAP_PPS = 5;

/** 자동 룰렛이 한 번 돌리기까지 두는 최소 간격(초). 잠정 */
export const AUTO_ROULETTE_INTERVAL = 1;

/** 자동 룰렛이 남겨두는 여유분. 골드가 `비용 × 이 값` 이상일 때만 돌린다. 잠정 */
export const AUTO_ROULETTE_MARGIN = 2;

/** 필드 기본 슬롯 수. `fieldSlots` 노드가 여기에 더한다 */
export const BASE_FIELD_SLOTS = 5;

// ─────────────────────────────────────────────────────────────────────────────
// 환생
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `환생재화 = REBIRTH_COEFF × √(이번 판 누적 골드) × 등급보정_평균`
 *
 * 🟡 계수는 미결이다 (`docs/01-OPEN-QUESTIONS.md` A "환생재화 제곱근 공식의 계수").
 *    제곱근이라는 형태만 확정이고 계수는 sim 을 보고 잡는다.
 */
export const REBIRTH_COEFF = 0.1;
