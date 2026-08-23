import { defineConfig } from "vitest/config";

export default defineConfig({
	server: { port: 5173, strictPort: true },
	build: { target: "es2022" },
	test: {
		// *.test.ts 는 vitest, *.spec.ts 는 playwright 가 가져간다
		include: ["tests/**/*.test.ts"],
		environment: "node",
	},
});
