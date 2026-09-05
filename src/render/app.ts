import { Application, Container } from "pixi.js";
import { PALETTE } from "./palette";

/**
 * 기준(디자인) 해상도. docs/03-ART.md 에서 확정된 값이다.
 *
 * 캐주얼 아트로 전환하면서 "작은 가상 캔버스를 정수 배율로 확대"하던
 * 픽셀아트 방식을 버렸다. 대신 실제 출력 해상도(1080p)를 그대로 기준으로
 * 쓰고, 창 크기에 맞춰 소수 배율로 부드럽게 스케일한다.
 * (`docs/06-DECISIONS.md` "아트 스타일 — 픽셀 → 캐주얼")
 */
export const VIEW_W = 1920;
export const VIEW_H = 1080;

/**
 * 창이 아무리 작아도 이 배율 아래로는 안 내려간다.
 * 0 에 가까워지면 HUD 글자가 안 보이는 크기가 되므로 바닥을 둔다.
 */
export const MIN_SCALE = 0.25;

/**
 * 창 크기에 맞는 배율. 캐주얼 아트는 linear 필터라 소수 배율이어도
 * 흐려지는 게 아니라 그냥 매끄럽게 확대/축소된다 — 정수로 반올림할 이유가 없다.
 */
export function fitScale(windowW: number, windowH: number): number {
	const raw = Math.min(windowW / VIEW_W, windowH / VIEW_H);
	return Math.max(MIN_SCALE, raw);
}

export interface GameView {
	app: Application;
	/** 기준 좌표계(1920x1080) 컨테이너. 게임 오브젝트는 전부 이 아래에 붙인다 */
	root: Container;
	/** 현재 배율. 정수라는 보장이 없다 */
	scale: number;
}

export async function createView(canvas: HTMLCanvasElement): Promise<GameView> {
	// scaleMode 는 건드리지 않는다 — Pixi 기본값이 이미 "linear" 다.
	// (픽셀아트 시절엔 여기서 "nearest" 로 강제했었다)

	const scale = fitScale(window.innerWidth, window.innerHeight);
	const app = new Application();

	// 고해상도 화면에서 또렷하게 나오도록 devicePixelRatio 를 그대로 쓴다.
	// width/height 는 CSS(논리) 픽셀, resolution 이 실제 백킹 버퍼 배율이다.
	const dpr = window.devicePixelRatio || 1;

	await app.init({
		canvas,
		width: VIEW_W * scale,
		height: VIEW_H * scale,
		background: PALETTE.case,
		antialias: true,
		autoDensity: true,
		resolution: dpr,
		preference: "webgl",
	});

	const root = new Container();
	root.scale.set(scale);
	app.stage.addChild(root);

	const view: GameView = { app, root, scale };

	window.addEventListener("resize", () => {
		const next = fitScale(window.innerWidth, window.innerHeight);
		if (next === view.scale) return;
		view.scale = next;
		root.scale.set(next);
		app.renderer.resize(VIEW_W * next, VIEW_H * next);
	});

	return view;
}
