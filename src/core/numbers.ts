/**
 * 큰 수 · 포맷 · 시드 RNG.
 *
 * 인크리멘탈이라 골드는 `number` 로 못 담는다 (`CLAUDE.md` 절대 규칙 3).
 * 골드 · 환생재화 · 누적 통계는 전부 `Decimal` 이다.
 */

import Decimal from "break_infinity.js";

export { Decimal };

export type DecimalLike = Decimal | number | string;

export function D(v: DecimalLike): Decimal {
	return v instanceof Decimal ? v : new Decimal(v);
}

export const ZERO: Decimal = new Decimal(0);

/**
 * 인크리멘탈 표준 접미사. 1e33 까지 덮고 그 위는 지수 표기로 넘어간다.
 * 20시간 시점 목표가 `1e12` 이상이므로 (`docs/02-ECONOMY.md` 감시 지표 3)
 * 여기까지는 접미사로 읽히는 게 낫다.
 */
const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"] as const;

/** 화면과 리포트에 그대로 쓰는 표기. 문자열은 i18n 대상이 아니다 (숫자다) */
export function formatNumber(value: DecimalLike, decimals = 2): string {
	const d = D(value);
	if (d.lt(1000)) {
		const n = d.toNumber();
		return Number.isInteger(n) ? String(n) : n.toFixed(decimals);
	}
	const tier = Math.floor(d.log10() / 3);
	if (tier >= SUFFIXES.length) return d.toExponential(decimals).replace("e+", "e");
	const scaled = d.div(Decimal.pow(1000, tier));
	return `${scaled.toNumber().toFixed(decimals)}${SUFFIXES[tier]}`;
}

/** `1e12` 같은 자릿수 표기. sim 리포트가 장르 기대치를 볼 때 쓴다 */
export function orderOfMagnitude(value: DecimalLike): number {
	const d = D(value);
	return d.lte(0) ? 0 : Math.floor(d.log10());
}

/** `01:23:45`. 페이싱 리포트용 */
export function formatDuration(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * 시드 RNG (mulberry32).
 *
 * ★ 엔진 함수는 `GameState` 를 불변으로 다루지만 RNG 는 예외다.
 *   난수 흐름까지 상태에 넣으면 세이브가 커지고 호출부가 지저분해진다.
 *   대신 **시드를 주면 완전히 재현된다** — 테스트와 `npm run sim` 이 그 성질만 쓴다.
 */
export interface Rng {
	/** [0, 1) */
	next(): number;
	/** [0, n) 정수 */
	int(n: number): number;
	/** 가중치 배열에서 인덱스 하나 */
	weighted(weights: readonly number[]): number;
	/** 배열에서 균등하게 하나 */
	pick<T>(items: readonly T[]): T;
}

export function createRng(seed = 1): Rng {
	let a = seed >>> 0;
	const next = (): number => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const int = (n: number): number => Math.floor(next() * n);
	return {
		next,
		int,
		weighted(weights) {
			let total = 0;
			for (const w of weights) total += w;
			let r = next() * total;
			for (let i = 0; i < weights.length; i++) {
				r -= weights[i] as number;
				if (r < 0) return i;
			}
			return weights.length - 1;
		},
		pick(items) {
			return items[int(items.length)] as (typeof items)[number];
		},
	};
}
