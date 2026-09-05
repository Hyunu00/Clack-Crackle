import { describe, expect, it } from "vitest";
import { simulate } from "../scripts/simulate";
import { BALL_TYPE_COUNT } from "../src/core/content/balls";
import { KEYCAP_COUNT } from "../src/core/content/keycaps";
import { formatDuration, orderOfMagnitude } from "../src/core/numbers";

/**
 * `docs/02-ECONOMY.md` §9 "목표 페이싱" 을 단언으로 옮긴 것.
 *
 * ★ **지금은 통과 못 하는 게 정상이다** (`prompts/PROMPTS.md` 7번).
 *   `02-ECONOMY.md` 의 수치는 전부 "시뮬레이션 검증 대기 중인 잠정값" 이고,
 *   `content/` 의 비용 곡선·계수는 그 잠정값을 코드로 옮기면서 채운 자리다.
 *
 * 그래서 `tests/i18n.test.ts` 의 `STRICT_KEY_COVERAGE` 와 같은 장치를 쓴다 —
 * **지금은 리포트, 수치를 확정한 뒤 에러.** 첫날부터 빨간불이면
 * `npm run check` 를 커밋 게이트로 쓸 수 없다 (`CLAUDE.md` 절대 규칙 10).
 *
 * 구조가 깨지는 것(보유 골드가 누적을 넘는다든가)은 지금도 **에러**다.
 * 그건 밸런스가 아니라 버그이기 때문이다.
 */
const STRICT_PACING = false;

/** 20시간을 0.2초 해상도로. dt 를 0.5 까지 키우면 첫 환생 시점이 4배 밀린다 */
const SIM = { hours: 20, seed: 1, dt: 0.2 };
const r = simulate(SIM);

const HOUR = 3600;
const misses: string[] = [];

function within(label: string, actual: number | null, lo: number, hi: number): void {
	const ok = actual !== null && actual >= lo && actual <= hi;
	if (!ok) {
		misses.push(
			`${label.padEnd(16)} ${actual === null ? "도달 못 함" : formatDuration(actual)}` +
				`  (목표 ${formatDuration(lo)}~${formatDuration(hi)})`,
		);
	}
	if (STRICT_PACING) expect(ok, label).toBe(true);
}

// ─────────────────────────────────────────────────────────────────────────────

describe("구조 — 지금도 에러다", () => {
	it("20시간이 끝까지 돈다", () => {
		expect(r.state.perm.stats.playSeconds).toBeGreaterThan(SIM.hours * HOUR - 1);
	});

	it("보유 골드가 누적 획득 골드를 넘지 않는다", () => {
		expect(r.state.run.gold.lte(r.state.perm.stats.totalGold)).toBe(true);
	});

	it("수입 출처 합이 누적을 넘지 않는다", () => {
		const by = r.state.perm.stats.goldBySource;
		const sum = by.keycap.add(by.ball).add(by.idle).add(by.refund);
		expect(sum.lte(r.state.perm.stats.totalGold)).toBe(true);
	});

	it("필드가 슬롯 수를 넘지 않는다", () => {
		expect(r.state.run.field.length).toBeLessThanOrEqual(12);
	});

	it("해금한 종류가 50을 넘지 않고 도감과 어긋나지 않는다", () => {
		const types = Object.keys(r.state.meta.types).length;
		expect(types).toBeLessThanOrEqual(BALL_TYPE_COUNT);
		for (const id of Object.keys(r.state.meta.dex)) {
			expect(r.state.meta.types[Number(id)]).toBeGreaterThan(0);
		}
	});

	it("키캡이 24종을 넘지 않고 중복되지 않는다", () => {
		expect(r.state.meta.caps.length).toBeLessThanOrEqual(KEYCAP_COUNT);
		expect(new Set(r.state.meta.caps).size).toBe(r.state.meta.caps.length);
	});

	it("자동화가 켜진 뒤에도 파괴가 계속 일어난다 — 후반이 무음이면 안 된다", () => {
		// `docs/04-AUDIO.md` 필수 처리 5번. 파괴가 멈추면 낼 소리 자체가 없다
		const last = r.samples[r.samples.length - 1];
		const prev = r.samples[r.samples.length - 2];
		expect(last.breaks - prev.breaks).toBeGreaterThan(0);
	});
});

// ─────────────────────────────────────────────────────────────────────────────

describe("페이싱 — docs/02-ECONOMY.md §9", () => {
	it("목표 표와 대조한다", () => {
		within("첫 왁뿌볼", r.firstBallAt, 0, 20);
		within("첫 파괴", r.firstBreakAt, 0, 20);
		within("첫 룰렛", r.firstRollAt, 0, 60);
		within("첫 Rare 키캡", r.firstRareCapAt, 0, 180);
		within("첫 환생", r.firstRebirthAt, 0, 600);
		within("자동 키캡", r.autoKeycapAt, 0, HOUR);
		within("자동 파괴", r.autoBreakAt, 0, 4 * HOUR);
		within("종류 50개", r.allTypesAt, 8 * HOUR, 10 * HOUR);
		within("키캡 24종", r.allCapsAt, 15 * HOUR, 20 * HOUR);

		const mag = orderOfMagnitude(r.state.perm.stats.totalGold);
		if (mag < 12) misses.push(`20시간 골드      1e${mag}  (최소 1e12)`);
		if (STRICT_PACING) expect(mag).toBeGreaterThanOrEqual(12);

		if (misses.length > 0) {
			console.warn(
				`[balance] 목표 미달 ${misses.length}건 — 수치 확정 대기 중 (docs/01-OPEN-QUESTIONS.md A)\n` +
					`${misses.map((m) => `  ${m}`).join("\n")}\n` +
					`  자세한 리포트는 npm run sim`,
			);
		}
		expect(true).toBe(true);
	});

	it("키캡 클릭 수입이 0 으로 수렴하면 경고한다 — 화면 주인공 문제", () => {
		const by = r.state.perm.stats.goldBySource;
		const total = by.keycap.add(by.ball).add(by.idle).add(by.refund);
		const share = total.gt(0) ? by.keycap.div(total).toNumber() : 0;
		if (share < 0.01) {
			console.warn(
				`[balance] 키캡 수입 비중 ${(share * 100).toFixed(3)}% — ` +
					"화면 주인공이 무의미해졌다 (docs/02-ECONOMY.md §10)",
			);
		}
		if (STRICT_PACING) expect(share).toBeGreaterThanOrEqual(0.01);
		expect(share).toBeGreaterThanOrEqual(0);
	});
});
