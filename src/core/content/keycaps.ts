/**
 * 키캡 24종 (`docs/02-ECONOMY.md` §5).
 *
 * 키캡은 **무료 공급원**이다. 골드가 0이어도 키캡만 두들기면 게임이 돌아간다.
 * 그리고 N타마다 왁뿌볼을 생산한다 — 이게 없으면 30분 만에 화면 주인공을
 * 안 만지게 된다 (`docs/06-DECISIONS.md` "키캡이 왁뿌볼을 생산").
 *
 * ⚠️ 수치는 잠정값이다.
 */

import type { Grade } from "../state";
import { GRADES } from "../state";

export interface KeycapGradeBand {
	grade: Grade;
	count: number;
	/** 한 개를 완성하는 데 드는 조각. 조각은 **등급 안에서 공용**이다 */
	fragments: number;
	/** 장착 시 골드 배율의 등급 기준값. 종별로 ±20% 를 준다 */
	goldMult: number;
	/** 왁뿌볼 생산 주기(타) */
	ballPeriod: number;
	/** 미장착 방치 수입 (G/s) */
	idleIncome: number;
	/** 그 등급 키캡을 전부 가진 뒤 또 완성됐을 때의 골드 환급 */
	refund: number;
}

/** `docs/02-ECONOMY.md` §5 의 두 표를 그대로 옮긴 것 */
export const KEYCAP_BANDS: readonly KeycapGradeBand[] = [
	{
		grade: "common",
		count: 8,
		fragments: 1,
		goldMult: 1.2,
		ballPeriod: 20,
		idleIncome: 0.5,
		refund: 40,
	},
	{
		grade: "rare",
		count: 6,
		fragments: 2,
		goldMult: 2,
		ballPeriod: 15,
		idleIncome: 2,
		refund: 250,
	},
	{
		grade: "epic",
		count: 5,
		fragments: 4,
		goldMult: 4,
		ballPeriod: 11,
		idleIncome: 8,
		refund: 1_500,
	},
	{
		grade: "legendary",
		count: 3,
		fragments: 8,
		goldMult: 12,
		ballPeriod: 8,
		idleIncome: 30,
		refund: 12_000,
	},
	{
		grade: "supreme",
		count: 2,
		fragments: 16,
		goldMult: 35,
		ballPeriod: 5,
		idleIncome: 120,
		refund: 100_000,
	},
];

export interface Keycap {
	id: number;
	nameKey: string;
	spriteKey: string;
	/**
	 * 타건음 키. 24종을 다 따로 녹음할지 등급별 5종만 쓸지는 음원 확보 상황에
	 * 달렸다 (`docs/04-AUDIO.md`). 지금은 등급별 5종을 가리킨다 —
	 * **레인 B 가 24종으로 늘리기로 하면 여기 공식만 바꾸면 된다.**
	 */
	soundKey: string;
	grade: Grade;
	fragments: number;
	/** 장착 시 골드 배율. 같은 등급 안에서 ±20% 폭이 있다 */
	goldMult: number;
	ballPeriod: number;
	idleIncome: number;
}

function pad3(n: number): string {
	return String(n).padStart(3, "0");
}

function buildKeycaps(): readonly Keycap[] {
	const out: Keycap[] = [];
	let id = 1;
	for (const band of KEYCAP_BANDS) {
		for (let i = 0; i < band.count; i++) {
			// 같은 등급 안에서 ×0.8 ~ ×1.2 로 벌린다 (`docs/02-ECONOMY.md` §5)
			const spread = band.count === 1 ? 1 : 0.8 + (0.4 * i) / (band.count - 1);
			out.push({
				id,
				nameKey: `cap.${pad3(id)}`,
				spriteKey: `cap_${pad3(id)}.png`,
				soundKey: `cap_press_${band.grade}`,
				grade: band.grade,
				fragments: band.fragments,
				goldMult: Math.round(band.goldMult * spread * 100) / 100,
				ballPeriod: band.ballPeriod,
				idleIncome: band.idleIncome,
			});
			id++;
		}
	}
	return out;
}

export const KEYCAPS: readonly Keycap[] = buildKeycaps();

export const KEYCAP_COUNT = KEYCAPS.length;

const BY_ID = new Map(KEYCAPS.map((c) => [c.id, c]));

export function keycap(id: number): Keycap {
	const hit = BY_ID.get(id);
	if (!hit) throw new Error(`없는 키캡: ${id}`);
	return hit;
}

export function keycapsOfGrade(grade: Grade): readonly Keycap[] {
	return KEYCAPS.filter((c) => c.grade === grade);
}

const BAND_BY_GRADE = new Map(KEYCAP_BANDS.map((b) => [b.grade, b]));

export function keycapBand(grade: Grade): KeycapGradeBand {
	const hit = BAND_BY_GRADE.get(grade);
	if (!hit) throw new Error(`없는 키캡 등급: ${grade}`);
	return hit;
}

/**
 * 키캡 1타의 기초 골드. 장착 배율과 스킬트리 골드 배율이 여기에 곱해진다.
 *
 * 🟡 `docs/02-ECONOMY.md` 에 이 값이 없어서 잠정으로 잡았다.
 *    "키캡 클릭 → 골드(소량)" 만 적혀 있고 소량이 얼마인지는 미정이다.
 */
export const KEYCAP_BASE_GOLD = 1;

/** 아무것도 장착하지 않았을 때의 생산 주기. 첫 키캡을 얻기 전 구간이다 */
export const BARE_BALL_PERIOD = 25;

/** 아무것도 장착하지 않았을 때의 골드 배율 */
export const BARE_GOLD_MULT = 1;

/** 시작 시 보유 키캡. 없다 — 첫 키캡도 룰렛 조각으로 만든다 */
export const STARTING_CAPS: readonly number[] = [];

/** 24종 전부 보유 + 1개 장착 시 방치 수입의 상한 (`docs/02-ECONOMY.md` "약 265 G/s") */
export const TOTAL_IDLE_INCOME = KEYCAPS.reduce((sum, c) => sum + c.idleIncome, 0);

/** 등급 순서. 자동 파괴 해금 범위 판정이 이 순서를 쓴다 */
export const GRADE_ORDER = GRADES;
