/**
 * 밸런스 시뮬레이터 — 화면 없이 게임을 돌린다.
 *
 * `src/core/` 가 순수 함수라서 가능한 것이고, 이게 이 프로젝트 개발 방식의
 * 핵심이다 (`docs/09-DEV-ENV.md` "이 프로젝트의 개발 방식").
 *
 * ★ **여기 있는 상수는 밸런스 값이 아니라 "봇이 어떻게 노는가" 다.**
 *   밸런스 수치는 전부 `src/core/content/` 에 있다 (`CLAUDE.md` 절대 규칙 2).
 *   봇 정책을 바꾸면 리포트가 바뀌지만 게임은 바뀌지 않는다.
 *
 * 리포트 출력은 `scripts/sim.ts`, 단언은 `tests/balance.test.ts` 가 맡는다.
 */

import {
	BALL_TYPE_COUNT,
	BREAK_MODE_MULT,
	ballType,
	gradeDef,
	TYPE_LEVEL_MULT,
} from "../src/core/content/balls";
import { KEYCAP_COUNT } from "../src/core/content/keycaps";
import {
	ballGold,
	buySkill,
	createInitialState,
	pressKeycap,
	rebirth,
	rebirthGain,
	resolveFieldFull,
	roll,
	rouletteCost,
	setHold,
	skillCost,
	skillLevel,
	tick,
	unlockedTypeCount,
} from "../src/core/engine";
import { createRng, type Decimal, ZERO } from "../src/core/numbers";
import type { GameEvent, GameState, GoldSource, Grade } from "../src/core/state";

// ─────────────────────────────────────────────────────────────────────────────
// 봇 정책 (밸런스 값 아님)
// ─────────────────────────────────────────────────────────────────────────────

/** 손이 하나뿐이다. 필드에 왁뿌볼이 있으면 그걸 누르고, 없을 때만 키캡을 친다 */
const PLAYER_PRESSES_PER_SEC = 8;

/**
 * 봇이 룰렛을 돌리는 최대 속도(초당).
 *
 * 무한 루프 방지가 아니라 **사람 흉내다.** 여기를 막지 않으면 봇이 초당 수백 번을
 * 돌려서 실제 플레이와 전혀 다른 곡선이 나온다 (그리고 시뮬이 몇 분씩 걸린다).
 */
const ROLLS_PER_SEC = 5;

/** 이 횟수 아래에서는 환생하지 않는다. 첫 판이 너무 짧게 끝나는 걸 막는다 */
const MIN_ROLLS_BEFORE_REBIRTH = 25;

/**
 * 룰렛 1회 비용이 **이만큼의 수입 시간**을 넘으면 환생할 때가 됐다.
 *
 * 누적 골드로 재면 안 된다 — 누적은 계속 늘어나는데 비용은 못 감당해서
 * 멈춰 있으므로 비율이 영원히 안 넘어간다. 실제로 그렇게 짰다가
 * 20시간 동안 환생이 0회로 나왔다. **속도로 재야 한다.**
 */
const REBIRTH_COST_SECONDS = 120;

/** 수입 속도를 재는 창(초) */
const INCOME_WINDOW = 60;

/** 살 수 있으면 이 순서로 산다. 자동화가 먼저다 — 손가락이 상한이면 안 되니까 */
const BUY_ORDER: readonly string[] = [
	"auto.keycap",
	"goldMult",
	"breakEfficiency",
	"fieldSlots",
	"auto.break",
	"discoveryRate",
	"gradeOdds",
	"idleIncome",
	"fragOdds",
	"auto.roulette",
	"startingGold",
];

/**
 * 봇이 "어느 게 더 값나가나" 를 비교할 때 쓰는 점수.
 *
 * `expectedGold` 는 `Decimal.pow` 를 두 번 부른다. 틱마다 필드 전부에 대해
 * 부르면 20시간 시뮬에서만 수백만 번이라 그게 실행 시간의 대부분이 된다.
 * 봇은 **순서만 알면 되므로** 로그 공간의 실수로 잰다 — 발산도 안 한다.
 * (게임 안의 실제 골드는 그대로 `Decimal` 이다. 여기는 봇 전용이다.)
 */
function score(state: GameState, ball: { typeId: number; grade: Grade }): number {
	const level = Math.max(1, state.meta.types[ball.typeId] ?? 1);
	return (
		Math.log(ballType(ball.typeId).baseValue) +
		(level - 1) * Math.log(TYPE_LEVEL_MULT) +
		Math.log(gradeDef(ball.grade).goldMult)
	);
}

// ─────────────────────────────────────────────────────────────────────────────

export interface SimOptions {
	hours: number;
	seed: number;
	/** 시뮬 해상도(초). 작을수록 정확하고 느리다 */
	dt: number;
	/** 표본 간격(초) */
	sampleEvery: number;
}

export const DEFAULT_SIM: SimOptions = { hours: 20, seed: 1, dt: 0.1, sampleEvery: 600 };

export interface SimSample {
	t: number;
	gold: Decimal;
	goldBySource: Readonly<Record<GoldSource, Decimal>>;
	types: number;
	caps: number;
	rebirths: number;
	breaks: number;
}

export interface SimResult {
	state: GameState;
	samples: readonly SimSample[];
	/** 감시 지표. 도달하지 못했으면 `null` */
	firstBallAt: number | null;
	firstBreakAt: number | null;
	firstRollAt: number | null;
	firstCapAt: number | null;
	firstRareCapAt: number | null;
	firstRebirthAt: number | null;
	autoKeycapAt: number | null;
	autoBreakAt: number | null;
	allTypesAt: number | null;
	allCapsAt: number | null;
	elapsedMs: number;
	totalTicks: number;
}

export function simulate(opts: Partial<SimOptions> = {}): SimResult {
	const o = { ...DEFAULT_SIM, ...opts };
	const rng = createRng(o.seed);
	let state = createInitialState(rng);

	const samples: SimSample[] = [];
	const marks: Record<string, number | null> = {
		firstBallAt: null,
		firstBreakAt: null,
		firstRollAt: null,
		firstCapAt: null,
		firstRareCapAt: null,
		firstRebirthAt: null,
		autoKeycapAt: null,
		autoBreakAt: null,
		allTypesAt: null,
		allCapsAt: null,
	};

	const mark = (key: string, t: number): void => {
		if (marks[key] === null) marks[key] = t;
	};

	// ★ 엔진 함수는 전부 `Step` 을 돌려준다. **이벤트를 버리면 마크가 비어버린다** —
	//   `ball_spawn` 은 `pressKeycap`, `cap_complete` 는 `roll` 에서 나온다.
	let now = 0;
	const apply = (step: { state: GameState; events: readonly GameEvent[] }): GameState => {
		scanEvents(step.events, now, mark);
		return step.state;
	};

	const started = Date.now();
	const totalSeconds = o.hours * 3600;
	let t = 0;
	let ticks = 0;
	let pressCarry = 0;
	let rollCarry = 0;
	let nextSample = 0;
	// 최근 수입 속도. 환생 타이밍 판단에만 쓴다
	let windowStartGold = state.perm.stats.totalGold;
	let windowStartT = 0;
	let incomePerSec = 0;

	while (t < totalSeconds) {
		now = t;
		// ── 확대 화면이 떠 있으면 먼저 치운다 ──────────────────────────────────
		state = apply(resolvePending(state));

		// ── 손 하나. 필드에 있으면 제일 값비싼 걸 누르고, 없으면 키캡을 친다 ──
		state = focusBest(state);
		if (state.run.field.length === 0) {
			pressCarry += o.dt * PLAYER_PRESSES_PER_SEC;
			const presses = Math.floor(pressCarry);
			pressCarry -= presses;
			for (let i = 0; i < presses; i++) state = apply(pressKeycap(state, rng));
		}

		// ── 시간을 굴린다 ─────────────────────────────────────────────────────
		ticks++;
		t += o.dt;
		now = t;
		state = apply(tick(state, o.dt, rng));

		// ── 벌었으면 쓴다 ─────────────────────────────────────────────────────
		rollCarry += o.dt * ROLLS_PER_SEC;
		const rolls = Math.floor(rollCarry);
		rollCarry -= rolls;
		state = spendOnRoulette(state, rng, t, mark, apply, rolls);
		state = spendOnSkills(state, t, mark, apply);

		if (unlockedTypeCount(state) >= BALL_TYPE_COUNT) mark("allTypesAt", t);
		if (state.meta.caps.length >= KEYCAP_COUNT) mark("allCapsAt", t);

		// ── 환생 판단 ─────────────────────────────────────────────────────────
		if (shouldRebirth(state, incomePerSec)) {
			state = apply(rebirth(state));
			mark("firstRebirthAt", t);
			windowStartGold = state.perm.stats.totalGold;
			windowStartT = t;
			incomePerSec = 0;
		}

		if (t - windowStartT >= INCOME_WINDOW) {
			incomePerSec =
				state.perm.stats.totalGold.sub(windowStartGold).toNumber() / (t - windowStartT);
			windowStartGold = state.perm.stats.totalGold;
			windowStartT = t;
		}

		if (t >= nextSample) {
			samples.push(sample(state, t));
			nextSample += o.sampleEvery;
		}
	}
	// 마지막 정기 표본과 같은 시각이면 또 넣지 않는다.
	// 넣으면 "마지막 두 표본의 증분" 이 항상 0 이라 후반 지표가 거짓말을 한다
	const tail = samples[samples.length - 1];
	if (!tail || t - tail.t > 1e-6) samples.push(sample(state, t));

	return {
		state,
		samples,
		firstBallAt: marks.firstBallAt ?? null,
		firstBreakAt: marks.firstBreakAt ?? null,
		firstRollAt: marks.firstRollAt ?? null,
		firstCapAt: marks.firstCapAt ?? null,
		firstRareCapAt: marks.firstRareCapAt ?? null,
		firstRebirthAt: marks.firstRebirthAt ?? null,
		autoKeycapAt: marks.autoKeycapAt ?? null,
		autoBreakAt: marks.autoBreakAt ?? null,
		allTypesAt: marks.allTypesAt ?? null,
		allCapsAt: marks.allCapsAt ?? null,
		elapsedMs: Date.now() - started,
		totalTicks: ticks,
	};
}

// ─────────────────────────────────────────────────────────────────────────────

function scanEvents(
	events: readonly GameEvent[],
	t: number,
	mark: (key: string, t: number) => void,
): void {
	for (const e of events) {
		switch (e.type) {
			case "ball_spawn":
				mark("firstBallAt", t);
				break;
			case "ball_shatter":
				mark("firstBreakAt", t);
				break;
			case "cap_complete":
				mark("firstCapAt", t);
				if (e.grade === "rare") mark("firstRareCapAt", t);
				break;
			default:
				break;
		}
	}
}

/** 봇은 마찰이 없으므로 늘 이득이 되는 쪽을 고른다 */
function resolvePending(state: GameState): { state: GameState; events: readonly GameEvent[] } {
	const incoming = state.run.pending;
	if (!incoming) return { state, events: [] };
	let worstIdx = 0;
	let worst = score(state, state.run.field[0]);
	for (let i = 1; i < state.run.field.length; i++) {
		const g = score(state, state.run.field[i]);
		if (g < worst) {
			worst = g;
			worstIdx = i;
		}
	}
	const victim = state.run.field[worstIdx];
	const choice =
		score(state, incoming) > worst
			? ({ kind: "replace", uid: victim.uid } as const)
			: ({ kind: "destroy" } as const);
	return resolveFieldFull(state, choice);
}

/** 값이 제일 큰 것 하나만 누른다. 손은 하나다 */
function focusBest(state: GameState): GameState {
	if (state.run.field.length === 0) return state;
	let bestUid = state.run.field[0].uid;
	let best = score(state, state.run.field[0]);
	for (const ball of state.run.field) {
		const g = score(state, ball);
		if (g > best) {
			best = g;
			bestUid = ball.uid;
		}
	}
	let next = state;
	for (const ball of state.run.field) {
		const want = ball.uid === bestUid;
		if (ball.holding !== want) next = setHold(next, ball.uid, want).state;
	}
	return next;
}

function spendOnRoulette(
	state: GameState,
	rng: ReturnType<typeof createRng>,
	t: number,
	mark: (key: string, t: number) => void,
	apply: Apply,
	budget: number,
): GameState {
	let next = state;
	for (let i = 0; i < budget; i++) {
		if (next.run.gold.lt(rouletteCost(next))) break;
		next = apply(roll(next, rng));
		mark("firstRollAt", t);
	}
	return next;
}

function spendOnSkills(
	state: GameState,
	t: number,
	mark: (key: string, t: number) => void,
	apply: Apply,
): GameState {
	let next = state;
	let bought = true;
	while (bought) {
		bought = false;
		for (const id of BUY_ORDER) {
			if (next.meta.rebirthCurrency.lt(skillCost(next, id))) continue;
			const after = buyIfPossible(next, id, apply);
			if (after === next) continue;
			next = after;
			bought = true;
			if (id === "auto.keycap") mark("autoKeycapAt", t);
			if (id === "auto.break" && skillLevel(next, "auto.break") === 1) mark("autoBreakAt", t);
			break;
		}
	}
	return next;
}

type Apply = (step: { state: GameState; events: readonly GameEvent[] }) => GameState;

function buyIfPossible(state: GameState, id: string, apply: Apply): GameState {
	const step = buySkill(state, id);
	return step.events.some((e) => e.type === "denied") ? state : apply(step);
}

/**
 * 룰렛이 감당 안 되게 비싸지면 환생할 때가 된 것이다.
 * 이 판단이 시스템에서 나온다는 게 비용 곡선을 넣은 이유다
 * (`docs/06-DECISIONS.md` "룰렛 비용 지수 상승 + 환생 리셋").
 */
function shouldRebirth(state: GameState, incomePerSec: number): boolean {
	if (state.run.rouletteCount < MIN_ROLLS_BEFORE_REBIRTH) return false;
	if (incomePerSec <= 0) return false;
	if (rebirthGain(state).lte(0)) return false;
	return rouletteCost(state).gt(incomePerSec * REBIRTH_COST_SECONDS);
}

function sample(state: GameState, t: number): SimSample {
	return {
		t,
		gold: state.run.gold,
		goldBySource: state.perm.stats.goldBySource,
		types: unlockedTypeCount(state),
		caps: state.meta.caps.length,
		rebirths: state.perm.stats.totalRebirths,
		breaks: state.perm.stats.totalBreaks,
	};
}

/** 표본 사이의 증분. 시간대별 수입 출처 비율을 내려면 누적을 빼야 한다 */
export function deltaBySource(
	prev: SimSample | undefined,
	cur: SimSample,
): Record<GoldSource, Decimal> {
	const out = {} as Record<GoldSource, Decimal>;
	for (const key of ["keycap", "ball", "idle", "refund"] as const) {
		const before = prev ? prev.goldBySource[key] : ZERO;
		out[key] = cur.goldBySource[key].sub(before);
	}
	return out;
}

/** 손으로 부순다고 가정한 파괴 골드. 리포트가 "지금 한 방에 얼마" 를 보여줄 때 */
export function handBreakGold(state: GameState, typeId: number): Decimal {
	return ballGold(state, typeId, "common", BREAK_MODE_MULT.hold);
}
