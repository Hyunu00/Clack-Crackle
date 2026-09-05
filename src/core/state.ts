/**
 * 상태와 이벤트 — **레인 A 와 레인 B 의 유일한 접점이다** (`docs/11-WORKSTREAMS.md`).
 *
 * ```
 * GameState   B 가 읽고 그린다. B 는 절대 쓰지 않는다
 * GameEvent   A 가 뱉고 B 가 구독한다. 소리와 연출이 전부 여기 달린다
 * ```
 *
 * 여기서 이벤트 하나가 빠지면 **B 는 그 소리를 영원히 못 낸다.**
 * 아래 `GameEvent` 에 `docs/04-AUDIO.md` 사운드 목록과의 대조표가 있다.
 *
 * 상태는 3층이다 (`docs/02-ECONOMY.md` "2차 환생 여지"). 2차 환생은 구현하지
 * 않지만 자리를 지금 만들어 둔다 — 나중에 만들면 세이브 마이그레이션이 붙는다.
 */

import type { Decimal } from "./numbers";

/** 세이브 스키마 버전. 층 구조나 필드 의미가 바뀌면 올리고 `save.ts` 에 마이그레이션을 붙인다 */
export const SAVE_VERSION = 1;

// ─────────────────────────────────────────────────────────────────────────────
// 두 개의 축 — 혼동하지 말 것 (`CLAUDE.md` "두 개의 축을 혼동하지 말 것")
// ─────────────────────────────────────────────────────────────────────────────

/** 개체 등급. 이번에 나온 왁뿌볼이 뭐냐. **매번 랜덤이다** */
export type Grade = "common" | "rare" | "epic" | "legendary" | "supreme";

/** 낮은 것부터. 배열 순서가 곧 등급 순서이고 도감 비트 자리이기도 하다 */
export const GRADES = ["common", "rare", "epic", "legendary", "supreme"] as const;

/** 종류 희귀도. 그 종류를 해금하기 어려운 정도. **고정이다** */
export type Rarity = 1 | 2 | 3 | 4 | 5;

export const RARITIES = [1, 2, 3, 4, 5] as const;

export function gradeIndex(grade: Grade): number {
	return GRADES.indexOf(grade);
}

/** 도감 한 칸의 비트. `dex[typeId] & dexBit("epic")` 이면 그 등급을 본 적 있다 */
export function dexBit(grade: Grade): number {
	return 1 << gradeIndex(grade);
}

// ─────────────────────────────────────────────────────────────────────────────
// 필드
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 부수는 방식.
 *
 * ★ **연타는 없다** (2026-09 오너 결정 — `docs/06-DECISIONS.md` "부수기는 꾹 누르기 전용").
 *   꾹 누르거나 끊어 누르거나 자동이다. 셋 다 같은 진행률 하나를 올린다.
 */
export type BreakMode = "hold" | "auto";

export const BREAK_MODES = ["hold", "auto"] as const;

export interface FieldBall {
	uid: number;
	typeId: number;
	grade: Grade;
	/**
	 * 방식별 누적 진행률. 합이 0~1 이고 **손을 떼도 줄지 않는다**
	 * (`docs/02-ECONOMY.md` "끊어 누르기"). 골드 배율을 방식별 기여도로
	 * 가중 평균하기 위해 나눠서 들고 있다.
	 */
	progress: Readonly<Record<BreakMode, number>>;
	/** 지금 누르고 있는가. `tick` 이 이걸 보고 진행률을 올린다 */
	holding: boolean;
}

export function ballProgress(ball: FieldBall): number {
	return ball.progress.hold + ball.progress.auto;
}

/**
 * 진행률 0~1 위의 균열 단계 (`docs/02-ECONOMY.md` "균열 단계").
 *
 * ★ `stages` 는 **구간 수**다. 마지막 구간의 끝(100%)이 파괴이므로
 *   균열음이 나는 경계는 `1 ~ stages-1` 이다. 기본 4면 25/50/75% 에서 울린다.
 *   단계를 시간이나 클릭이 아니라 **진행률로** 계산하는 이유는
 *   부수기 효율 스킬이 시간을 줄여도 연출이 안 깨지게 하기 위해서다.
 */
export function crackStage(progress: number, stages: number): number {
	return Math.min(stages, Math.floor(progress * stages));
}

// ─────────────────────────────────────────────────────────────────────────────
// 1층 — 환생하면 리셋된다
// ─────────────────────────────────────────────────────────────────────────────

export interface RunState {
	gold: Decimal;
	/** 이번 판에 번 골드 누적. 환생재화 공식의 입력이다 */
	goldEarned: Decimal;
	field: readonly FieldBall[];
	equippedCapId: number | null;
	/** 룰렛 비용 곡선의 지수. 환생하면 리셋된다 — 이게 환생 타이밍을 만든다 */
	rouletteCount: number;
	/** 장착 키캡의 생산 주기 카운터 */
	capPresses: number;
	/** 자동 키캡이 굴리는 소수점 타수. 한 타가 찰 때마다 `capPresses` 로 넘어간다 */
	autoPressAcc: number;
	/** 자동 룰렛의 대기 타이머(초) */
	autoRollTimer: number;
	/** 이번 판에 부순 개수와 등급보정 합. 환생재화의 `등급보정_평균` 을 낸다 */
	brokenCount: number;
	gradeBonusSum: number;
	/** 필드가 꽉 찬 상태로 들어온 왁뿌볼. 플레이어가 고를 때까지 여기 머문다 */
	pending: FieldBall | null;
	nextUid: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2층 — 지금은 유지된다. 나중에 2차 환생을 넣으면 이 층이 리셋 대상이다
// ─────────────────────────────────────────────────────────────────────────────

export interface MetaState {
	rebirthCurrency: Decimal;
	/** 스킬 노드 id → 레벨. 없으면 0 */
	skills: Readonly<Record<string, number>>;
	/** 보유 키캡 id */
	caps: readonly number[];
	/** 등급별 조각. 조각은 등급 안에서 공용이다 */
	fragments: Readonly<Record<Grade, number>>;
	/** 종류 id → 레벨. 1 이상이면 보유, 없으면 미보유 */
	types: Readonly<Record<number, number>>;
	/** 종류 id → 본 등급 비트마스크. 도감 50칸 × 등급 점 5개 */
	dex: Readonly<Record<number, number>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3층 — 영구. 2차 환생에도 살아남는다
// ─────────────────────────────────────────────────────────────────────────────

/** 골드가 어디서 들어왔는가. sim 의 감시 지표 2번이 이 비율을 본다 */
export type GoldSource = "keycap" | "ball" | "idle" | "refund";

export const GOLD_SOURCES = ["keycap", "ball", "idle", "refund"] as const;

export interface Stats {
	playSeconds: number;
	totalBreaks: number;
	totalRolls: number;
	totalRebirths: number;
	/** 전 회차 누적 획득 골드 */
	totalGold: Decimal;
	goldBySource: Readonly<Record<GoldSource, Decimal>>;
	/** 지금까지 본 등급 비트마스크. 업적 `GRADE_*` 판정 */
	gradesSeen: number;
	/** 가장 높이 올린 종류 레벨. 업적 `TYPE_LV10` 판정 */
	maxTypeLevel: number;
	/** 꽝을 뽑은 횟수. 업적 `BAD_LUCK` 판정 */
	rouletteFails: number;
}

/**
 * 필드가 꽉 찼을 때 어떻게 할지 (`docs/02-ECONOMY.md` §4 "화면이 뜨는 조건").
 *
 * ★ **전체 하나로 통일한다** (2026-09 오너 결정 — Q5). 등급별로 나누지 않는다.
 */
export type FieldFullDefault =
	/** 매번 보관함 확대 화면을 띄운다 */
	| "ask"
	/** 예상 골드가 가장 낮은 필드 왁뿌볼과 교체한다. 새 것이 더 낮으면 새 것을 부순다 */
	| "replaceWeakest"
	/** 새로 들어온 것을 그 자리에서 부순다 */
	| "destroyIncoming";

export interface Settings {
	fieldFullDefault: FieldFullDefault;
	/**
	 * 균열 단계 수 3 / 4 / 5. 기본 4 (`docs/02-ECONOMY.md` "균열 단계").
	 *
	 * ★ **감각 설정이지 밸런스 설정이 아니다.** 이걸 바꿔도 파괴 시간과 골드는
	 *   변하지 않는다. 소리와 그림의 밀도만 바뀐다 — 이득이 생기면 설정이
	 *   아니라 공략이 된다.
	 */
	crackStages: number;
	/**
	 * 자동 파괴 전체 스위치. 해금했어도 끌 수 있다 —
	 * "오늘은 다 손으로 깨고 싶다" 가 가능해야 한다 (`docs/02-ECONOMY.md` §8)
	 */
	autoBreak: boolean;
	autoKeycap: boolean;
	autoRoulette: boolean;
	/** 볼륨은 영구층 데이터라 여기 있다. 실제 재생은 레인 B 가 한다 */
	volumeMaster: number;
	volumeSfx: number;
	volumeBgm: number;
	/** ASMR 게임이라 BGM 은 기본 꺼짐 (`docs/04-AUDIO.md`) */
	bgmEnabled: boolean;
	/** 청각 대체 경로 (`docs/04-AUDIO.md` 접근성) */
	flashOnBreak: boolean;
	/** `null` 이면 시스템 언어를 따라간다 */
	locale: string | null;
}

export interface PermanentState {
	stats: Stats;
	/** 해금된 업적 id (`docs/07-ACHIEVEMENTS.md`) */
	achievements: readonly string[];
	settings: Settings;
}

// ─────────────────────────────────────────────────────────────────────────────

export interface GameState {
	version: number;
	run: RunState;
	meta: MetaState;
	perm: PermanentState;
}

// ─────────────────────────────────────────────────────────────────────────────
// GameEvent — 레인 B 와의 계약
// ─────────────────────────────────────────────────────────────────────────────

export type DeniedReason =
	/** 골드가 모자란다 */
	| "gold"
	/** 환생재화가 모자란다 */
	| "currency"
	/** 이미 최대 레벨 */
	| "maxLevel"
	/** 선행 조건 미충족 */
	| "locked"
	/** 지금 할 수 없는 조작 */
	| "invalid";

export type RouletteOutcome = "ball" | "fragment" | "type" | "fail";

/**
 * `docs/04-AUDIO.md` 사운드 17종 대조표.
 *
 * ```
 * cap_press              → cap_press
 * ball_crack_1~5         → ball_crack   (stage 1 ~ stages-1)
 * ball_shatter_<종류>     → ball_shatter (typeId)
 * ball_spawn             → ball_spawn
 * coin                   → gold
 * sting_rare~supreme     → grade_sting
 * roulette_roll          → roulette_roll
 * roulette_result_<등급>  → roulette_result (grade)
 * roulette_fail          → roulette_fail
 * type_unlock            → type_unlock
 * type_levelup           → type_levelup
 * frag_get               → frag_get
 * cap_complete           → cap_complete
 * dex_new                → dex_new
 * rebirth                → rebirth
 * skill_buy              → skill_buy
 * ui_denied              → denied
 * field_full             → field_full
 * ```
 *
 * `ball_crack` 은 **구간 수가 설정값**이다 (기본 4, 3~5). 이벤트가 `stage` 와
 * `stages` 를 같이 실어 보내므로 **어느 오버레이·음원을 쓸지는 레인 B 가 정한다** —
 * "N 이 5보다 작으면 그중 골라 쓰고 마지막은 항상 5번" 규칙이 B 쪽 매핑이다
 * (`docs/02-ECONOMY.md` "균열 단계").
 *
 * 사운드 목록에는 없지만 계약에 있는 것:
 * - `ball_hold_start` / `ball_hold_stop` — 끊어 누르기 (`docs/04-AUDIO.md`
 *   "뗄 때 페이드아웃 / 다시 누를 때 소리가 새로 난다"). 이게 없으면
 *   **끊어 누르는 리듬 놀이가 죽는다.**
 * - `cap_refund` — 중복 키캡 환급. 조각이 아니라 골드가 들어온다
 * - `achievement` — 업적 해금. `platform().unlockAchievement(id)` 로 나간다
 */
export type GameEvent =
	// ── 키캡 ──────────────────────────────────────────────────────────────────
	| { type: "cap_press"; capId: number | null }
	| { type: "gold"; amount: Decimal; source: GoldSource }
	// ── 왁뿌볼 ────────────────────────────────────────────────────────────────
	| { type: "ball_spawn"; ball: FieldBall; source: "keycap" | "roulette" }
	| { type: "ball_hold_start"; uid: number; stage: number }
	| { type: "ball_hold_stop"; uid: number; stage: number }
	| {
			type: "ball_crack";
			uid: number;
			typeId: number;
			grade: Grade;
			/** 1 ~ `stages`-1. 진행률 간격이고 **시간이나 클릭이 아니다** */
			stage: number;
			/** 이번 판정에 쓰인 총 구간 수 (설정값). 오버레이·음원 매핑은 B 가 정한다 */
			stages: number;
			mode: BreakMode;
	  }
	| {
			type: "ball_shatter";
			uid: number;
			typeId: number;
			grade: Grade;
			/** 기여도가 가장 큰 방식. 자동이면 볼륨을 낮춘다 (`docs/04-AUDIO.md` 5번) */
			mode: BreakMode;
			gold: Decimal;
	  }
	| { type: "grade_sting"; uid: number; grade: Exclude<Grade, "common"> }
	| { type: "field_full"; incoming: FieldBall }
	// ── 룰렛 ──────────────────────────────────────────────────────────────────
	| { type: "roulette_roll"; cost: Decimal; count: number }
	| { type: "roulette_result"; outcome: RouletteOutcome; grade: Grade | null }
	| { type: "roulette_fail" }
	| { type: "frag_get"; grade: Grade; count: number; total: number }
	| { type: "cap_complete"; capId: number; grade: Grade }
	| { type: "cap_refund"; capId: number; grade: Grade; gold: Decimal }
	| { type: "type_unlock"; typeId: number; rarity: Rarity }
	| { type: "type_levelup"; typeId: number; level: number }
	| { type: "dex_new"; typeId: number; grade: Grade; firstOfType: boolean }
	// ── 성장 ──────────────────────────────────────────────────────────────────
	| { type: "rebirth"; gained: Decimal; count: number }
	| { type: "skill_buy"; nodeId: string; level: number }
	| { type: "achievement"; id: string }
	| { type: "denied"; reason: DeniedReason };

/** 엔진 함수의 공통 반환. 상태는 새로 만들고 그 사이 일어난 일을 이벤트로 뱉는다 */
export interface Step {
	state: GameState;
	events: readonly GameEvent[];
}
