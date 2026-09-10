import tsParser from "@typescript-eslint/parser";
import type { FlatConfig } from "@typescript-eslint/utils/ts-eslint";

import type { Linter } from "eslint";

import { ESLINT_COMPAT } from "../configs/eslint-compat";
import type { Prettify } from "./types";

interface CreateConfigResult<T extends Linter.RulesRecord = Linter.RulesRecord> {
	flat: FlatConfig.Config;
	legacy: Linter.LegacyConfig & {
		overrides: Array<Linter.ConfigOverride & { rules: Prettify<T & typeof ESLINT_COMPAT> }>;
	};
}

export const TYPESCRIPT_FILES = ["**/*/*.?([cm])ts", "**/*/*.?([cm])tsx"];

/**
 * Creates both flat and legacy ESLint configurations with Roblox-TS
 * compatibility rules. Automatically includes ESLint core rules for Roblox-TS
 * compatibility and merges with provided rule overrides.
 *
 * @template T - The type of rule overrides being provided.
 * @param overrides - Additional rules to override or add.
 * @returns Object containing both flat config and legacy config.
 */
export function createConfig<const T extends Linter.RulesRecord>(
	overrides: T = {} as T,
): CreateConfigResult<T> {
	const rules = {
		...ESLINT_COMPAT,
		...overrides,
	} as const satisfies Linter.RulesRecord;

	// standalone compatibility presets must parse TypeScript without requiring a
	// project
	const parserOptions = { ecmaVersion: 2018, sourceType: "module" } as const;

	return {
		flat: {
			files: TYPESCRIPT_FILES,
			languageOptions: { parser: tsParser, parserOptions },
			rules,
		},
		legacy: {
			overrides: [
				{
					files: TYPESCRIPT_FILES,
					parser: "@typescript-eslint/parser",
					parserOptions,
					rules,
				},
			],
		},
	};
}
