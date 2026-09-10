// cspell:ignore publint
import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	entry: ["src/index.ts"],
	external: [
		"@typescript-eslint/utils",
		"@typescript-eslint/type-utils",
		"typescript",
		"@roblox-ts/luau-ast",
	],
	fixedExtension: true,
	format: ["esm"],
	inlineOnly: ["ts-api-utils"],
	onSuccess() {
		console.info("🙏 Build succeeded!");
	},
	shims: true,
	unused: {
		level: "error",
	},
});
