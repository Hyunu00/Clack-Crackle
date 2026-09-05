/**
 * 왁뿌볼 — 종류 50 + 등급 5. **직교다** (`CLAUDE.md` 절대 규칙 5).
 *
 * 종류는 스프라이트 + 기초 가치 + 파괴음을 담당하고, 등급은 색 + 이펙트 +
 * 배율을 담당한다. 50×5 = 250 조합을 데이터로 굽지 않는다.
 *
 * ★ 50종을 손으로 나열하지 않는다 (`docs/09-DEV-ENV.md` ③).
 *   희귀도 테이블 + 공식으로 만든다. 종류를 60개로 늘려도 `RARITY_BANDS` 의
 *   `count` 한 줄만 고치면 된다.
 *
 * ⚠️ 아래 수치는 전부 잠정값이다 (`docs/02-ECONOMY.md` 머리말).
 *    시스템이 다 돌아간 뒤 `npm run sim` 을 보고 한 번에 정리한다.
 */

import type { Grade, Rarity } from "../state";

// ─────────────────────────────────────────────────────────────────────────────
// 종류
// ─────────────────────────────────────────────────────────────────────────────

export interface RarityBand {
	star: Rarity;
	count: number;
	/** 기초 가치 구간 [최소, 최대] */
	valueRange: readonly [number, number];
	/** 룰렛 종류 슬롯의 **신규 해금** 추첨 비율(%). 레벨업은 이걸 안 탄다 */
	unlockWeight: number;
}

/** `docs/02-ECONOMY.md` §2 "종류" 표를 그대로 옮긴 것 */
export const RARITY_BANDS: readonly RarityBand[] = [
	{ star: 1, count: 18, valueRange: [40, 90], unlockWeight: 40 },
	{ star: 2, count: 14, valueRange: [120, 260], unlockWeight: 27 },
	{ star: 3, count: 10, valueRange: [350, 800], unlockWeight: 18 },
	{ star: 4, count: 6, valueRange: [1_200, 2_500], unlockWeight: 10 },
	{ star: 5, count: 2, valueRange: [5_000, 9_000], unlockWeight: 5 },
];

export interface BallType {
	id: number;
	/** ★ 문자열이 아니라 키다 (`CLAUDE.md` 절대 규칙 8) */
	nameKey: string;
	/** 아틀라스 프레임 이름. 확장자를 포함한다 (`docs/03-ART.md`) */
	spriteKey: string;
	rarity: Rarity;
	/** 레벨 1 기준 기초 가치 */
	baseValue: number;
}

function pad3(n: number): string {
	return String(n).padStart(3, "0");
}

function buildTypes(): readonly BallType[] {
	const out: BallType[] = [];
	let id = 1;
	for (const band of RARITY_BANDS) {
		const [lo, hi] = band.valueRange;
		for (let i = 0; i < band.count; i++) {
			// 구간 안에 고르게 분산시킨다. 종수가 1이면 구간 하단을 쓴다
			const t = band.count === 1 ? 0 : i / (band.count - 1);
			out.push({
				id,
				nameKey: `ball.type.${pad3(id)}`,
				spriteKey: `ball_${pad3(id)}.png`,
				rarity: band.star,
				baseValue: Math.round(lo + (hi - lo) * t),
			});
			id++;
		}
	}
	return out;
}

export const BALL_TYPES: readonly BallType[] = buildTypes();

export const BALL_TYPE_COUNT = BALL_TYPES.length;

const BY_ID = new Map(BALL_TYPES.map((b) => [b.id, b]));

export function ballType(id: number): BallType {
	const hit = BY_ID.get(id);
	if (!hit) throw new Error(`없는 왁뿌볼 종류: ${id}`);
	return hit;
}

export function typesOfRarity(rarity: Rarity): readonly BallType[] {
	return BALL_TYPES.filter((b) => b.rarity === rarity);
}

/** 종류 레벨이 오를 때마다 기초 가치가 곱해지는 배수. **상한 없음** */
export const TYPE_LEVEL_MULT = 1.2;

// ─────────────────────────────────────────────────────────────────────────────
// 등급
// ─────────────────────────────────────────────────────────────────────────────

export interface GradeDef {
	id: Grade;
	nameKey: string;
	/** 파괴 골드 배율 */
	goldMult: number;
	/** 환생재화 보정. 이번 판 평균이 환생재화 공식에 곱해진다 */
	rebirthBonus: number;
	/**
	 * 스킬트리 투자 전, 하나를 부수는 데 걸리는 시간(초).
	 *
	 * ★ `docs/02-ECONOMY.md` 의 "필요 클릭 20~30" 을 시간으로 옮긴 값이다.
	 *   연타가 없어졌으므로 (2026-09 오너 결정) 클릭 수가 아니라 초가 단위다.
	 *   **"파괴 1회 = 약 3초" 가 상위 제약**이라 25클릭 = 3.0초를 기준으로
	 *   비율을 유지했다 (20→2.4 / 22→2.64 / 25→3.0 / 28→3.36 / 30→3.6).
	 */
	breakSeconds: number;
}

export const GRADE_DEFS: readonly GradeDef[] = [
	{ id: "common", nameKey: "grade.common", goldMult: 1, rebirthBonus: 1.0, breakSeconds: 2.4 },
	{ id: "rare", nameKey: "grade.rare", goldMult: 3, rebirthBonus: 1.2, breakSeconds: 2.64 },
	{ id: "epic", nameKey: "grade.epic", goldMult: 10, rebirthBonus: 1.4, breakSeconds: 3.0 },
	{
		id: "legendary",
		nameKey: "grade.legendary",
		goldMult: 40,
		rebirthBonus: 1.8,
		breakSeconds: 3.36,
	},
	{ id: "supreme", nameKey: "grade.supreme", goldMult: 200, rebirthBonus: 2.0, breakSeconds: 3.6 },
];

const GRADE_BY_ID = new Map(GRADE_DEFS.map((g) => [g.id, g]));

export function gradeDef(grade: Grade): GradeDef {
	const hit = GRADE_BY_ID.get(grade);
	if (!hit) throw new Error(`없는 등급: ${grade}`);
	return hit;
}

/** 희귀도 표기 키. ★1~★5 (`docs/10-I18N.md` 키 규칙) */
export function rarityNameKey(rarity: Rarity): string {
	return `rarity.${rarity}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 부수기
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 방식별 골드 배율 (`docs/02-ECONOMY.md` "부수기").
 *
 * ★ 연타(100%)가 없어지면서 **손으로 부수면 100%** 가 되었다.
 *   남은 페널티는 자동 파괴의 60% 하나이고, 그게 ASMR 을 지키는 장치다 —
 *   **약화시키지 말 것** (`docs/06-DECISIONS.md` "자동화 3단계 전부 도입").
 */
export const BREAK_MODE_MULT: Readonly<Record<"hold" | "auto", number>> = {
	hold: 1.0,
	auto: 0.6,
};

/**
 * 균열 단계 수 (`docs/02-ECONOMY.md` "균열 단계 — 기본 4, 설정으로 3~5").
 *
 * 3초를 4로 나누면 단계당 0.75초라 균열음 하나가 여유 있게 들어간다.
 * 5면 0.6초라 빡빡하고, 3이면 하나하나가 길게 들린다.
 */
export const CRACK_STAGES_DEFAULT = 4;

export const CRACK_STAGES_OPTIONS: readonly number[] = [3, 4, 5];

/**
 * 제작하는 오버레이·음원 수. **설정과 무관하게 항상 5다.**
 * N 이 5보다 작으면 그중 골라 쓰고 마지막은 항상 5번(최대 균열)으로 끝낸다 —
 * 파괴 직전 모습이 설정과 무관하게 같아야 한다. 고르는 규칙은 레인 B 의 몫이다.
 */
export const CRACK_ASSET_COUNT = 5;

/**
 * "부수기 효율" 스킬이 아무리 붙어도 이보다 짧아지지 않는다.
 *
 * 🟡 **하한은 아직 미결이다** (`docs/01-OPEN-QUESTIONS.md` A).
 *    너무 짧으면 균열음 5단계가 뭉개진다. 지금 값은 Common 2.4초에
 *    최대 효율(×0.6)을 먹인 1.44초라 사실상 걸리지 않는 잠정값이다.
 *    실제 청취로 확정할 것.
 */
export const MIN_BREAK_SECONDS = 1.44;
