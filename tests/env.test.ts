import { describe, expect, it } from "vitest";
import { fitScale, MIN_SCALE, VIEW_H, VIEW_W } from "../src/render/app";

/**
 * docs/03-ART.md 의 해상도 규격이 코드에 살아 있는지 지킨다.
 * 이 단언이 깨졌다면 픽셀아트가 뭉개지는 변경이 들어온 것이다.
 */
describe("해상도 규격", () => {
	it("논리 해상도는 640x360", () => {
		expect([VIEW_W, VIEW_H]).toEqual([640, 360]);
	});

	it("x3 이 1920x1080 에 정확히 일치한다", () => {
		expect([VIEW_W * 3, VIEW_H * 3]).toEqual([1920, 1080]);
	});

	it("배율은 항상 정수다", () => {
		for (const [w, h] of [
			[1920, 1080],
			[1600, 900],
			[1366, 768],
			[2560, 1440],
			[3840, 2160],
			[1000, 700],
		] as const) {
			const s = fitScale(w, h);
			expect(Number.isInteger(s)).toBe(true);
		}
	});

	it("화면에 들어가는 가장 큰 정수 배율을 고른다", () => {
		expect(fitScale(1920, 1080)).toBe(3);
		expect(fitScale(1919, 1080)).toBe(2);
		expect(fitScale(2560, 1440)).toBe(4);
		expect(fitScale(1280, 720)).toBe(2);
	});

	it("창이 논리 해상도보다 작아도 MIN_SCALE 아래로 내려가지 않는다", () => {
		expect(fitScale(320, 200)).toBe(MIN_SCALE);
	});
});
