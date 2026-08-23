/**
 * 최소 i18n. JSON 로드 + t(key) 가 전부다.
 * 게임용이라 i18next 같은 라이브러리는 쓰지 않는다 (`docs/10-I18N.md`).
 *
 * 폴백: 현재 로케일 → en → "[key]"
 * 마지막을 빈 문자열로 만들지 말 것. 미번역이 화면에서 눈에 띄어야 한다.
 */

import { FALLBACK_LOCALE, findLocale, LOCALES, type Locale } from "./locales";

type Dict = Record<string, string>;

/**
 * ★ 여기에 import 를 손으로 추가하지 않는다.
 *   `src/i18n/*.json` 을 통째로 집어가므로 언어 추가 = JSON 파일 1개 +
 *   `locales.ts` 한 줄이 된다. import 를 손으로 쓰기 시작하면 그 성질이 깨진다.
 */
const MODULES = import.meta.glob<Dict>("./*.json", { eager: true, import: "default" });

const DICTS: Record<string, Dict> = {};
for (const [path, dict] of Object.entries(MODULES)) {
	const code = path.slice("./".length, -".json".length);
	DICTS[code] = dict;
}

let current: string = FALLBACK_LOCALE;

/** 번역 체크리스트. 화면에 실제로 필요했는데 없었던 키만 쌓인다 */
const missing = new Set<string>();
let flushHandle: ReturnType<typeof setTimeout> | undefined;

type Listener = (locale: Locale) => void;
const listeners = new Set<Listener>();

// ─────────────────────────────────────────────────────────────────────────────

/**
 * 키를 현재 언어 문자열로 바꾼다.
 *
 * ```ts
 * t("ball.type.001")                 // "사과"
 * t("ui.roulette.cost", { n: 100 })  // "100 G"  ← 원문의 {n} 자리에 들어간다
 * ```
 */
export function t(key: string, params?: Readonly<Record<string, string | number>>): string {
	const hit = DICTS[current]?.[key];
	if (hit) return params ? interpolate(hit, params) : hit;

	// 현재 언어에 없다 → 번역 체크리스트에 올린다
	if (current !== FALLBACK_LOCALE) reportMissing(current, key);

	const fallback = DICTS[FALLBACK_LOCALE]?.[key];
	if (fallback) return params ? interpolate(fallback, params) : fallback;

	reportMissing(FALLBACK_LOCALE, key);
	return `[${key}]`;
}

function interpolate(raw: string, params: Readonly<Record<string, string | number>>): string {
	return raw.replace(/\{(\w+)\}/g, (whole, name: string) => {
		const v = params[name];
		return v === undefined ? whole : String(v);
	});
}

// ─────────────────────────────────────────────────────────────────────────────

export function getLocale(): Locale {
	// LOCALES 에 없는 코드가 current 에 들어갈 수 없도록 setLocale 이 막는다
	return findLocale(current) ?? (LOCALES[0] as Locale);
}

export function setLocale(code: string): void {
	const locale = findLocale(code);
	if (!locale) {
		console.warn(`[i18n] 등록되지 않은 언어: ${code}. locales.ts 를 확인할 것`);
		return;
	}
	current = locale.code;
	applyDocumentAttrs(locale);
	for (const fn of listeners) fn(locale);
}

/** 언어가 바뀌면 다시 그려야 하는 화면이 구독한다 */
export function onLocaleChange(fn: Listener): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

/**
 * 폰트 프로필과 글자 방향을 문서에 얹는다.
 * CSS 는 `[data-font="ko"]` 로 프로필별 폰트를 물린다 (index.html).
 * 아랍어(T3)가 들어오면 `dir="rtl"` 이 HUD 레이아웃을 대부분 처리한다 —
 * HUD 를 Pixi 로 안 만든 결정이 여기서 이득을 본다.
 */
function applyDocumentAttrs(locale: Locale): void {
	if (typeof document === "undefined") return;
	const root = document.documentElement;
	root.lang = locale.code;
	root.dir = locale.dir;
	root.dataset.font = locale.font;
}

/** 시스템 언어 중 지원하는 게 있으면 그걸로, 없으면 en */
export function detectLocale(): string {
	if (typeof navigator === "undefined") return FALLBACK_LOCALE;
	for (const want of navigator.languages ?? [navigator.language]) {
		const exact = findLocale(want);
		if (exact) return exact.code;
		// "pt-PT" → "pt-BR" 처럼 지역만 다른 경우를 받아준다
		const base = want.split("-")[0];
		const loose = LOCALES.find((l) => l.code.split("-")[0] === base);
		if (loose) return loose.code;
	}
	return FALLBACK_LOCALE;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * 누락 키는 모아서 한 번에 찍는다. 그게 번역 체크리스트다.
 * (`docs/04-AUDIO.md` 의 빈 사운드 키 처리와 같은 방식)
 */
function reportMissing(locale: string, key: string): void {
	missing.add(`${locale}\t${key}`);
	if (!import.meta.env.DEV || flushHandle !== undefined) return;
	flushHandle = setTimeout(() => {
		flushHandle = undefined;
		printMissing();
	}, 1000);
}

function printMissing(): void {
	if (missing.size === 0) return;
	console.warn(
		`[i18n] 번역 누락 ${missing.size}건 — 번역 체크리스트\n${[...missing].sort().join("\n")}`,
	);
}

/** 지금까지 쌓인 누락 키를 돌려준다. Playwright 가 언어별 촬영에 쓴다 */
export function takeMissingKeys(): string[] {
	return [...missing].sort();
}

/** 등록된 언어의 사전. 테스트와 디버그 훅이 쓴다 */
export function getDict(code: string): Dict | undefined {
	return DICTS[code];
}

setLocale(detectLocale());
