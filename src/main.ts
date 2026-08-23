import type { DebugHook } from "./debug";
import { getLocale, onLocaleChange, setLocale, t, takeMissingKeys } from "./i18n";
import { LOCALES } from "./i18n/locales";
import { createView } from "./render/app";
import { createBootCard } from "./render/bootCard";

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvas) throw new Error("#game canvas 가 없다");

const view = await createView(canvas);
view.root.addChild(createBootCard());

const hook: DebugHook = {
	view,
	ready: true,
	i18n: {
		t,
		setLocale,
		locale: getLocale,
		locales: LOCALES,
		missing: takeMissingKeys,
	},
};
window.__game = hook;

// 언어가 바뀌면 문자열이 걸린 곳을 다시 그린다.
// 지금은 제목과 부트 표시뿐이지만, HUD 가 생기면 여기서 같이 구독한다.
function render(): void {
	const locale = getLocale();
	document.title = t("game.title");

	const info = document.getElementById("boot-info");
	if (!info) return;
	info.textContent = [
		t("game.title"),
		`view    ${view.app.renderer.width}x${view.app.renderer.height}`,
		`logical 640x360  scale x${view.scale}`,
		`locale  ${locale.code} (${locale.label})  font=${locale.font}  ${locale.tier}`,
	].join("\n");
}

onLocaleChange(render);
render();
