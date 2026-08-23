import type { Locale } from "./i18n/locales";
import type { GameView } from "./render/app";

/**
 * docs/09-DEV-ENV.md "화면 검증" 의 `window.__game` 훅.
 * Playwright 가 상태를 주입한 뒤 촬영한다. 엔진이 생기면 state 와 조작 함수를 여기에 얹는다.
 */
export interface DebugHook {
	view: GameView;
	ready: boolean;
	/**
	 * `npm run shot` 을 언어별로 돌리기 위한 창구 (docs/10-I18N.md "화면 검증").
	 * 독일어가 영어 대비 1.3배라 UI 가 가장 잘 터진다. 독일어를 기준으로 볼 것.
	 */
	i18n: {
		t: (key: string, params?: Readonly<Record<string, string | number>>) => string;
		setLocale: (code: string) => void;
		locale: () => Locale;
		locales: readonly Locale[];
		/** 화면에 필요했는데 번역이 없던 키 = 번역 체크리스트 */
		missing: () => string[];
	};
}

declare global {
	interface Window {
		__game?: DebugHook;
	}
}
