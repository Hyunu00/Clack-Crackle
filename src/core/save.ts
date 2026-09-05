/**
 * 세이브 — 직렬화 + 버전 마이그레이션.
 *
 * ★ **인크리멘탈에서 세이브 손실은 치명적이다.** 수십 시간이 증발한다
 *   (`docs/09-DEV-ENV.md` ④). 그래서 두 가지를 지킨다:
 *
 *   1. 읽을 때 모르는 필드는 무시하고, 없는 필드는 기본값으로 채운다.
 *      옛 세이브가 **절대 예외로 죽지 않게** 한다
 *   2. 버전별 픽스처를 `tests/fixtures/` 에 남기고
 *      `tests/save-migration.test.ts` 가 매번 로드해 본다
 *
 * `Decimal` 은 JSON 에 문자열로 나간다. 숫자로 쓰면 `1e308` 에서 죽는다.
 */

import { D, type Decimal, ZERO } from "./numbers";
import {
	type FieldBall,
	type GameState,
	GOLD_SOURCES,
	type GoldSource,
	GRADES,
	type Grade,
	SAVE_VERSION,
	type Settings,
} from "./state";

/** 세이브 파일의 날것. 마이그레이션은 이 모양 위에서 돈다 */
export type RawSave = Record<string, unknown>;

export type Migration = (raw: RawSave) => RawSave;

/**
 * `버전 N` 세이브를 `버전 N+1` 로 올린다.
 *
 * 지금은 비어 있다 — v1 이 첫 버전이라 올릴 게 없다.
 * 3층 구조와 2차 환생 여지 때문에 **버전은 반드시 올라간다.** 그때
 * `MIGRATIONS[1] = (raw) => ...` 를 넣고 `SAVE_VERSION` 을 2로 올린다.
 * 옛 픽스처는 지우지 말 것 — 그게 회귀 테스트다.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

// ─────────────────────────────────────────────────────────────────────────────

export function serialize(state: GameState): string {
	return JSON.stringify(toRaw(state));
}

export function toRaw(state: GameState): RawSave {
	const { run, meta, perm } = state;
	return {
		version: SAVE_VERSION,
		run: {
			gold: run.gold.toString(),
			goldEarned: run.goldEarned.toString(),
			field: run.field.map(rawBall),
			equippedCapId: run.equippedCapId,
			rouletteCount: run.rouletteCount,
			capPresses: run.capPresses,
			autoPressAcc: run.autoPressAcc,
			autoRollTimer: run.autoRollTimer,
			brokenCount: run.brokenCount,
			gradeBonusSum: run.gradeBonusSum,
			pending: run.pending ? rawBall(run.pending) : null,
			nextUid: run.nextUid,
		},
		meta: {
			rebirthCurrency: meta.rebirthCurrency.toString(),
			skills: { ...meta.skills },
			caps: [...meta.caps],
			fragments: { ...meta.fragments },
			types: { ...meta.types },
			dex: { ...meta.dex },
		},
		perm: {
			stats: {
				...perm.stats,
				totalGold: perm.stats.totalGold.toString(),
				goldBySource: mapValues(perm.stats.goldBySource, (v) => v.toString()),
			},
			achievements: [...perm.achievements],
			settings: { ...perm.settings },
		},
	};
}

function rawBall(b: FieldBall): RawSave {
	return {
		uid: b.uid,
		typeId: b.typeId,
		grade: b.grade,
		progress: { hold: b.progress.hold, auto: b.progress.auto },
		// `holding` 은 저장하지 않는다. 세이브를 불러온 순간 손은 떼져 있다
	};
}

function mapValues<T, U>(obj: Readonly<Record<string, T>>, fn: (v: T) => U): Record<string, U> {
	const out: Record<string, U> = {};
	for (const [k, v] of Object.entries(obj)) out[k] = fn(v);
	return out;
}

// ─────────────────────────────────────────────────────────────────────────────

/** 문자열 → 상태. 깨진 세이브는 예외 대신 기본값으로 메운다 */
export function deserialize(json: string, fallback: GameState): GameState {
	let raw: RawSave;
	try {
		raw = JSON.parse(json) as RawSave;
	} catch {
		console.warn("[save] 세이브를 읽지 못했다. 새 상태로 시작한다");
		return fallback;
	}
	return fromRaw(raw, fallback);
}

export function fromRaw(input: RawSave, fallback: GameState): GameState {
	const raw = migrate(input);
	const run = obj(raw.run);
	const meta = obj(raw.meta);
	const perm = obj(raw.perm);
	const stats = obj(perm.stats);

	return {
		version: SAVE_VERSION,
		run: {
			gold: dec(run.gold),
			goldEarned: dec(run.goldEarned),
			field: arr(run.field).map(readBall),
			equippedCapId: typeof run.equippedCapId === "number" ? run.equippedCapId : null,
			rouletteCount: num(run.rouletteCount),
			capPresses: num(run.capPresses),
			autoPressAcc: num(run.autoPressAcc),
			autoRollTimer: num(run.autoRollTimer),
			brokenCount: num(run.brokenCount),
			gradeBonusSum: num(run.gradeBonusSum),
			pending: run.pending ? readBall(run.pending) : null,
			nextUid: Math.max(1, num(run.nextUid)),
		},
		meta: {
			rebirthCurrency: dec(meta.rebirthCurrency),
			skills: numberMap(meta.skills),
			caps: arr(meta.caps).map(num),
			fragments: gradeMap(meta.fragments),
			types: numberMap(meta.types),
			dex: numberMap(meta.dex),
		},
		perm: {
			stats: {
				playSeconds: num(stats.playSeconds),
				totalBreaks: num(stats.totalBreaks),
				totalRolls: num(stats.totalRolls),
				totalRebirths: num(stats.totalRebirths),
				totalGold: dec(stats.totalGold),
				goldBySource: sourceMap(stats.goldBySource),
				gradesSeen: num(stats.gradesSeen),
				maxTypeLevel: Math.max(1, num(stats.maxTypeLevel)),
				rouletteFails: num(stats.rouletteFails),
			},
			achievements: arr(perm.achievements).filter((v): v is string => typeof v === "string"),
			settings: readSettings(perm.settings, fallback.perm.settings),
		},
	};
}

/** 옛 버전이면 한 단계씩 올린다. 미래 버전 세이브는 손대지 않고 그대로 읽는다 */
export function migrate(raw: RawSave): RawSave {
	let out = raw;
	let version = num(out.version);
	while (version < SAVE_VERSION) {
		const step = MIGRATIONS[version];
		if (!step) {
			console.warn(`[save] v${version} → v${version + 1} 마이그레이션이 없다. 그대로 읽는다`);
			break;
		}
		out = step(out);
		version += 1;
	}
	return out;
}

function readBall(value: unknown): FieldBall {
	const b = obj(value);
	const p = obj(b.progress);
	return {
		uid: num(b.uid),
		typeId: num(b.typeId),
		grade: grade(b.grade),
		progress: { hold: num(p.hold), auto: num(p.auto) },
		holding: false,
	};
}

function readSettings(value: unknown, fallback: Settings): Settings {
	const s = obj(value);
	const pick = <K extends keyof Settings>(key: K): Settings[K] =>
		s[key] === undefined ? fallback[key] : (s[key] as Settings[K]);
	return {
		fieldFullDefault: pick("fieldFullDefault"),
		crackStages: pick("crackStages"),
		autoBreak: pick("autoBreak"),
		autoKeycap: pick("autoKeycap"),
		autoRoulette: pick("autoRoulette"),
		volumeMaster: pick("volumeMaster"),
		volumeSfx: pick("volumeSfx"),
		volumeBgm: pick("volumeBgm"),
		bgmEnabled: pick("bgmEnabled"),
		flashOnBreak: pick("flashOnBreak"),
		locale: pick("locale"),
	};
}

// ── 방어적 읽기 ───────────────────────────────────────────────────────────────

function obj(value: unknown): RawSave {
	return typeof value === "object" && value !== null ? (value as RawSave) : {};
}

function arr(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function num(value: unknown): number {
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

function dec(value: unknown): Decimal {
	if (value === undefined || value === null) return ZERO;
	try {
		return D(String(value));
	} catch {
		return ZERO;
	}
}

function grade(value: unknown): Grade {
	return GRADES.includes(value as Grade) ? (value as Grade) : "common";
}

function numberMap(value: unknown): Record<number, number> {
	const out: Record<number, number> = {};
	for (const [k, v] of Object.entries(obj(value))) {
		const key = Number(k);
		if (Number.isFinite(key)) out[key] = num(v);
	}
	return out;
}

function gradeMap(value: unknown): Record<Grade, number> {
	const src = obj(value);
	const out = {} as Record<Grade, number>;
	for (const g of GRADES) out[g] = num(src[g]);
	return out;
}

function sourceMap(value: unknown): Record<GoldSource, Decimal> {
	const src = obj(value);
	const out = {} as Record<GoldSource, Decimal>;
	for (const s of GOLD_SOURCES) out[s] = dec(src[s]);
	return out;
}
