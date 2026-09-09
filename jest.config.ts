import type { Config } from "jest";

const config: Config = {
	preset: "ts-jest",
	testEnvironment: "node",
	testMatch: ["<rootDir>/tests/compiler/**/*.test.ts", "<rootDir>/packages/luau-ast/tests/**/*.test.ts"],
	modulePathIgnorePatterns: [
		"<rootDir>/packages/[^/]+/out/",
		// the publishing template intentionally shares the workspace package name
		"<rootDir>/packages/ts-expose-internals/package-files/",
	],
	moduleNameMapper: {
		"^@roblox-ts/luau-ast$": "<rootDir>/packages/luau-ast/src/LuauAST",
		"^(LuauAST|LuauRenderer)/(.*)$": "<rootDir>/packages/luau-ast/src/$1/$2",
		"^(LuauAST|LuauRenderer)$": "<rootDir>/packages/luau-ast/src/$1",
		"^(Project|Shared|TSTransformer)/(.*)$": "<rootDir>/packages/roblox-ts/src/$1/$2",
		"^(Project|Shared|TSTransformer)$": "<rootDir>/packages/roblox-ts/src/$1",
	},
	collectCoverageFrom: [
		"packages/roblox-ts/src/**/*.ts",
		"packages/luau-ast/src/**/*.ts",
		"!packages/roblox-ts/src/index.ts",
		"!packages/roblox-ts/src/browser.ts",
		"!packages/roblox-ts/src/Shared/util/patchFs.ts",
		"!packages/roblox-ts/src/Shared/classes/LogService.ts",
		"!packages/roblox-ts/src/TSTransformer/util/getFlags.ts",
		"!packages/roblox-ts/src/TSTransformer/util/getKindName.ts",
		"!packages/roblox-ts/src/TSTransformer/util/jsx/constants.ts",
	],
	coverageDirectory: "coverage",
	coverageReporters: ["lcov", "text"],
	verbose: true,
	transform: {
		"^.+\\.tsx?$": ["ts-jest", { tsconfig: "tests/compiler/tsconfig.json" }],
	},
};

export default config;
