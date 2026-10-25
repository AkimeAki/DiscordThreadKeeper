import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
	{
		ignores: ["node_modules/**", "src/db/**"]
	},
	{
		files: ["**/*.{js,ts}"],
		extends: [eslint.configs.recommended, tseslint.configs.recommended],
		languageOptions: {
			globals: globals.node,
			parserOptions: {
				projectService: {
					allowDefaultProject: ["eslint.config.js"]
				},
				tsconfigRootDir: import.meta.dirname
			}
		},
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					caughtErrors: "none",
					destructuredArrayIgnorePattern: "^_",
					varsIgnorePattern: "^_"
				}
			],
			"@typescript-eslint/strict-boolean-expressions": [
				"error",
				{
					allowAny: false,
					allowNullableBoolean: false,
					allowNullableEnum: false,
					allowNullableNumber: false,
					allowNullableObject: false,
					allowNullableString: false,
					allowNumber: false,
					allowString: false
				}
			]
		}
	},
	{
		linterOptions: {
			reportUnusedDisableDirectives: "error"
		}
	},
	{
		...eslintConfigPrettier,
		rules: {
			...eslintConfigPrettier.rules,
			curly: ["error", "all"]
		}
	}
);
