import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS } from "../src/core/content/achievements";
import {
	BALL_TYPE_COUNT,
	BALL_TYPES,
	BREAK_MODE_MULT,
	GRADE_DEFS,
	gradeDef,
	RARITY_BANDS,
} from "../src/core/content/balls";
import {
	KEYCAP_BANDS,
	KEYCAP_COUNT,
	KEYCAPS,
	TOTAL_IDLE_INCOME,
} from "../src/core/content/keycaps";
import { COST_BASE, COST_GROWTH } from "../src/core/content/roulette";
import { ALL_NODES, AUTO_BREAK_GRADES } from "../src/core/content/skilltree";
import {
	autoBreakGrades,
	ballGold,
	breakModeMult,
	breakSecondsFor,
	buySkill,
	createInitialState,
	pressKeycap,
	rebirth,
	rouletteCost,
	setHold,
	tick,
	unlockedTypeCount,
	updateSettings,
} from "../src/core/engine";
import { createRng } from "../src/core/numbers";
import { ballProgress, crackStage, dexBit, GRADES } from "../src/core/state";

const EN: Record<string, string> = JSON.parse(
	readFileSync(fileURLToPath(new URL("../src/i18n/en.json", import.meta.url)), "utf8"),
);

const rng = () => createRng(12345);
const fresh = () => createInitialState(rng());

// ─────────────────────────────────────────────────────────────────────────────

describe("콘텐츠 — docs/02-ECONOMY.md 를 옮긴 것이어야 한다", () => {
	it("왁뿌볼은 50종이고 희귀도 배분이 문서 그대로다", () => {
		expect(BALL_TYPE_COUNT).toBe(50);
		for (const band of RARITY_BANDS) {
			const got = BALL_TYPES.filter((b) => b.rarity === band.star);
			expect(got).toHaveLength(band.count);
			for (const b of got) {
				expect(b.baseValue).toBeGreaterThanOrEqual(band.valueRange[0]);
				expect(b.baseValue).toBeLessThanOrEqual(band.valueRange[1]);
			}
		}
	});

	it("키캡은 24종이고 등급 배분이 8/6/5/3/2 다", () => {
		expect(KEYCAP_COUNT).toBe(24);
		for (const band of KEYCAP_BANDS) {
			expect(KEYCAPS.filter((c) => c.grade === band.grade)).toHaveLength(band.count);
		}
	});

	it("같은 등급 안에서 골드 배율이 ±20% 로 벌어져 있다", () => {
		for (const band of KEYCAP_BANDS) {
			const mults = KEYCAPS.filter((c) => c.grade === band.grade).map((c) => c.goldMult);
			const lo = Math.min(...mults);
			const hi = Math.max(...mults);
			expect(lo).toBeCloseTo(band.goldMult * 0.8, 1);
			expect(hi).toBeCloseTo(band.goldMult * 1.2, 1);
		}
	});

	it("24종 전부 보유 + 1개 장착이면 방치 수입이 약 265 G/s 다", () => {
		const equipped = Math.max(...KEYCAPS.map((c) => c.idleIncome));
		expect(TOTAL_IDLE_INCOME - equipped).toBeGreaterThan(250);
		expect(TOTAL_IDLE_INCOME - equipped).toBeLessThan(280);
	});

	it("이름은 전부 i18n 키이고 en.json 에 실제로 있다", () => {
		const keys = [
			...BALL_TYPES.map((b) => b.nameKey),
			...KEYCAPS.map((c) => c.nameKey),
			...GRADE_DEFS.map((g) => g.nameKey),
			...ALL_NODES.flatMap((n) => [n.nameKey, n.descKey]),
			...ACHIEVEMENTS.flatMap((a) => [a.nameKey, a.descKey]),
		];
		const missing = keys.filter((k) => EN[k] === undefined);
		expect(missing).toEqual([]);
	});

	it("스프라이트 키가 docs/03-ART.md 파일명 규칙과 맞는다", () => {
		expect(BALL_TYPES[0].spriteKey).toBe("ball_001.png");
		expect(BALL_TYPES[49].spriteKey).toBe("ball_050.png");
		expect(KEYCAPS[23].spriteKey).toBe("cap_024.png");
	});

	it("업적은 26개다", () => {
		expect(ACHIEVEMENTS).toHaveLength(26);
	});
});

// ─────────────────────────────────────────────────────────────────────────────

describe("시작 상태", () => {
	it("★1 중 1종만 갖고 시작한다", () => {
		const s = fresh();
		expect(unlockedTypeCount(s)).toBe(1);
		const id = Number(Object.keys(s.meta.types)[0]);
		expect(BALL_TYPES.find((b) => b.id === id)?.rarity).toBe(1);
	});

	it("키캡도 골드도 0에서 시작한다", () => {
		const s = fresh();
		expect(s.meta.caps).toHaveLength(0);
		expect(s.run.gold.toNumber()).toBe(0);
	});
});

// ─────────────────────────────────────────────────────────────────────────────

describe("키캡", () => {
	it("N타마다 왁뿌볼이 하나 나온다", () => {
		let s = fresh();
		const period = 25; // 미장착 기본 주기
		for (let i = 0; i < period - 1; i++) s = pressKeycap(s, rng()).state;
		expect(s.run.field).toHaveLength(0);
		const step = pressKeycap(s, rng());
		expect(step.events.some((e) => e.type === "ball_spawn")).toBe(true);
		expect(step.state.run.field).toHaveLength(1);
	});

	it("키캡이 만드는 왁뿌볼은 항상 Common 이다", () => {
		let s = fresh();
		for (let i = 0; i < 200; i++) s = pressKeycap(s, rng()).state;
		for (const ball of s.run.field) expect(ball.grade).toBe("common");
	});

	it("누른 상태를 원본에 쓰지 않는다 (불변)", () => {
		const s = fresh();
		const before = s.run.gold.toString();
		pressKeycap(s, rng());
		expect(s.run.gold.toString()).toBe(before);
		expect(s.run.field).toHaveLength(0);
	});
});

// ─────────────────────────────────────────────────────────────────────────────

describe("부수기 — 꾹 누르기 전용 (2026-09)", () => {
	function withOneBall() {
		let s = fresh();
		while (s.run.field.length === 0) s = pressKeycap(s, rng()).state;
		return s;
	}

	it("약 3초 꾹 누르면 부서진다", () => {
		let s = withOneBall();
		const uid = s.run.field[0].uid;
		const seconds = breakSecondsFor(s, "common");
		s = setHold(s, uid, true).state;
		const step = tick(s, seconds, rng());
		expect(step.events.some((e) => e.type === "ball_shatter")).toBe(true);
		expect(step.state.run.field).toHaveLength(0);
		// "파괴 1회 = 약 3초" 는 감각 제약이다 (docs/02-ECONOMY.md)
		expect(seconds).toBeGreaterThan(2);
		expect(seconds).toBeLessThan(4);
	});

	it("손을 떼도 진행률이 리셋되지 않는다 — 끊어 누르기", () => {
		let s = withOneBall();
		const uid = s.run.field[0].uid;
		s = setHold(s, uid, true).state;
		s = tick(s, 1, rng()).state;
		const mid = ballProgress(s.run.field[0]);
		expect(mid).toBeGreaterThan(0);

		s = setHold(s, uid, false).state;
		s = tick(s, 5, rng()).state; // 떼고 한참 둬도
		expect(ballProgress(s.run.field[0])).toBeCloseTo(mid, 6);

		s = setHold(s, uid, true).state; // 다시 누르면 이어서
		s = tick(s, 0.5, rng()).state;
		expect(ballProgress(s.run.field[0])).toBeGreaterThan(mid);
	});

	it("다시 누를 때마다 소리가 새로 난다", () => {
		let s = withOneBall();
		const uid = s.run.field[0].uid;
		expect(setHold(s, uid, true).events.some((e) => e.type === "ball_hold_start")).toBe(true);
		s = setHold(s, uid, true).state;
		expect(setHold(s, uid, false).events.some((e) => e.type === "ball_hold_stop")).toBe(true);
	});

	it("균열은 진행률 20% 간격으로 5단계가 전부 나간다", () => {
		let s = withOneBall();
		const uid = s.run.field[0].uid;
		s = setHold(s, uid, true).state;
		const seconds = breakSecondsFor(s, "common");
		const stages: number[] = [];
		let shattered = false;
		for (let i = 0; i < 200 && !shattered; i++) {
			const step = tick(s, seconds / 100, rng());
			s = step.state;
			for (const e of step.events) {
				if (e.type === "ball_crack") stages.push(e.stage);
				if (e.type === "ball_shatter") shattered = true;
			}
		}
		// 기본 4구간: 마지막 구간의 끝(100%)은 균열이 아니라 파괴다
		expect(stages).toEqual([1, 2, 3]);
		expect(shattered).toBe(true);
	});

	it("설정을 5구간으로 바꾸면 네 번 울린다 — 소리 밀도만 바뀐다", () => {
		let s = withOneBall();
		s = updateSettings(s, { crackStages: 5 });
		const uid = s.run.field[0].uid;
		s = setHold(s, uid, true).state;
		const seconds = breakSecondsFor(s, "common");
		const stages: number[] = [];
		let shattered = false;
		let gold = 0;
		for (let i = 0; i < 200 && !shattered; i++) {
			const step = tick(s, seconds / 100, rng());
			s = step.state;
			for (const e of step.events) {
				if (e.type === "ball_crack") stages.push(e.stage);
				if (e.type === "ball_shatter") {
					shattered = true;
					gold = e.gold.toNumber();
				}
			}
		}
		expect(stages).toEqual([1, 2, 3, 4]);
		// ★ 감각 설정이지 밸런스 설정이 아니다 — 골드는 4구간과 같아야 한다
		const four = fresh();
		const id = Number(Object.keys(four.meta.types)[0]);
		expect(gold).toBeCloseTo(ballGold(four, id, "common", BREAK_MODE_MULT.hold).toNumber(), 6);
	});

	it("단계는 시간이 아니라 진행률로 계산된다", () => {
		expect(crackStage(0, 4)).toBe(0);
		expect(crackStage(0.24, 4)).toBe(0);
		expect(crackStage(0.25, 4)).toBe(1);
		expect(crackStage(0.99, 4)).toBe(3);
		expect(crackStage(1, 4)).toBe(4);
		// 5구간이면 20% 간격
		expect(crackStage(0.2, 5)).toBe(1);
		expect(crackStage(0.8, 5)).toBe(4);
	});

	it("골드 배율은 기여한 진행률로 가중 평균된다 (Q11)", () => {
		expect(breakModeMult({ hold: 1, auto: 0 })).toBeCloseTo(BREAK_MODE_MULT.hold);
		expect(breakModeMult({ hold: 0, auto: 1 })).toBeCloseTo(BREAK_MODE_MULT.auto);
		expect(breakModeMult({ hold: 0.5, auto: 0.5 })).toBeCloseTo(
			(BREAK_MODE_MULT.hold + BREAK_MODE_MULT.auto) / 2,
		);
		// 진행이 0인 채로 부순 것(즉시 파괴)은 자동 취급
		expect(breakModeMult({ hold: 0, auto: 0 })).toBeCloseTo(BREAK_MODE_MULT.auto);
	});

	it("자동 파괴의 60% 페널티가 살아 있다 — ASMR 을 지키는 장치", () => {
		expect(BREAK_MODE_MULT.auto).toBeLessThan(BREAK_MODE_MULT.hold);
		const s = fresh();
		const id = Number(Object.keys(s.meta.types)[0]);
		const byHand = ballGold(s, id, "common", BREAK_MODE_MULT.hold);
		const byAuto = ballGold(s, id, "common", BREAK_MODE_MULT.auto);
		expect(byAuto.div(byHand).toNumber()).toBeCloseTo(0.6, 6);
	});
});

// ─────────────────────────────────────────────────────────────────────────────

describe("자동 파괴 — 등급별 해금 (🟢 Q1)", () => {
	it("노드 레벨이 곧 자동으로 깨지는 등급의 상한이다", () => {
		let s = fresh();
		expect(autoBreakGrades(s)).toEqual([]);
		for (let level = 1; level <= 5; level++) {
			s = { ...s, meta: { ...s.meta, skills: { "auto.break": level } } };
			expect(autoBreakGrades(s)).toEqual(AUTO_BREAK_GRADES[level]);
		}
	});

	it("Lv.4 까지는 Supreme 을 손으로 부숴야 한다", () => {
		const s = { ...fresh(), meta: { ...fresh().meta, skills: { "auto.break": 4 } } };
		expect(autoBreakGrades(s)).not.toContain("supreme");
	});

	it("해금했어도 설정으로 끌 수 있다", () => {
		const base = fresh();
		const s = {
			...base,
			meta: { ...base.meta, skills: { "auto.break": 5 } },
			perm: { ...base.perm, settings: { ...base.perm.settings, autoBreak: false } },
		};
		expect(autoBreakGrades(s)).toEqual([]);
	});
});

// ─────────────────────────────────────────────────────────────────────────────

describe("두 개의 축 — rarity 와 grade 를 혼용하지 않는다", () => {
	it("등급 비트는 5개이고 희귀도와 별개다", () => {
		expect(GRADES).toHaveLength(5);
		expect(dexBit("common")).toBe(1);
		expect(dexBit("supreme")).toBe(16);
		// ★1 종류도 Supreme 개체가 나올 수 있다
		const star1 = BALL_TYPES.find((b) => b.rarity === 1);
		expect(star1).toBeDefined();
		expect(gradeDef("supreme").goldMult).toBe(200);
	});
});

// ─────────────────────────────────────────────────────────────────────────────

describe("룰렛", () => {
	it("비용이 100 × 1.04^n 이다", () => {
		const s = fresh();
		expect(rouletteCost(s).toNumber()).toBeCloseTo(COST_BASE, 6);
		const s50 = { ...s, run: { ...s.run, rouletteCount: 50 } };
		expect(rouletteCost(s50).toNumber()).toBeCloseTo(COST_BASE * COST_GROWTH ** 50, 0);
	});

	it("환생하면 비용 카운터가 리셋된다 — 이게 환생 동기다", () => {
		const base = fresh();
		const s = {
			...base,
			run: { ...base.run, rouletteCount: 150, goldEarned: base.run.gold.add(1_000_000) },
		};
		const after = rebirth(s).state;
		expect(after.run.rouletteCount).toBe(0);
		expect(rouletteCost(after).toNumber()).toBeCloseTo(COST_BASE, 6);
	});
});

// ─────────────────────────────────────────────────────────────────────────────

describe("환생", () => {
	it("환생재화가 √(이번 판 누적 골드) 스케일이다 — 고정값이 아니다", () => {
		const base = fresh();
		const make = (earned: number) => ({
			...base,
			run: { ...base.run, goldEarned: base.run.goldEarned.add(earned), brokenCount: 0 },
		});
		const a = rebirth(make(1_000_000)).state.meta.rebirthCurrency.toNumber();
		const b = rebirth(make(100_000_000)).state.meta.rebirthCurrency.toNumber();
		// 골드 100배면 재화 10배
		expect(b / a).toBeCloseTo(10, 1);
	});

	it("2층·3층은 살아남고 1층만 리셋된다", () => {
		const base = fresh();
		const s = {
			...base,
			run: { ...base.run, goldEarned: base.run.goldEarned.add(1_000_000), rouletteCount: 40 },
			meta: { ...base.meta, types: { ...base.meta.types, 7: 3 }, caps: [1, 2] },
		};
		const after = rebirth(s).state;
		expect(after.run.gold.toNumber()).toBe(0);
		expect(after.run.field).toHaveLength(0);
		expect(after.meta.types[7]).toBe(3); // 종류 레벨은 유지
		expect(after.meta.caps).toEqual([1, 2]); // 키캡 컬렉션 유지
		expect(after.perm.stats.totalRebirths).toBe(1); // 누적 통계 유지
	});

	it("보유 골드가 누적 획득 골드를 넘지 않는다", () => {
		const base = fresh();
		const s = {
			...base,
			run: { ...base.run, goldEarned: base.run.goldEarned.add(1e12) },
			meta: { ...base.meta, skills: { startingGold: 5 } },
		};
		const after = rebirth(s).state;
		expect(after.run.gold.lte(after.perm.stats.totalGold)).toBe(true);
	});
});

// ─────────────────────────────────────────────────────────────────────────────

describe("스킬트리", () => {
	it("골드 획득량과 방치 수입에는 상한이 없다", () => {
		for (const id of ["goldMult", "idleIncome", "startingGold"]) {
			expect(ALL_NODES.find((n) => n.id === id)?.maxLevel).toBe(Number.POSITIVE_INFINITY);
		}
	});

	it("재화가 모자라면 거절하고 상태를 바꾸지 않는다", () => {
		const s = fresh();
		const step = buySkill(s, "goldMult");
		expect(step.events).toEqual([{ type: "denied", reason: "currency" }]);
		expect(step.state).toBe(s);
	});

	it("사면 레벨이 오르고 재화가 빠진다", () => {
		const base = fresh();
		const s = {
			...base,
			meta: { ...base.meta, rebirthCurrency: base.meta.rebirthCurrency.add(10) },
		};
		const step = buySkill(s, "goldMult");
		expect(step.state.meta.skills.goldMult).toBe(1);
		expect(step.state.meta.rebirthCurrency.lt(s.meta.rebirthCurrency)).toBe(true);
		expect(step.events.some((e) => e.type === "skill_buy")).toBe(true);
	});
});

// ─────────────────────────────────────────────────────────────────────────────

describe("업적", () => {
	it("첫 파괴가 잡힌다", () => {
		let s = fresh();
		const r = rng();
		let unlocked = false;
		for (let i = 0; i < 400 && !unlocked; i++) {
			const step = pressKeycap(s, r);
			s = step.state;
			if (s.run.field.length > 0) {
				const uid = s.run.field[0].uid;
				s = setHold(s, uid, true).state;
				const t = tick(s, 5, r);
				s = t.state;
				unlocked = t.events.some((e) => e.type === "achievement" && e.id === "FIRST_BREAK");
			}
		}
		expect(unlocked).toBe(true);
		expect(s.perm.achievements).toContain("FIRST_BREAK");
	});
});
