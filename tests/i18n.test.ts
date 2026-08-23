import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FALLBACK_LOCALE, isStrict, LOCALES, NO_TRANSLATE } from "../src/i18n/locales";

/**
 * docs/10-I18N.md "검증" 의 4가지.
 *
 * JSON 을 import 하지 않고 파일을 직접 읽는다. import 로 가져오면
 * `locales.ts` 에 등록되지 않은 JSON 이 굴러다니는 걸 못 잡는다.
 */

const DIR = fileURLToPath(new URL("../src/i18n/", import.meta.url));

function load(code: string): Record<string, string> {
	return JSON.parse(readFileSync(`${DIR}${code}.json`, "utf8"));
}

const EN = load(FALLBACK_LOCALE);
const EN_KEYS = Object.keys(EN);

/** 값이 "[그 키]" 그대로면 아직 이름이 안 정해진 자리다 */
const isPlaceholder = (key: string, value: string) => value === `[${key}]`;

/**
 * ★ 번역 커버리지를 **에러**로 볼지 **리포트**로 볼지.
 *
 * 지금은 `false` — ko/en 만 채워져 있고 T1 7개 언어는 빈 파일이다.
 * 미번역 키는 en 으로 폴백되므로 **게임은 정상 동작하고, 버그가 아니다.**
 * 여기서 실패시키면 `npm run check` 가 첫날부터 빨간불이라 커밋 게이트로
 * 못 쓴다 (CLAUDE.md 절대 규칙 10).
 *
 * 번역이 들어오면 아래 리포트의 숫자가 저절로 0 에 수렴한다.
 * 0 이 된 뒤 **출시 전에 `true` 로 바꿔서 회귀를 막는다.**
 * 그때부터 T0/T1 은 실패, T2 이하는 경고다 (docs/10-I18N.md).
 */
const STRICT_KEY_COVERAGE = false;

describe("파일과 LOCALES 가 짝이 맞는가", () => {
	const files = readdirSync(DIR)
		.filter((f) => f.endsWith(".json"))
		.map((f) => f.slice(0, -".json".length));

	it("LOCALES 의 모든 언어에 JSON 파일이 있다", () => {
		const missing = LOCALES.filter((l) => !files.includes(l.code)).map((l) => l.code);
		expect(missing, `src/i18n/{code}.json 이 없다: ${missing.join(", ")}`).toEqual([]);
	});

	it("등록되지 않은 JSON 파일이 굴러다니지 않는다", () => {
		const codes = LOCALES.map((l) => l.code);
		const orphans = files.filter((f) => !codes.includes(f));
		expect(orphans, `locales.ts 에 없는 파일: ${orphans.join(", ")}`).toEqual([]);
	});
});

describe("번역 커버리지", () => {
	for (const locale of LOCALES) {
		if (locale.code === FALLBACK_LOCALE) continue;

		const label = `${locale.tier} ${locale.code}`;

		it(`${label}`, () => {
			const dict = load(locale.code);
			// 번역하지 않는 키는 분모에서도 뺀다
			const target = EN_KEYS.filter((k) => !NO_TRANSLATE.includes(k));
			const missing = target.filter((k) => !dict[k]);
			const done = target.length - missing.length;
			const pct = Math.round((done / target.length) * 100);

			if (missing.length > 0) {
				const head = missing.slice(0, 20).join(", ");
				const tail = missing.length > 20 ? ` … 외 ${missing.length - 20}개` : "";
				console.warn(`[i18n] ${label}  ${done}/${target.length} (${pct}%)  누락: ${head}${tail}`);
			}

			if (STRICT_KEY_COVERAGE && isStrict(locale)) {
				expect(missing, `${label} 에 ${missing.length}개 누락`).toEqual([]);
			}
		});
	}
});

describe("en.json 자체 규칙", () => {
	it("빈 값이 없다", () => {
		const empty = EN_KEYS.filter((k) => !EN[k]);
		expect(empty, `값이 빈 키: ${empty.join(", ")}`).toEqual([]);
	});

	it("번역하지 않는 키는 en 에 실제 값이 있다", () => {
		for (const key of NO_TRANSLATE) {
			expect(EN[key], `${key} 가 en.json 에 없다. 폴백이 깨진다`).toBeTruthy();
			expect(isPlaceholder(key, EN[key]), `${key} 가 아직 placeholder 다`).toBe(false);
		}
	});

	it("키가 중복되지 않는다", () => {
		expect(new Set(EN_KEYS).size).toBe(EN_KEYS.length);
	});
});

describe("ko.json", () => {
	const KO = load("ko");

	it("en.json 과 키 집합이 정확히 같다", () => {
		const missing = EN_KEYS.filter((k) => !(k in KO));
		const extra = Object.keys(KO).filter((k) => !(k in EN));
		expect({ missing, extra }).toEqual({ missing: [], extra: [] });
	});

	it("빈 값이 없다", () => {
		const empty = Object.keys(KO).filter((k) => !KO[k]);
		expect(empty, `값이 빈 키: ${empty.join(", ")}`).toEqual([]);
	});

	it("게임 제목은 확정값이다", () => {
		expect(KO["game.title"]).toBe("나만 없어 왁뿌볼");
		expect(EN["game.title"]).toBe("Clack & Crackle");
	});
});

describe("파라미터 토큰 일치", () => {
	const tokens = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort().join(",");

	for (const locale of LOCALES) {
		if (locale.code === FALLBACK_LOCALE) continue;

		it(`${locale.code} — {n} 같은 치환 토큰이 en 과 같다`, () => {
			const dict = load(locale.code);
			const bad: string[] = [];
			for (const [key, value] of Object.entries(dict)) {
				const en = EN[key];
				if (en === undefined) continue;
				if (tokens(en) !== tokens(value)) {
					bad.push(`${key}: en{${tokens(en)}} vs ${locale.code}{${tokens(value)}}`);
				}
			}
			expect(bad, bad.join("\n")).toEqual([]);
		});
	}
});

describe("placeholder 현황", () => {
	// 이름이 정해지면 줄어든다. 0 이 되면 이름 작업이 끝난 것 (docs/08-NAMING.md)
	it("남은 개수를 보고한다", () => {
		const ko = load("ko");
		const left = Object.entries(ko).filter(([k, v]) => isPlaceholder(k, v));
		console.warn(`[i18n] 이름 미정 ${left.length}/${EN_KEYS.length} — docs/08-NAMING.md`);
		expect(left.length).toBeLessThanOrEqual(EN_KEYS.length);
	});
});
