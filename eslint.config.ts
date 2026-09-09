import eslint from "@eslint/js";
import comments from "@eslint-community/eslint-plugin-eslint-comments";
import { defineConfig } from "eslint/config";
import prettier from "eslint-plugin-prettier/recommended";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

export default defineConfig(
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	prettier,
	{
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
				project: [
					"./tsconfig.json",
					"./tsconfig.eslint.json",
					"./packages/compiler-types/tsconfig.json",
					"./packages/luau-ast/tsconfig.json",
					"./packages/cli/tsconfig.json",
					"./packages/roblox-ts/tsconfig.json",
					"./packages/luau-ast/tests/tsconfig.json",
					"./packages/*/src/*/tsconfig.json",
					"./tests/compiler/tsconfig.json",
				],
				ecmaFeatures: { jsx: true },
			},
		},
		plugins: {
			"simple-import-sort": simpleImportSort,
			"eslint-comments": comments,
		},
		rules: {
			// off
			"@typescript-eslint/explicit-function-return-type": "off",
			"@typescript-eslint/explicit-module-boundary-types": "off",
			"@typescript-eslint/no-empty-function": "off",
			"@typescript-eslint/no-empty-interface": "off",
			"@typescript-eslint/no-namespace": "off",
			"@typescript-eslint/no-non-null-assertion": "off",
			"@typescript-eslint/no-use-before-define": "off",
			"no-debugger": "off",
			"no-extra-boolean-cast": "off",

			// warn
			"@typescript-eslint/no-unused-expressions": "warn",
			"@typescript-eslint/no-unused-vars": "warn",
			"eslint-comments/disable-enable-pair": ["warn", { allowWholeFile: true }],
			"eslint-comments/no-unused-disable": "warn",
			"eslint-comments/require-description": "warn",
			"no-console": "warn",
			"no-undef-init": "warn",
			"prefer-const": ["warn", { destructuring: "all" }],
			"prettier/prettier": "warn",
			"simple-import-sort/exports": "warn",
			"simple-import-sort/imports": "warn",
			curly: ["warn", "multi-line", "consistent"],

			// error
			"@typescript-eslint/array-type": ["error", { default: "generic", readonly: "generic" }],
			"@typescript-eslint/no-deprecated": "error",
			"@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: true }],
			"@typescript-eslint/no-require-imports": "error",
			"no-constant-condition": ["error", { checkLoops: false }],
			"no-restricted-imports": ["error", { patterns: [".*"] }],
		},
	},
	{
		files: ["packages/compiler-types/types/*.d.ts"],
		rules: {
			// ambient standard-library declarations use explicit references and broad callable types
			"@typescript-eslint/triple-slash-reference": "off",
			"@typescript-eslint/no-empty-object-type": "off",
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unused-vars": "off",
		},
	},
	{
		files: ["packages/compiler-types/types/core.d.ts"],
		rules: {
			// TypeScript requires these globals even though using them directly is deprecated
			"@typescript-eslint/no-deprecated": "off",
		},
	},
	{
		files: ["packages/luau-ast/src/LuauAST/types/nodes.ts"],
		rules: {
			// public node interfaces specialize their syntax kind without adding fields
			"@typescript-eslint/no-empty-object-type": ["error", { allowInterfaces: "with-single-extends" }],
		},
	},
	{
		files: ["tests/compiler/**/*.ts"],
		rules: {
			"no-restricted-imports": "off",
		},
	},
	{
		ignores: [
			".local/",
			"**/node_modules/",
			"tests/src/",
			"tests/projects/",
			"tests/out/",
			"tests/include/",
			"tests/node_modules/",
			"**/out/",
			"coverage/",
			"devlink/",
			"jest.config.ts",
		],
	},
);
