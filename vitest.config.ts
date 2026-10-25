import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
		setupFiles: ["./src/tests/setup-database.ts"],
		clearMocks: true,
		restoreMocks: true,
		reporters: process.env["GITHUB_ACTIONS"] === "true" ? ["tree", "github-actions"] : ["tree"]
	}
});
