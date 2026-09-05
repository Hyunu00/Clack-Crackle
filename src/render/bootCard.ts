import { Container, Graphics } from "pixi.js";
import { VIEW_H, VIEW_W } from "./app";
import { PALETTE } from "./palette";

/**
 * ⚠️ 임시 부트 화면. 환경이 제대로 섰는지 눈으로 확인하는 용도다.
 *
 * 화면 레이아웃은 미결이다 (docs/01-OPEN-QUESTIONS.md Q3 — 키캡과 필드의 거리).
 * 그래서 여기에 키캡이나 필드를 배치하지 않는다. 검사 항목만 그린다:
 *
 *   1. 테두리 — 1920x1080 이 화면에 정확히 맞는가
 *   2. 원     — 안티에일리어싱이 켜졌는가. 매끄러운 곡선이어야 정상이다
 *              (픽셀아트 시절엔 반대로 "계단이 보여야 정상"이었다)
 *
 * 실제 화면을 만들기 시작하면 이 파일은 지운다.
 */
export function createBootCard(): Container {
	const card = new Container();

	const frame = new Graphics()
		.rect(0, 0, VIEW_W, VIEW_H)
		.stroke({ width: 2, color: PALETTE.plate, alignment: 0 });
	card.addChild(frame);

	const circle = new Graphics().circle(VIEW_W - 60, 60, 24).fill(PALETTE.amber);
	card.addChild(circle);

	return card;
}
