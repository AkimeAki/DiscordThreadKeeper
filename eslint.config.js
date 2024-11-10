import globals from "globals";
import pluginJs from "@eslint/js";
import configPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default [
	{ languageOptions: { globals: { ...globals.browser, ...globals.node } } },
	pluginJs.configs.recommended,
	...tseslint.configs.recommended,
	{
		ignores: ["src/env.d.ts", "dist/**/*"]
	},
	configPrettier
];
