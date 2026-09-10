import tsParser from "@typescript-eslint/parser";
import { TSESLint } from "@typescript-eslint/utils";

import path from "node:path";
import { describe, expect, it } from "vitest";

import roblox from "../index";

const cwd = path.resolve(import.meta.dirname, "../..");
const code = "let value: number = 1; if (value == 1) {}";

function expectCompatibilityError(results: Array<TSESLint.FlatESLint.LintResult>): void {
	expect(results).toHaveLength(1);
	expect(results[0]?.fatalErrorCount).toBe(0);
	expect(results[0]?.messages.map(({ ruleId }) => ruleId)).toEqual(["eqeqeq"]);
}

describe("public configurations", () => {
	it("parses TypeScript with the standalone flat compatibility config", async () => {
		const eslint = new TSESLint.FlatESLint({
			cwd,
			overrideConfig: [roblox.configs["eslintCompat"] ?? {}],
			overrideConfigFile: true,
		});

		expectCompatibilityError(await eslint.lintText(code, { filePath: "src/compat.ts" }));
	});

	it.each([
		"eslintCompatLegacy",
		"eslint-compat-legacy",
		"tsRecommendedCompatLegacy",
		"ts-recommended-compat-legacy",
	])("loads the standalone legacy config %s", async (name) => {
		const eslint = new TSESLint.LegacyESLint({
			cwd,
			overrideConfig: { extends: [`plugin:roblox-ts/${name}`] },
			plugins: { "roblox-ts": roblox },
			useEslintrc: false,
		});

		expectCompatibilityError(await eslint.lintText(code, { filePath: "src/compat.ts" }));
	});

	it("runs the manual no-any config without type information", async () => {
		const eslint = new TSESLint.FlatESLint({
			cwd,
			fix: true,
			overrideConfig: [
				{
					files: ["**/*.ts", "**/*.tsx"],
					languageOptions: { parser: tsParser },
					plugins: { "roblox-ts": roblox },
					rules: { "roblox-ts/no-any": ["error", { fixToUnknown: true }] },
				},
			],
			overrideConfigFile: true,
		});

		const [result] = await eslint.lintText("let value: any;", { filePath: "src/manual.ts" });

		expect(result?.fatalErrorCount).toBe(0);
		expect(result?.output).toBe("let value: unknown;");
	});
});
