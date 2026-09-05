import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/core/engine";
import { createRng } from "../src/core/numbers";
import { deserialize, fromRaw, MIGRATIONS, type RawSave, serialize, toRaw } from "../src/core/save";
import { SAVE_VERSION } from "../src/core/state";

/**
 * `docs/09-DEV-ENV.md` ④ "세이브 마이그레이션 테스트".
 *
 * ★ **인크리멘탈에서 세이브 손실은 치명적이다.** 수십 시간이 증발한다.
 *   버전별 픽스처를 파일로 남기고, 새 코드가 옛 세이브를 읽는지 매번 검증한다.
 *   **옛 픽스처를 지우지 말 것.** 그게 회귀 테스트의 전부다.
 *
 * 세이브 버전을 올릴 때 하는 일:
 *   1. `src/core/save.ts` 의 `MIGRATIONS[옛버전]` 을 채운다
 *   2. `SAVE_VERSION` 을 올린다
 *   3. `tests/fixtures/save-v<새버전>.json` 을 새로 뜬다 (옛 것은 그대로 둔다)
 */

const DIR = fileURLToPath(new URL("./fixtures/", import.meta.url));
const base = createInitialState(createRng(1));

function fixtures(): string[] {
	return readdirSync(DIR)
		.filter((f) => /^save-v\d+\.json$/.test(f))
		.sort();
}

describe("세이브 라운드트립", () => {
	it("직렬화하고 다시 읽으면 같은 상태다", () => {
		const s = deserialize(serialize(base), base);
		expect(toRaw(s)).toEqual(toRaw(base));
	});

	it("Decimal 이 문자열로 나간다 — 숫자로 쓰면 1e308 에서 죽는다", () => {
		const raw = toRaw(base) as { run: RawSave; meta: RawSave };
		expect(typeof raw.run.gold).toBe("string");
		expect(typeof raw.meta.rebirthCurrency).toBe("string");
	});

	it("아주 큰 수가 살아 돌아온다", () => {
		const big = {
			...base,
			run: { ...base.run, gold: base.run.gold.add("1e300") },
		};
		const back = deserialize(serialize(big), base);
		expect(back.run.gold.toString()).toBe(big.run.gold.toString());
	});

	it("손을 뗀 상태로 불러온다 — 세이브 시점의 누름은 이어지지 않는다", () => {
		const held = {
			...base,
			run: {
				...base.run,
				field: [
					{
						uid: 1,
						typeId: 1,
						grade: "common" as const,
						progress: { hold: 0.5, auto: 0 },
						holding: true,
					},
				],
			},
		};
		const back = deserialize(serialize(held), base);
		expect(back.run.field[0].holding).toBe(false);
		// 진행률은 그대로 남는다 (끊어 누르기와 같은 규칙)
		expect(back.run.field[0].progress.hold).toBe(0.5);
	});
});

describe("픽스처", () => {
	it("버전별 픽스처가 최소 하나 있다", () => {
		expect(fixtures().length).toBeGreaterThan(0);
	});

	for (const file of fixtures()) {
		it(`${file} 이 현재 코드로 로드된다`, () => {
			const raw = JSON.parse(readFileSync(DIR + file, "utf8")) as RawSave;
			const state = fromRaw(raw, base);
			expect(state.version).toBe(SAVE_VERSION);
			// 3층이 전부 살아 있다
			expect(state.run.gold.gte(0)).toBe(true);
			expect(Object.keys(state.meta.types).length).toBeGreaterThan(0);
			expect(state.perm.stats.playSeconds).toBeGreaterThanOrEqual(0);
			// 진행 중이던 왁뿌볼과 확대 화면 대기도 복원된다
			for (const ball of state.run.field) {
				expect(ball.progress.hold + ball.progress.auto).toBeLessThanOrEqual(1);
			}
			// 다시 저장해도 모양이 안 깨진다
			expect(() => serialize(state)).not.toThrow();
		});
	}

	it("픽스처 버전마다 마이그레이션 경로가 있다", () => {
		for (const file of fixtures()) {
			const version = Number(/save-v(\d+)\.json/.exec(file)?.[1]);
			for (let v = version; v < SAVE_VERSION; v++) {
				expect(MIGRATIONS[v], `v${v} → v${v + 1} 마이그레이션이 없다`).toBeDefined();
			}
		}
	});
});

describe("깨진 세이브를 만나도 죽지 않는다", () => {
	it("JSON 이 아니면 새 상태로 떨어진다", () => {
		expect(deserialize("이건 JSON 이 아니다", base)).toBe(base);
	});

	it("빈 객체여도 로드된다", () => {
		const s = fromRaw({}, base);
		expect(s.version).toBe(SAVE_VERSION);
		expect(s.run.gold.toNumber()).toBe(0);
		expect(s.perm.settings).toEqual(base.perm.settings);
	});

	it("설정에 없는 필드는 기본값으로 채운다 — 필드가 늘어도 옛 세이브가 산다", () => {
		const raw = toRaw(base) as { perm: { settings: Record<string, unknown> } };
		raw.perm.settings.crackStages = undefined;
		const s = fromRaw(raw as unknown as RawSave, base);
		expect(s.perm.settings.crackStages).toBe(base.perm.settings.crackStages);
	});

	it("모르는 필드는 무시한다", () => {
		const raw = { ...toRaw(base), 미래의필드: 42 } as RawSave;
		expect(() => fromRaw(raw, base)).not.toThrow();
	});

	it("등급이 이상하면 common 으로 떨어진다", () => {
		const raw = toRaw(base) as { run: RawSave };
		raw.run.field = [{ uid: 1, typeId: 1, grade: "없는등급", progress: { hold: 0, auto: 0 } }];
		const s = fromRaw(raw as RawSave, base);
		expect(s.run.field[0].grade).toBe("common");
	});

	it("숫자가 NaN 이어도 0 으로 들어온다", () => {
		const raw = toRaw(base) as { run: RawSave };
		raw.run.rouletteCount = "이건 숫자가 아니다";
		expect(fromRaw(raw as RawSave, base).run.rouletteCount).toBe(0);
	});
});
