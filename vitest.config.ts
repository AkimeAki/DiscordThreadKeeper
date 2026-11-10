import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		setupFiles: ["./src/tests/setup-database.ts"],
		restoreMocks: true,
		reporters: process.env["GITHUB_ACTIONS"] === "true" ? ["tree", "github-actions"] : ["tree"]
	}
});
