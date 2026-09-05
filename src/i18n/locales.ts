/**
 * 지원 언어 목록.
 *
 * ★ 언어를 추가할 때 고치는 유일한 코드 파일이다.
 *   절차는 `docs/10-I18N.md` 의 "언어를 추가하는 절차".
 *   설정 화면의 언어 목록도 이 배열을 읽어서 그린다.
 *   언어를 추가하려고 UI 코드를 고치게 됐다면 설계가 잘못된 것이다.
 */

/** 폰트 프로필. 한 폰트가 한/중/일을 다 못 덮어서 나눠 물린다 */
export type FontProfile = "latin" | "cyrillic" | "ko" | "ja" | "zh" | "fallback";

/** 아랍어(T3)를 대비해 자리만 잡아둔다. 지금 등록된 언어는 전부 ltr */
export type TextDir = "ltr" | "rtl";

/**
 * T0 개발 언어 / T1 출시 / T2 출시 후 / T3 조건부.
 * `npm run check` 에서 **T0·T1 은 키 누락이 에러**, T2 이하는 경고다.
 */
export type Tier = "T0" | "T1" | "T2" | "T3";

export interface Locale {
	/** BCP-47. `src/i18n/{code}.json` 파일 이름과 정확히 같아야 한다 */
	code: string;
	/** 스팀 스토어 언어 코드 (`docs/10-I18N.md` 티어 표) */
	steamCode: string;
	/** 설정 화면에 그대로 그리는 이름. 그 언어 사용자가 읽는 표기로 쓴다 */
	label: string;
	font: FontProfile;
	dir: TextDir;
	tier: Tier;
}

/**
 * T0 + T1 = 출시 9개 언어.
 * T2(6개)와 T3 는 `docs/10-I18N.md` 의 티어 표에만 있고 여기엔 아직 없다.
 * 출시 후 추가할 때 이 배열에 한 줄씩 붙인다.
 */
export const LOCALES: readonly Locale[] = [
	{ code: "ko", steamCode: "koreana", label: "한국어", font: "ko", dir: "ltr", tier: "T0" },
	{ code: "en", steamCode: "english", label: "English", font: "latin", dir: "ltr", tier: "T0" },
	{ code: "zh-CN", steamCode: "schinese", label: "简体中文", font: "zh", dir: "ltr", tier: "T1" },
	{ code: "ru", steamCode: "russian", label: "Русский", font: "cyrillic", dir: "ltr", tier: "T1" },
	{ code: "ja", steamCode: "japanese", label: "日本語", font: "ja", dir: "ltr", tier: "T1" },
	{ code: "es", steamCode: "spanish", label: "Español", font: "latin", dir: "ltr", tier: "T1" },
	{
		code: "pt-BR",
		steamCode: "brazilian",
		label: "Português (Brasil)",
		font: "latin",
		dir: "ltr",
		tier: "T1",
	},
	{ code: "de", steamCode: "german", label: "Deutsch", font: "latin", dir: "ltr", tier: "T1" },
	{ code: "fr", steamCode: "french", label: "Français", font: "latin", dir: "ltr", tier: "T1" },
] as const;

/**
 * 폴백 언어. 어떤 언어에서 키가 비면 여기로 떨어진다.
 * `en.json` 이 키 집합의 기준이기도 하다 — 테스트가 이걸 원본으로 비교한다.
 */
export const FALLBACK_LOCALE = "en";

/** 키 누락이 에러인 티어 */
export const STRICT_TIERS: readonly Tier[] = ["T0", "T1"];

/**
 * **번역하지 않는 키.** 다른 언어에 넣지 말고 en 폴백을 그대로 쓰게 둔다.
 * 누락 키 테스트가 이 목록은 건너뛴다.
 *
 * `game.title` — 영문 주제목 `Clack & Crackle` 이 스토어 URL 과 앱 식별자를
 * 결정한다. 한국어만 `나만 없어 왁뿌볼` 로 덮어쓰고 (ko.json 에 값이 있다),
 * 나머지 언어는 키를 아예 두지 않는 게 의도다 (`docs/10-I18N.md`).
 */
export const NO_TRANSLATE: readonly string[] = ["game.title"];

export function findLocale(code: string): Locale | undefined {
	return LOCALES.find((l) => l.code === code);
}

export function isStrict(locale: Locale): boolean {
	return STRICT_TIERS.includes(locale.tier);
}
