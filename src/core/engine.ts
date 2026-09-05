/**
 * 엔진 — 순수 함수 전부 (`prompts/PROMPTS.md` 6번).
 *
 * ★ `pixi.js` / `howler` 를 import 하지 않는다 (`CLAUDE.md` 절대 규칙 1).
 * ★ 숫자 리터럴을 두지 않는다. 밸런스 값은 전부 `content/` 에 있다 (규칙 2).
 * ★ 들어온 `GameState` 를 절대 고치지 않는다. 항상 새 객체를 만들어 돌려준다 (규칙 9).
 *   20시간 시뮬이 100ms 안에 끝나므로 성능을 이유로 mutable 하게 바꾸지 않는다.
 *
 * 시간을 굴리는 입구는 `tick` 하나다. 누르고 있는 왁뿌볼, 자동 파괴, 자동 키캡,
 * 자동 룰렛, 방치 수입이 전부 여기서 돈다. **오프라인 진행은 없다** — `tick` 은
 * 게임이 켜져 있을 때만 불린다.
 */

import { ACHIEVEMENTS, type Achievement, type AchievementCondition } from "./content/achievements";
import {
	BALL_TYPES,
	BREAK_MODE_MULT,
	ballType,
	CRACK_STAGES_DEFAULT,
	CRACK_STAGES_OPTIONS,
	gradeDef,
	MIN_BREAK_SECONDS,
	TYPE_LEVEL_MULT,
} from "./content/balls";
import {
	BARE_BALL_PERIOD,
	BARE_GOLD_MULT,
	KEYCAP_BASE_GOLD,
	KEYCAPS,
	keycap,
	keycapBand,
	keycapsOfGrade,
	STARTING_CAPS,
} from "./content/keycaps";
import {
	BALL_GRADE_WEIGHTS,
	COST_BASE,
	COST_GROWTH,
	FRAGMENT_GRADE_WEIGHTS,
	FRAGMENTS_PER_HIT,
	gradeAt,
	NEW_UNLOCK_SHARE,
	OUTCOME_ORDER,
	OUTCOME_WEIGHTS,
	RARITY_UNLOCK_WEIGHTS,
} from "./content/roulette";
import {
	AUTO_BREAK_GRADES,
	AUTO_KEYCAP_PPS,
	AUTO_PREFIX,
	AUTO_ROULETTE_INTERVAL,
	AUTO_ROULETTE_MARGIN,
	BASE_FIELD_SLOTS,
	REBIRTH_COEFF,
	skillNode,
} from "./content/skilltree";
import { D, Decimal, type Rng, ZERO } from "./numbers";
import {
	type BreakMode,
	ballProgress,
	crackStage,
	type DeniedReason,
	dexBit,
	type FieldBall,
	type GameEvent,
	type GameState,
	type GoldSource,
	GRADES,
	type Grade,
	gradeIndex,
	type MetaState,
	type PermanentState,
	RARITIES,
	type Rarity,
	type RunState,
	SAVE_VERSION,
	type Settings,
	type Step,
} from "./state";

// ─────────────────────────────────────────────────────────────────────────────
// 초기 상태
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Settings = {
	fieldFullDefault: "ask",
	crackStages: CRACK_STAGES_DEFAULT,
	autoBreak: true,
	autoKeycap: true,
	autoRoulette: true,
	volumeMaster: 0.8,
	volumeSfx: 1,
	volumeBgm: 0.5,
	bgmEnabled: false,
	flashOnBreak: false,
	locale: null,
};

function emptyFragments(): Record<Grade, number> {
	return { common: 0, rare: 0, epic: 0, legendary: 0, supreme: 0 };
}

function emptyGoldBySource(): Record<GoldSource, Decimal> {
	return { keycap: ZERO, ball: ZERO, idle: ZERO, refund: ZERO };
}

/** 시작 시 보유 종류는 **★1 중 1종만** (`docs/02-ECONOMY.md` §2) */
export function createInitialState(rng: Rng): GameState {
	const starters = BALL_TYPES.filter((b) => b.rarity === 1);
	const first = rng.pick(starters);
	return {
		version: SAVE_VERSION,
		run: freshRun(ZERO),
		meta: {
			rebirthCurrency: ZERO,
			skills: {},
			caps: [...STARTING_CAPS],
			fragments: emptyFragments(),
			types: { [first.id]: 1 },
			dex: {},
		},
		perm: {
			stats: {
				playSeconds: 0,
				totalBreaks: 0,
				totalRolls: 0,
				totalRebirths: 0,
				totalGold: ZERO,
				goldBySource: emptyGoldBySource(),
				gradesSeen: 0,
				maxTypeLevel: 1,
				rouletteFails: 0,
			},
			achievements: [],
			settings: { ...DEFAULT_SETTINGS },
		},
	};
}

function freshRun(startingGold: Decimal): RunState {
	return {
		gold: startingGold,
		goldEarned: ZERO,
		field: [],
		equippedCapId: null,
		rouletteCount: 0,
		capPresses: 0,
		autoPressAcc: 0,
		autoRollTimer: 0,
		brokenCount: 0,
		gradeBonusSum: 0,
		pending: null,
		nextUid: 1,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// 파생 값 — 상태를 읽기만 한다. 화면도 그대로 쓴다
// ─────────────────────────────────────────────────────────────────────────────

export function skillLevel(state: GameState, id: string): number {
	return state.meta.skills[id] ?? 0;
}

/** 스킬트리 "골드 획득량". 모든 골드 수입에 곱해진다. 상한 없음 */
export function goldMultiplier(state: GameState): Decimal {
	const node = skillNode("goldMult");
	return Decimal.pow(node.perLevel, skillLevel(state, node.id));
}

/** 스킬트리 "방치 수입". 미장착 키캡의 G/s 에 곱해진다. 상한 없음 */
export function idleMultiplier(state: GameState): Decimal {
	const node = skillNode("idleIncome");
	return Decimal.pow(node.perLevel, skillLevel(state, node.id));
}

/** 필드 슬롯 5 → 최대 12 */
export function fieldSlots(state: GameState): number {
	const node = skillNode("fieldSlots");
	return BASE_FIELD_SLOTS + skillLevel(state, node.id) * node.perLevel;
}

/**
 * 하나를 부수는 데 걸리는 시간(초).
 *
 * ★ **"파괴 1회 = 약 3초" 는 밸런스 수치가 아니라 감각 제약이다**
 *   (`docs/02-ECONOMY.md`). 다른 수치를 맞추려고 이걸 늘리거나 줄이면
 *   `CLAUDE.md` 우선순위 1번을 어기는 것이다.
 *   "부수기 효율" 노드가 줄여주는 건 정상적인 성장이고, 하한에서 멈춘다.
 */
export function breakSecondsFor(state: GameState, grade: Grade): number {
	const node = skillNode("breakEfficiency");
	const reduce = 1 - skillLevel(state, node.id) * node.perLevel;
	return Math.max(MIN_BREAK_SECONDS, gradeDef(grade).breakSeconds * reduce);
}

/** 자동으로 깨지는 등급. 노드 레벨이 곧 등급 상한이다 (🟢 Q1, 2026-09) */
export function autoBreakGrades(state: GameState): readonly Grade[] {
	if (!state.perm.settings.autoBreak) return [];
	const level = skillLevel(state, `${AUTO_PREFIX}break`);
	return AUTO_BREAK_GRADES[Math.min(level, AUTO_BREAK_GRADES.length - 1)] as readonly Grade[];
}

/** 설정된 균열 구간 수. 이상한 값이 들어와 있으면 기본값으로 떨어진다 */
export function crackStages(state: GameState): number {
	const want = state.perm.settings.crackStages;
	return CRACK_STAGES_OPTIONS.includes(want) ? want : CRACK_STAGES_DEFAULT;
}

export function isAutoBreakable(state: GameState, grade: Grade): boolean {
	return autoBreakGrades(state).includes(grade);
}

/** `비용 = 100 × 1.04 ^ (이번 판 누적 횟수)`. 환생하면 리셋된다 */
export function rouletteCost(state: GameState): Decimal {
	return D(COST_BASE).mul(Decimal.pow(COST_GROWTH, state.run.rouletteCount));
}

/** 스킬 노드 한 레벨의 비용 (환생재화) */
export function skillCost(state: GameState, nodeId: string): Decimal {
	const node = skillNode(nodeId);
	return D(node.costBase).mul(Decimal.pow(node.costGrowth, skillLevel(state, nodeId)));
}

export function unlockedTypeIds(state: GameState): readonly number[] {
	return Object.keys(state.meta.types).map(Number);
}

export function typeLevel(state: GameState, typeId: number): number {
	return state.meta.types[typeId] ?? 0;
}

/** 종류 기초 가치 (레벨 반영). `기초 = 기본값 × 1.2 ^ (레벨-1)` */
export function typeValue(state: GameState, typeId: number): Decimal {
	const level = Math.max(1, typeLevel(state, typeId));
	return D(ballType(typeId).baseValue).mul(Decimal.pow(TYPE_LEVEL_MULT, level - 1));
}

/**
 * 파괴 골드.
 *
 * ```
 * 종류_기초가치(레벨 반영) × 등급_배율 × 스킬트리_골드배율 × 방식_배율
 * ```
 */
export function ballGold(
	state: GameState,
	typeId: number,
	grade: Grade,
	modeMult: number,
): Decimal {
	return typeValue(state, typeId)
		.mul(gradeDef(grade).goldMult)
		.mul(goldMultiplier(state))
		.mul(modeMult);
}

/** 장착 키캡의 골드 배율. 아무것도 안 꽂았으면 기본값 */
export function equippedGoldMult(state: GameState): number {
	const id = state.run.equippedCapId;
	return id === null ? BARE_GOLD_MULT : keycap(id).goldMult;
}

/** 장착 키캡의 생산 주기(타) */
export function ballPeriod(state: GameState): number {
	const id = state.run.equippedCapId;
	return id === null ? BARE_BALL_PERIOD : keycap(id).ballPeriod;
}

/** 미장착 키캡의 방치 수입 합 (G/s). 오프라인에는 돌지 않는다 */
export function idleIncome(state: GameState): Decimal {
	let sum = 0;
	for (const id of state.meta.caps) {
		if (id === state.run.equippedCapId) continue;
		sum += keycap(id).idleIncome;
	}
	return D(sum).mul(idleMultiplier(state));
}

/**
 * 방식별 기여도로 가중 평균한 골드 배율 (🟢 Q11, 2026-09).
 *
 * 진행률을 절반은 손으로, 절반은 자동으로 올렸으면 배율도 그 비율로 섞인다.
 * 진행이 하나도 없는 상태에서 부순 것(= 즉시 파괴)은 자동 취급이다.
 */
export function breakModeMult(progress: Readonly<Record<BreakMode, number>>): number {
	const total = progress.hold + progress.auto;
	if (total <= 0) return BREAK_MODE_MULT.auto;
	return (progress.hold * BREAK_MODE_MULT.hold + progress.auto * BREAK_MODE_MULT.auto) / total;
}

function dominantMode(progress: Readonly<Record<BreakMode, number>>): BreakMode {
	return progress.hold >= progress.auto && progress.hold > 0 ? "hold" : "auto";
}

/** 보관함 확대 화면에서 "예상 골드"로 보여줄 값. 아직 안 부순 것의 손 파괴 기준 */
export function expectedGold(state: GameState, ball: FieldBall): Decimal {
	return ballGold(state, ball.typeId, ball.grade, BREAK_MODE_MULT.hold);
}

// ─────────────────────────────────────────────────────────────────────────────
// 내부 — 새 상태를 조립하는 자리. 들어온 state 는 건드리지 않는다
// ─────────────────────────────────────────────────────────────────────────────

interface Draft {
	run: RunState;
	meta: MetaState;
	perm: PermanentState;
	events: GameEvent[];
}

function begin(state: GameState): Draft {
	return {
		run: { ...state.run },
		meta: { ...state.meta },
		perm: { ...state.perm, stats: { ...state.perm.stats } },
		events: [],
	};
}

function finish(state: GameState, d: Draft): Step {
	const next: GameState = { version: state.version, run: d.run, meta: d.meta, perm: d.perm };
	const unlocked = collectAchievements(next);
	if (unlocked.length === 0) return { state: next, events: d.events };
	for (const id of unlocked) d.events.push({ type: "achievement", id });
	return {
		state: {
			...next,
			perm: { ...next.perm, achievements: [...next.perm.achievements, ...unlocked] },
		},
		events: d.events,
	};
}

function gainGold(d: Draft, amount: Decimal, source: GoldSource): void {
	if (amount.lte(0)) return;
	d.run.gold = d.run.gold.add(amount);
	d.run.goldEarned = d.run.goldEarned.add(amount);
	const stats = d.perm.stats;
	stats.totalGold = stats.totalGold.add(amount);
	stats.goldBySource = {
		...stats.goldBySource,
		[source]: stats.goldBySource[source].add(amount),
	};
	d.events.push({ type: "gold", amount, source });
}

function deny(state: GameState, reason: DeniedReason): Step {
	return { state, events: [{ type: "denied", reason }] };
}

function recordDex(d: Draft, typeId: number, grade: Grade): void {
	const before = d.meta.dex[typeId] ?? 0;
	const bit = dexBit(grade);
	if ((before & bit) !== 0) return;
	d.meta.dex = { ...d.meta.dex, [typeId]: before | bit };
	d.perm.stats.gradesSeen |= bit;
	d.events.push({ type: "dex_new", typeId, grade, firstOfType: before === 0 });
}

function makeBall(d: Draft, typeId: number, grade: Grade): FieldBall {
	const uid = d.run.nextUid;
	d.run.nextUid = uid + 1;
	return { uid, typeId, grade, progress: { hold: 0, auto: 0 }, holding: false };
}

/**
 * 필드에 넣는다. 꽉 차 있으면 `docs/02-ECONOMY.md` §4 "화면이 뜨는 조건" 을 탄다.
 *
 * ```
 * 자동 파괴 해금 범위인가? ─ 예 ─▶ 화면 없이 자동 파괴 (소리는 난다)
 * "항상 이렇게" 가 있는가?  ─ 예 ─▶ 저장된 선택을 그대로
 * 아니면                        ─▶ 보관함 확대 화면
 * ```
 */
function placeBall(
	state: GameState,
	d: Draft,
	ball: FieldBall,
	source: "keycap" | "roulette",
): void {
	recordDex(d, ball.typeId, ball.grade);
	if (d.run.field.length < fieldSlots(state)) {
		d.run.field = [...d.run.field, ball];
		d.events.push({ type: "ball_spawn", ball, source });
		return;
	}
	if (isAutoBreakable(state, ball.grade)) {
		destroyBall(state, d, ball);
		return;
	}
	switch (d.perm.settings.fieldFullDefault) {
		case "destroyIncoming":
			destroyBall(state, d, ball);
			return;
		case "replaceWeakest":
			applyReplaceWeakest(state, d, ball);
			return;
		case "ask":
			d.run.pending = ball;
			d.events.push({ type: "field_full", incoming: ball });
			return;
	}
}

function weakestIndex(state: GameState, field: readonly FieldBall[]): number {
	let best = 0;
	let bestGold = expectedGold(state, field[0] as FieldBall);
	for (let i = 1; i < field.length; i++) {
		const g = expectedGold(state, field[i] as FieldBall);
		if (g.lt(bestGold)) {
			best = i;
			bestGold = g;
		}
	}
	return best;
}

function applyReplaceWeakest(state: GameState, d: Draft, incoming: FieldBall): void {
	const idx = weakestIndex(state, d.run.field);
	const weakest = d.run.field[idx] as FieldBall;
	// 새로 온 게 더 약하면 바꿔봐야 손해다. 그냥 새 것을 부순다
	if (expectedGold(state, incoming).lte(expectedGold(state, weakest))) {
		destroyBall(state, d, incoming);
		return;
	}
	const next = [...d.run.field];
	next[idx] = incoming;
	d.run.field = next;
	destroyBall(state, d, weakest);
	d.events.push({ type: "ball_spawn", ball: incoming, source: "roulette" });
}

/** 부순다. 필드에서 빼는 건 호출부의 몫이다 (`pending` 인 것도 여기로 온다) */
function destroyBall(state: GameState, d: Draft, ball: FieldBall): void {
	const mult = breakModeMult(ball.progress);
	const mode = dominantMode(ball.progress);
	const gold = ballGold(state, ball.typeId, ball.grade, mult);
	d.events.push({
		type: "ball_shatter",
		uid: ball.uid,
		typeId: ball.typeId,
		grade: ball.grade,
		mode,
		gold,
	});
	if (ball.grade !== "common") {
		d.events.push({ type: "grade_sting", uid: ball.uid, grade: ball.grade });
	}
	gainGold(d, gold, "ball");
	d.run.brokenCount += 1;
	d.run.gradeBonusSum += gradeDef(ball.grade).rebirthBonus;
	d.perm.stats.totalBreaks += 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// 조작 — 키캡
// ─────────────────────────────────────────────────────────────────────────────

/** 키캡 1타. 골드가 나오고 N타마다 왁뿌볼이 나온다 */
export function pressKeycap(state: GameState, rng: Rng): Step {
	const d = begin(state);
	pressOnce(state, d, rng);
	return finish(state, d);
}

function pressOnce(state: GameState, d: Draft, rng: Rng): void {
	d.events.push({ type: "cap_press", capId: d.run.equippedCapId });
	gainGold(
		d,
		D(KEYCAP_BASE_GOLD).mul(equippedGoldMult(state)).mul(goldMultiplier(state)),
		"keycap",
	);
	d.run.capPresses += 1;
	const period = ballPeriod(state);
	while (d.run.capPresses >= period) {
		d.run.capPresses -= period;
		spawnFromKeycap(state, d, rng);
	}
}

/** 키캡이 만드는 왁뿌볼은 **등급이 항상 Common**, 종류는 보유 중 균등이다 */
function spawnFromKeycap(state: GameState, d: Draft, rng: Rng): void {
	const owned = unlockedTypeIds(state);
	if (owned.length === 0) return;
	const typeId = rng.pick(owned);
	placeBall(state, d, makeBall(d, typeId, "common"), "keycap");
}

export function equipKeycap(state: GameState, capId: number | null): Step {
	if (capId !== null && !state.meta.caps.includes(capId)) return deny(state, "locked");
	const d = begin(state);
	d.run.equippedCapId = capId;
	d.run.capPresses = 0;
	return finish(state, d);
}

// ─────────────────────────────────────────────────────────────────────────────
// 조작 — 부수기
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 누르기 시작 / 떼기.
 *
 * ★ **떼도 진행률이 리셋되지 않는다** (`docs/02-ECONOMY.md` "끊어 누르기").
 *   그 자리에 멈추고, 다시 누르면 이어서 간다. 소리는 새로 난다 —
 *   짧게 끊어 누르는 리듬으로 노는 사람이 나오는 게 이 게임의 정체성이다.
 */
export function setHold(state: GameState, uid: number, holding: boolean): Step {
	const idx = state.run.field.findIndex((b) => b.uid === uid);
	if (idx < 0) return deny(state, "invalid");
	const ball = state.run.field[idx] as FieldBall;
	if (ball.holding === holding) return { state, events: [] };
	const d = begin(state);
	const next = [...d.run.field];
	next[idx] = { ...ball, holding };
	d.run.field = next;
	const stage = crackStage(ballProgress(ball), crackStages(state));
	d.events.push(
		holding ? { type: "ball_hold_start", uid, stage } : { type: "ball_hold_stop", uid, stage },
	);
	return finish(state, d);
}

/** 손을 전부 뗀다. 화면 전환이나 포커스 이탈에서 부른다 */
export function releaseAll(state: GameState): Step {
	const d = begin(state);
	let touched = false;
	d.run.field = d.run.field.map((b) => {
		if (!b.holding) return b;
		touched = true;
		d.events.push({
			type: "ball_hold_stop",
			uid: b.uid,
			stage: crackStage(ballProgress(b), crackStages(state)),
		});
		return { ...b, holding: false };
	});
	return touched ? finish(state, d) : { state, events: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// 시간
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `dt` 초를 굴린다. 이 게임에서 시간이 흐르는 유일한 입구다.
 *
 * **오프라인 진행은 없다** (`docs/06-DECISIONS.md`). 창이 안 보이는 동안
 * `tick` 을 부르지 않으면 그대로 멈춘다 — 그게 의도한 동작이다.
 */
export function tick(state: GameState, dt: number, rng: Rng): Step {
	if (dt <= 0) return { state, events: [] };
	const d = begin(state);
	d.perm.stats.playSeconds += dt;

	gainGold(d, idleIncome(state).mul(dt), "idle");
	tickAutoKeycap(state, d, dt, rng);
	tickField(state, d, dt);
	tickAutoRoulette(state, d, dt, rng);

	return finish(state, d);
}

function tickAutoKeycap(state: GameState, d: Draft, dt: number, rng: Rng): void {
	if (skillLevel(state, `${AUTO_PREFIX}keycap`) < 1 || !d.perm.settings.autoKeycap) return;
	d.run.autoPressAcc += dt * AUTO_KEYCAP_PPS;
	const presses = Math.floor(d.run.autoPressAcc);
	if (presses <= 0) return;
	d.run.autoPressAcc -= presses;
	for (let i = 0; i < presses; i++) pressOnce(state, d, rng);
}

function tickField(state: GameState, d: Draft, dt: number): void {
	if (d.run.field.length === 0) return;
	const auto = autoBreakGrades(state);
	const stages = crackStages(state);
	const survivors: FieldBall[] = [];
	for (const ball of d.run.field) {
		const before = ballProgress(ball);
		const speed = 1 / breakSecondsFor(state, ball.grade);
		let hold = ball.progress.hold;
		let autoP = ball.progress.auto;
		if (ball.holding) hold += dt * speed;
		if (auto.includes(ball.grade)) autoP += dt * speed;
		if (hold === ball.progress.hold && autoP === ball.progress.auto) {
			survivors.push(ball);
			continue;
		}
		const mode: BreakMode = ball.holding ? "hold" : "auto";
		const after = Math.min(1, hold + autoP);
		const next: FieldBall = { ...ball, progress: { hold, auto: autoP } };
		emitCracks(d, next, before, after, mode, stages);
		if (after >= 1) {
			destroyBall(state, d, next);
			continue;
		}
		survivors.push(next);
	}
	d.run.field = survivors;
}

/**
 * 넘어간 균열 단계를 전부 뱉는다.
 *
 * 단계는 **진행률**로 계산한다 — 부수기 효율이 시간을 줄여도 연출이 깨지지
 * 않는다 (`docs/02-ECONOMY.md` "균열 단계"). 100% 는 마지막 구간의 끝이라
 * 균열이 아니라 **파괴**다. 그래서 경계는 `1 ~ stages-1` 까지만 울린다.
 */
function emitCracks(
	d: Draft,
	ball: FieldBall,
	before: number,
	after: number,
	mode: BreakMode,
	stages: number,
): void {
	const from = crackStage(before, stages);
	const to = Math.min(crackStage(after, stages), stages - 1);
	for (let stage = from + 1; stage <= to; stage++) {
		d.events.push({
			type: "ball_crack",
			uid: ball.uid,
			typeId: ball.typeId,
			grade: ball.grade,
			stage,
			stages,
			mode,
		});
	}
}

function tickAutoRoulette(state: GameState, d: Draft, dt: number, rng: Rng): void {
	if (skillLevel(state, `${AUTO_PREFIX}roulette`) < 1 || !d.perm.settings.autoRoulette) return;
	d.run.autoRollTimer += dt;
	while (d.run.autoRollTimer >= AUTO_ROULETTE_INTERVAL) {
		d.run.autoRollTimer -= AUTO_ROULETTE_INTERVAL;
		const cost = D(COST_BASE).mul(Decimal.pow(COST_GROWTH, d.run.rouletteCount));
		if (d.run.gold.lt(cost.mul(AUTO_ROULETTE_MARGIN))) return;
		rollInto(state, d, rng);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// 조작 — 보관함 확대 화면
// ─────────────────────────────────────────────────────────────────────────────

export type FieldFullChoice =
	/** 필드의 `uid` 를 부수고 그 자리에 새 것을 넣는다 */
	| { kind: "replace"; uid: number }
	/** 새로 얻은 것을 그 자리에서 부순다 */
	| { kind: "destroy" };

/**
 * 확대 화면의 선택을 적용한다.
 * `remember` 가 true 면 같은 선택을 "항상 이렇게"로 저장한다 (🟢 Q5 — 전체 통일).
 */
export function resolveFieldFull(
	state: GameState,
	choice: FieldFullChoice,
	remember = false,
): Step {
	const incoming = state.run.pending;
	if (!incoming) return deny(state, "invalid");
	const d = begin(state);
	d.run.pending = null;
	if (remember) {
		d.perm.settings = {
			...d.perm.settings,
			fieldFullDefault: choice.kind === "destroy" ? "destroyIncoming" : "replaceWeakest",
		};
	}
	if (choice.kind === "destroy") {
		destroyBall(state, d, incoming);
		return finish(state, d);
	}
	const idx = d.run.field.findIndex((b) => b.uid === choice.uid);
	if (idx < 0) return deny(state, "invalid");
	const victim = d.run.field[idx] as FieldBall;
	const next = [...d.run.field];
	next[idx] = incoming;
	d.run.field = next;
	destroyBall(state, d, victim);
	d.events.push({ type: "ball_spawn", ball: incoming, source: "roulette" });
	return finish(state, d);
}

// ─────────────────────────────────────────────────────────────────────────────
// 조작 — 룰렛
// ─────────────────────────────────────────────────────────────────────────────

export function roll(state: GameState, rng: Rng): Step {
	const cost = rouletteCost(state);
	if (state.run.gold.lt(cost)) return deny(state, "gold");
	const d = begin(state);
	rollInto(state, d, rng);
	return finish(state, d);
}

function rollInto(state: GameState, d: Draft, rng: Rng): void {
	const cost = D(COST_BASE).mul(Decimal.pow(COST_GROWTH, d.run.rouletteCount));
	if (d.run.gold.lt(cost)) return;
	d.run.gold = d.run.gold.sub(cost);
	d.run.rouletteCount += 1;
	d.perm.stats.totalRolls += 1;
	d.events.push({ type: "roulette_roll", cost, count: d.run.rouletteCount });

	const weights = OUTCOME_ORDER.map((o) =>
		o === "type" ? typeSlotWeight(state) : OUTCOME_WEIGHTS[o],
	);
	const outcome = OUTCOME_ORDER[rng.weighted(weights)] as (typeof OUTCOME_ORDER)[number];

	switch (outcome) {
		case "ball": {
			const grade = gradeAt(rng.weighted(tilt(BALL_GRADE_WEIGHTS, state, "gradeOdds")));
			const owned = unlockedTypeIds(state);
			d.events.push({ type: "roulette_result", outcome, grade });
			if (owned.length > 0) placeBall(state, d, makeBall(d, rng.pick(owned), grade), "roulette");
			return;
		}
		case "fragment": {
			const grade = gradeAt(rng.weighted(tilt(FRAGMENT_GRADE_WEIGHTS, state, "fragOdds")));
			d.events.push({ type: "roulette_result", outcome, grade });
			gainFragments(state, d, grade, FRAGMENTS_PER_HIT, rng);
			return;
		}
		case "type": {
			d.events.push({ type: "roulette_result", outcome, grade: null });
			resolveTypeSlot(state, d, rng);
			return;
		}
		case "fail": {
			d.perm.stats.rouletteFails += 1;
			d.events.push({ type: "roulette_result", outcome, grade: null });
			d.events.push({ type: "roulette_fail" });
			return;
		}
	}
}

/** "종류 발견율" 이 종류 슬롯 확률을 올린다 */
function typeSlotWeight(state: GameState): number {
	const node = skillNode("discoveryRate");
	return OUTCOME_WEIGHTS.type + skillLevel(state, node.id) * node.perLevel;
}

/** 상위 등급 가중치를 레벨만큼 기울인다. 등급이 높을수록 크게 먹는다 */
function tilt(weights: readonly number[], state: GameState, nodeId: string): number[] {
	const node = skillNode(nodeId);
	const level = skillLevel(state, nodeId);
	if (level === 0) return [...weights];
	return weights.map((w, i) => w * node.perLevel ** (level * i));
}

/**
 * 종류 슬롯.
 *
 * ```
 * 신규 해금 : 희귀도 추첨(★ 비율) → 그 희귀도의 미보유 중 균등
 * 레벨업    : 희귀도 무관, 보유 중 균등 랜덤
 * ```
 * **해금만 희귀도를 탄다. 신규 우선은 없다.**
 */
function resolveTypeSlot(state: GameState, d: Draft, rng: Rng): void {
	const owned = new Set(unlockedTypeIds(state));
	const missing = BALL_TYPES.filter((b) => !owned.has(b.id));
	if (missing.length > 0 && rng.next() < NEW_UNLOCK_SHARE) {
		// 미보유가 남아 있는 희귀도만 추첨에 넣는다
		const weights = RARITIES.map((r) =>
			missing.some((b) => b.rarity === r) ? (RARITY_UNLOCK_WEIGHTS[r - 1] as number) : 0,
		);
		const rarity = RARITIES[rng.weighted(weights)] as Rarity;
		const pool = missing.filter((b) => b.rarity === rarity);
		const pick = rng.pick(pool);
		d.meta.types = { ...d.meta.types, [pick.id]: 1 };
		d.events.push({ type: "type_unlock", typeId: pick.id, rarity });
		return;
	}
	const ids = [...owned];
	if (ids.length === 0) return;
	const typeId = rng.pick(ids);
	const level = (d.meta.types[typeId] ?? 1) + 1;
	d.meta.types = { ...d.meta.types, [typeId]: level };
	d.perm.stats.maxTypeLevel = Math.max(d.perm.stats.maxTypeLevel, level);
	d.events.push({ type: "type_levelup", typeId, level });
}

/**
 * 조각을 넣고, 찰 때마다 키캡을 완성한다.
 * 그 등급을 이미 다 모았으면 골드로 환급된다 (`docs/02-ECONOMY.md` "중복 환급").
 */
function gainFragments(state: GameState, d: Draft, grade: Grade, count: number, rng: Rng): void {
	const total = (d.meta.fragments[grade] ?? 0) + count;
	d.meta.fragments = { ...d.meta.fragments, [grade]: total };
	d.events.push({ type: "frag_get", grade, count, total });

	const band = keycapBand(grade);
	while ((d.meta.fragments[grade] ?? 0) >= band.fragments) {
		const left = (d.meta.fragments[grade] ?? 0) - band.fragments;
		d.meta.fragments = { ...d.meta.fragments, [grade]: left };
		const unowned = keycapsOfGrade(grade).filter((c) => !d.meta.caps.includes(c.id));
		if (unowned.length === 0) {
			gainGold(d, D(band.refund).mul(goldMultiplier(state)), "refund");
			d.events.push({
				type: "cap_refund",
				capId: keycapsOfGrade(grade)[0]?.id ?? 0,
				grade,
				gold: D(band.refund),
			});
			continue;
		}
		const cap = rng.pick(unowned);
		d.meta.caps = [...d.meta.caps, cap.id];
		d.events.push({ type: "cap_complete", capId: cap.id, grade });
		// 아무것도 안 꽂혀 있으면 바로 꽂아준다. 첫 키캡을 그냥 서랍에 두면 손해다
		if (d.run.equippedCapId === null) {
			d.run.equippedCapId = cap.id;
			d.run.capPresses = 0;
		}
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// 조작 — 환생 / 스킬 / 설정
// ─────────────────────────────────────────────────────────────────────────────

/** `환생재화 = 계수 × √(이번 판 누적 골드) × 등급보정_평균` */
export function rebirthGain(state: GameState): Decimal {
	const avg = state.run.brokenCount > 0 ? state.run.gradeBonusSum / state.run.brokenCount : 1;
	return D(Math.sqrt(state.run.goldEarned.toNumber() || 0))
		.mul(REBIRTH_COEFF)
		.mul(avg);
}

export function rebirth(state: GameState): Step {
	const gained = rebirthGain(state);
	if (gained.lte(0)) return deny(state, "invalid");
	const d = begin(state);
	d.meta.rebirthCurrency = d.meta.rebirthCurrency.add(gained);
	d.perm.stats.totalRebirths += 1;
	const seed = startingGold(state);
	d.run = freshRun(seed);
	// ★ 시작 골드는 **수입이 아니라 지급이다.**
	//   `totalGold`(전 회차 누적 획득)에는 넣지만 `goldEarned`(이번 판 수입)에는
	//   넣지 않는다. 넣으면 환생재화가 자기 자신을 먹여서 발산한다.
	//   `goldBySource` 는 수입 출처 비율이라 여기에도 넣지 않는다.
	d.perm.stats.totalGold = d.perm.stats.totalGold.add(seed);
	d.events.push({ type: "rebirth", gained, count: d.perm.stats.totalRebirths });
	return finish(state, d);
}

/** 환생 직후 지급 골드. 노드가 없으면 0 */
export function startingGold(state: GameState): Decimal {
	const node = skillNode("startingGold");
	const level = skillLevel(state, node.id);
	return level === 0 ? ZERO : D(node.perLevel).pow(level).mul(COST_BASE);
}

export function buySkill(state: GameState, nodeId: string): Step {
	const node = skillNode(nodeId);
	const level = skillLevel(state, nodeId);
	if (level >= node.maxLevel) return deny(state, "maxLevel");
	const cost = skillCost(state, nodeId);
	if (state.meta.rebirthCurrency.lt(cost)) return deny(state, "currency");
	const d = begin(state);
	d.meta.rebirthCurrency = d.meta.rebirthCurrency.sub(cost);
	d.meta.skills = { ...d.meta.skills, [nodeId]: level + 1 };
	d.events.push({ type: "skill_buy", nodeId, level: level + 1 });
	return finish(state, d);
}

/** 설정 변경. `GameState` 는 B 가 직접 쓰지 않으므로 화면도 이 문을 지난다 */
export function updateSettings(state: GameState, patch: Partial<Settings>): GameState {
	return {
		...state,
		perm: { ...state.perm, settings: { ...state.perm.settings, ...patch } },
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// 업적
// ─────────────────────────────────────────────────────────────────────────────

/** 조건을 만족했지만 아직 해금되지 않은 업적 id (`docs/07-ACHIEVEMENTS.md`) */
export function checkAchievements(state: GameState): string[] {
	return collectAchievements(state);
}

function collectAchievements(state: GameState): string[] {
	const done = new Set(state.perm.achievements);
	const out: string[] = [];
	for (const a of ACHIEVEMENTS) {
		if (done.has(a.id)) continue;
		if (meets(state, a)) out.push(a.id);
	}
	return out;
}

function meets(state: GameState, a: Achievement): boolean {
	return satisfied(state, a.condition);
}

function satisfied(state: GameState, c: AchievementCondition): boolean {
	const stats = state.perm.stats;
	switch (c.kind) {
		case "totalBreaks":
			return stats.totalBreaks >= c.value;
		case "totalRolls":
			return stats.totalRolls >= c.value;
		case "capsOwned":
			return state.meta.caps.length >= c.value;
		case "capGrade":
			return state.meta.caps.some((id) => keycap(id).grade === c.grade);
		case "rebirths":
			return stats.totalRebirths >= c.value;
		case "typesUnlocked":
			return Object.keys(state.meta.types).length >= c.value;
		case "gradeSeen":
			return (stats.gradesSeen & dexBit(c.grade)) !== 0;
		case "allOfRarity":
			return BALL_TYPES.filter((b) => b.rarity === c.rarity).every(
				(b) => (state.meta.types[b.id] ?? 0) > 0,
			);
		case "dexFullRow": {
			const full = (1 << GRADES.length) - 1;
			return Object.values(state.meta.dex).some((bits) => bits === full);
		}
		case "rouletteFails":
			return stats.rouletteFails >= c.value;
		case "typeLevel":
			return stats.maxTypeLevel >= c.value;
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// 화면과 리포트가 쓰는 요약
// ─────────────────────────────────────────────────────────────────────────────

export function unlockedTypeCount(state: GameState): number {
	return Object.keys(state.meta.types).length;
}

export function dexDots(state: GameState): number {
	let sum = 0;
	for (const bits of Object.values(state.meta.dex)) {
		for (let i = 0; i < GRADES.length; i++) if ((bits & (1 << i)) !== 0) sum++;
	}
	return sum;
}

export { gradeIndex, KEYCAPS };
