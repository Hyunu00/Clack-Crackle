import { describe, expect, it } from "vitest";
import { fitScale, MIN_SCALE, VIEW_H, VIEW_W } from "../src/render/app";

/**
 * docs/03-ART.md 의 해상도 규격이 코드에 살아 있는지 지킨다.
 *
 * 캐주얼 아트는 정수 배율을 요구하지 않는다 — linear 필터라 소수 배율이어도
 * 그냥 매끄럽게 스케일된다. 픽셀아트 시절의 "배율은 항상 정수" 단언은
 * 이제 반대 의미다: 정수여야 "하지 않는다"는 걸 증명한다.
 */
describe("해상도 규격", () => {
	it("기준 해상도는 1920x1080", () => {
		expect([VIEW_W, VIEW_H]).toEqual([1920, 1080]);
	});

	it("기준 해상도 그대로면 배율은 1이다", () => {
		expect(fitScale(1920, 1080)).toBe(1);
	});

	it("2배 창(4K)이면 배율도 2다", () => {
		expect(fitScale(3840, 2160)).toBe(2);
	});

	it("작은 창에서는 소수 배율을 그대로 쓴다 — 정수로 반올림하지 않는다", () => {
		// 1280x720 은 1080p 의 2/3 이다. 배율도 정확히 2/3 이어야 한다
		expect(fitScale(1280, 720)).toBeCloseTo(2 / 3, 10);
		expect(Number.isInteger(fitScale(1280, 720))).toBe(false);
	});

	it("가로세로 비율이 다른 창은 더 작게 맞는 쪽을 따라간다", () => {
		// 1000x700 은 가로가 더 빡빡하다 (1000/1920 < 700/1080)
		expect(fitScale(1000, 700)).toBeCloseTo(1000 / 1920, 10);
	});

	it("창이 아무리 작아도 MIN_SCALE 아래로 내려가지 않는다", () => {
		expect(fitScale(10, 10)).toBe(MIN_SCALE);
	});
});
