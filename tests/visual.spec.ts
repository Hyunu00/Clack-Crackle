import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

// docs/09-DEV-ENV.md "화면 검증".
// 지금은 부트 화면뿐이다. 화면이 생기면 상태별로 (초기 / 중반 / 룰렛 /
// 보관함 확대 / 도감) 늘려간다.

const SHOTS = "shots";

test("boot — 640x360 x3", async ({ page }) => {
	const errors: string[] = [];
	page.on("console", (msg) => {
		if (msg.type() === "error") errors.push(msg.text());
	});
	page.on("pageerror", (err) => errors.push(String(err)));

	await page.goto("/");
	await page.waitForFunction(() => window.__game?.ready === true);
	expect(errors).toEqual([]);

	const size = await page.evaluate(() => {
		const c = document.getElementById("game") as HTMLCanvasElement;
		return { w: c.width, h: c.height };
	});
	expect(size).toEqual({ w: 1920, h: 1080 });

	mkdirSync(SHOTS, { recursive: true });
	await page.screenshot({ path: `${SHOTS}/00-boot.png` });
});

/**
 * docs/10-I18N.md "화면 검증" — 언어별로 찍는다.
 * **독일어를 기준으로 볼 것.** 영어 대비 약 1.3배라 UI 가 가장 잘 터진다.
 * 여기서 안 터지면 대체로 다 통과한다.
 */
for (const code of ["ko", "en", "de"]) {
	test(`i18n — ${code}`, async ({ page }) => {
		await page.goto("/");
		await page.waitForFunction(() => window.__game?.ready === true);

		await page.evaluate((c) => window.__game?.i18n.setLocale(c), code);

		// 폰트 프로필과 글자 방향이 문서에 실렸는가
		const applied = await page.evaluate(() => ({
			locale: window.__game?.i18n.locale().code,
			lang: document.documentElement.lang,
			dir: document.documentElement.dir,
			font: document.documentElement.dataset.font,
			title: document.title,
		}));
		expect(applied.locale).toBe(code);
		expect(applied.lang).toBe(code);
		expect(applied.dir).toBe("ltr");

		// 제목은 한국어만 현지화하고 나머지는 en 폴백을 쓴다 (docs/10-I18N.md)
		expect(applied.title).toBe(code === "ko" ? "나만 없어 왁뿌볼" : "Clack & Crackle");

		mkdirSync(SHOTS, { recursive: true });
		await page.screenshot({ path: `${SHOTS}/10-locale-${code}.png` });
	});
}
