import { defineConfig } from "@playwright/test";

// 화면 검증. 결과 이미지는 shots/ 로 떨어진다 (docs/09-DEV-ENV.md)
export default defineConfig({
	testDir: "tests",
	testMatch: "**/*.spec.ts",
	outputDir: "test-results",
	reporter: [["list"]],
	use: {
		baseURL: "http://localhost:5173",
		// 640x360 의 정확히 x3. 픽셀이 흐려지면 정수 배율이 깨진 것이다
		viewport: { width: 1920, height: 1080 },
		deviceScaleFactor: 1,
	},
	webServer: {
		command: "npm run dev",
		url: "http://localhost:5173",
		reuseExistingServer: true,
		timeout: 60_000,
	},
});
