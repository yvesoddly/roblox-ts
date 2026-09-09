import type { Config } from "jest";

const config: Config = {
	preset: "ts-jest",
	testEnvironment: "node",
	testMatch: ["<rootDir>/tests/compiler/**/*.test.ts"],
	modulePathIgnorePatterns: ["<rootDir>/packages/roblox-ts/out/"],
	moduleNameMapper: {
		"^(Project|Shared|CLI|TSTransformer)/(.*)$": "<rootDir>/packages/roblox-ts/src/$1/$2",
		"^(Project|Shared|CLI|TSTransformer)$": "<rootDir>/packages/roblox-ts/src/$1",
	},
	collectCoverageFrom: [
		"packages/roblox-ts/src/**/*.ts",
		"!packages/roblox-ts/src/CLI/**",
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
