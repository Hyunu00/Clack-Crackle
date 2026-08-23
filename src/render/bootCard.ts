import { Container, Graphics } from "pixi.js";
import { VIEW_H, VIEW_W } from "./app";
import { PALETTE } from "./palette";

/**
 * ⚠️ 임시 부트 화면. 환경이 제대로 섰는지 눈으로 확인하는 용도다.
 *
 * 화면 레이아웃은 미결이다 (docs/01-OPEN-QUESTIONS.md Q3 — 키캡과 필드의 거리).
 * 그래서 여기에 키캡이나 필드를 배치하지 않는다. 검사 항목만 그린다:
 *
 *   1. 테두리   — 640x360 이 화면에 정확히 맞는가
 *   2. 체커     — nearest 인가. 흐릿하면 보간이 켜진 것이다
 *   3. 대각선   — 안티에일리어싱이 꺼졌는가. 계단이 보여야 정상이다
 *
 * 실제 화면을 만들기 시작하면 이 파일은 지운다.
 */
export function createBootCard(): Container {
	const card = new Container();

	const frame = new Graphics()
		.rect(0, 0, VIEW_W, VIEW_H)
		.stroke({ width: 1, color: PALETTE.plate, alignment: 0 });
	card.addChild(frame);

	const checker = new Graphics();
	const cell = 4;
	for (let y = 0; y < 8; y++) {
		for (let x = 0; x < 8; x++) {
			if ((x + y) % 2 === 0) continue;
			checker.rect(x * cell, y * cell, cell, cell);
		}
	}
	checker.fill(PALETTE.cap);
	checker.position.set(VIEW_W - 8 * cell - 8, 8);
	card.addChild(checker);

	const diagonal = new Graphics()
		.moveTo(8, VIEW_H - 8)
		.lineTo(8 + 40, VIEW_H - 8 - 17)
		.stroke({ width: 1, color: PALETTE.amber, alignment: 0 });
	card.addChild(diagonal);

	return card;
}
