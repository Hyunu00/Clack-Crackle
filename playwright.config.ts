import { defineConfig } from "@playwright/test";

// 화면 검증. 결과 이미지는 shots/ 로 떨어진다 (docs/09-DEV-ENV.md)
export default defineConfig({
	testDir: "tests",
	testMatch: "**/*.spec.ts",
	outputDir: "test-results",
	reporter: [["list"]],
	use: {
		baseURL: "http://localhost:5173",
		// 기준 해상도 1920x1080 그대로. 배율이 정확히 1이 되는 창 크기다
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
