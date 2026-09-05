/**
 * 업적 26개 (`docs/07-ACHIEVEMENTS.md`).
 *
 * ★ 조건은 **데이터**로 두고 판정은 `engine.ts` 의 `checkAchievements` 가 한다.
 *   `content/` 에 로직을 넣지 않는다 (`prompts/PROMPTS.md` 5번).
 *
 * ★ 스팀 업적은 출시 후 이름/조건 변경이 곤란하다. 이름은 i18n 키로만 잡혀
 *   있고 값은 아직 placeholder 다 (`docs/08-NAMING.md`).
 */

import type { Grade, Rarity } from "../state";

export type AchievementCondition =
	/** 누적 파괴 수 */
	| { kind: "totalBreaks"; value: number }
	/** 누적 룰렛 횟수 */
	| { kind: "totalRolls"; value: number }
	/** 보유 키캡 수 */
	| { kind: "capsOwned"; value: number }
	/** 그 등급 키캡을 하나라도 완성 */
	| { kind: "capGrade"; grade: Grade }
	/** 누적 환생 횟수 */
	| { kind: "rebirths"; value: number }
	/** 해금한 왁뿌볼 종류 수 */
	| { kind: "typesUnlocked"; value: number }
	/** 그 등급 개체를 본 적 있음 */
	| { kind: "gradeSeen"; grade: Grade }
	/** 그 희귀도의 종류를 전부 해금 */
	| { kind: "allOfRarity"; rarity: Rarity }
	/** 한 종류의 등급 점 5개를 전부 채움 */
	| { kind: "dexFullRow" }
	/** 꽝을 뽑은 횟수 */
	| { kind: "rouletteFails"; value: number }
	/** 어떤 종류든 이 레벨까지 */
	| { kind: "typeLevel"; value: number };

export interface Achievement {
	id: string;
	nameKey: string;
	descKey: string;
	condition: AchievementCondition;
}

function ach(id: string, condition: AchievementCondition): Achievement {
	return { id, nameKey: `ach.${id}.name`, descKey: `ach.${id}.desc`, condition };
}

export const ACHIEVEMENTS: readonly Achievement[] = [
	// 첫 경험 (5)
	ach("FIRST_BREAK", { kind: "totalBreaks", value: 1 }),
	ach("FIRST_ROULETTE", { kind: "totalRolls", value: 1 }),
	ach("FIRST_CAP", { kind: "capsOwned", value: 1 }),
	ach("FIRST_REBIRTH", { kind: "rebirths", value: 1 }),
	ach("FIRST_UNLOCK", { kind: "typesUnlocked", value: 2 }),
	// 누적 파괴 (5)
	ach("BREAK_100", { kind: "totalBreaks", value: 100 }),
	ach("BREAK_1K", { kind: "totalBreaks", value: 1_000 }),
	ach("BREAK_10K", { kind: "totalBreaks", value: 10_000 }),
	ach("BREAK_100K", { kind: "totalBreaks", value: 100_000 }),
	ach("BREAK_1M", { kind: "totalBreaks", value: 1_000_000 }),
	// 등급 첫 획득 (4)
	ach("GRADE_RARE", { kind: "gradeSeen", grade: "rare" }),
	ach("GRADE_EPIC", { kind: "gradeSeen", grade: "epic" }),
	ach("GRADE_LEGEND", { kind: "gradeSeen", grade: "legendary" }),
	ach("GRADE_SUPREME", { kind: "gradeSeen", grade: "supreme" }),
	// 도감 (5)
	ach("DEX_10", { kind: "typesUnlocked", value: 10 }),
	ach("DEX_25", { kind: "typesUnlocked", value: 25 }),
	ach("DEX_50", { kind: "typesUnlocked", value: 50 }),
	ach("DEX_STARS", { kind: "allOfRarity", rarity: 5 }),
	ach("DEX_FULL_ROW", { kind: "dexFullRow" }),
	// 키캡 컬렉션 (3)
	ach("CAPS_50", { kind: "capsOwned", value: 12 }),
	ach("CAPS_100", { kind: "capsOwned", value: 24 }),
	ach("CAP_SUPREME", { kind: "capGrade", grade: "supreme" }),
	// 환생 (2)
	ach("REBIRTH_10", { kind: "rebirths", value: 10 }),
	ach("REBIRTH_50", { kind: "rebirths", value: 50 }),
	// 특수 (2)
	ach("BAD_LUCK", { kind: "rouletteFails", value: 1 }),
	ach("TYPE_LV10", { kind: "typeLevel", value: 10 }),
];

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;
