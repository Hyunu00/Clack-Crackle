import { Application, Container, TextureSource } from "pixi.js";
import { PALETTE } from "./palette";

/**
 * 논리 해상도. docs/03-ART.md 에서 확정된 값이다.
 *
 * 640 x 360 x3 = 1920 x 1080 에 정확히 일치한다.
 * ★ 배율은 정수만. 좌표는 정수만. (CLAUDE.md 절대 규칙 4)
 */
export const VIEW_W = 640;
export const VIEW_H = 360;

/** 창이 아무리 작아도 이 아래로는 안 내려간다 */
export const MIN_SCALE = 1;

/**
 * 창 크기에 들어가는 가장 큰 정수 배율.
 * 소수 배율을 쓰면 픽셀이 뭉개진다. 절대 Math.floor 를 빼지 말 것.
 */
export function fitScale(windowW: number, windowH: number): number {
	const raw = Math.min(windowW / VIEW_W, windowH / VIEW_H);
	return Math.max(MIN_SCALE, Math.floor(raw));
}

export interface GameView {
	app: Application;
	/** 논리 좌표계(640x360) 컨테이너. 게임 오브젝트는 전부 이 아래에 붙인다 */
	root: Container;
	/** 현재 정수 배율 */
	scale: number;
}

export async function createView(canvas: HTMLCanvasElement): Promise<GameView> {
	// 픽셀아트. linear 보간이 붙으면 그 순간 픽셀아트가 아니게 된다.
	TextureSource.defaultOptions.scaleMode = "nearest";

	const scale = fitScale(window.innerWidth, window.innerHeight);
	const app = new Application();

	await app.init({
		canvas,
		width: VIEW_W * scale,
		height: VIEW_H * scale,
		background: PALETTE.case,
		antialias: false,
		autoDensity: false,
		resolution: 1,
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
