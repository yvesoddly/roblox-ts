/* eslint-disable typescript/no-require-imports -- exercise the published CommonJS entry point */
const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const { PathTranslator } = require("..");

const rootDir = path.resolve("project", "src");
const outDir = path.resolve("project", "out");
const source = name => path.join(rootDir, name);
const output = name => path.join(outDir, name);

void test("constructor preserves public configuration and defaults", () => {
	const translator = new PathTranslator(rootDir, outDir, undefined, false);
	assert.equal(translator.rootDir, rootDir);
	assert.equal(translator.outDir, outDir);
	assert.equal(translator.buildInfoOutputPath, undefined);
	assert.equal(translator.declaration, false);
	assert.equal(translator.useLuauExtension, false);

	const buildInfo = output("build.tsbuildinfo");
	assert.equal(new PathTranslator(rootDir, outDir, buildInfo, true, true).buildInfoOutputPath, buildInfo);
});

for (const useLuauExtension of [false, true]) {
	const ext = useLuauExtension ? "luau" : "lua";
	const translator = new PathTranslator(rootDir, outDir, undefined, true, useLuauExtension);

	for (const [input, expected] of [
		["main.ts", `main.${ext}`],
		["nested/component.tsx", `nested/component.${ext}`],
		["nested/index.ts", `nested/init.${ext}`],
		["index.server.tsx", `init.server.${ext}`],
		["module.d.ts", "module.d.ts"],
		["module.d.tsx", "module.d.tsx"],
		["asset.json", "asset.json"],
		["folder", "folder"],
	]) {
		void test(`getOutputPath (${ext}): ${input}`, () => {
			assert.equal(translator.getOutputPath(source(input)), output(expected));
		});
	}

	for (const [input, expected] of [
		["main.ts", `main.${ext}`],
		["index.d.ts", `init.${ext}`],
		["nested/index.server.d.tsx", `nested/init.server.${ext}`],
		["component.tsx", `component.${ext}`],
		["asset.json", "asset.json"],
	]) {
		void test(`getImportPath (${ext}): ${input}`, () => {
			assert.equal(translator.getImportPath(source(input)), output(expected));
			assert.equal(translator.getImportPath(source(input), true), source(expected));
		});
	}

	for (const [input, expected] of [
		[`main.${ext}`, ["main.ts", "main.tsx", `main.${ext}`]],
		[
			`nested/init.server.${ext}`,
			[
				"nested/init.server.ts",
				"nested/init.server.tsx",
				"nested/index.server.ts",
				"nested/index.server.tsx",
				`nested/init.server.${ext}`,
			],
		],
		[`index.${ext}`, [`index.${ext}`]],
		["asset.json", ["asset.json"]],
		[useLuauExtension ? "main.lua" : "main.luau", [useLuauExtension ? "main.lua" : "main.luau"]],
	]) {
		void test(`getInputPaths (${ext}): ${input}`, () => {
			assert.deepEqual(translator.getInputPaths(output(input)), expected.map(source));
		});
	}
}

for (const declaration of [false, true]) {
	const translator = new PathTranslator(rootDir, outDir, undefined, declaration);

	for (const input of ["nested/module.d.ts", "nested/module.d.tsx"]) {
		void test(`getInputPaths (declaration=${declaration}): ${input}`, () => {
			const expected = declaration ? ["nested/module.ts", "nested/module.tsx", input] : [input];
			assert.deepEqual(translator.getInputPaths(output(input)), expected.map(source));
		});
	}
}

for (const [input, declaration, transformed] of [
	["nested/main.ts", "nested/main.d.ts", "nested/main.transformed.ts"],
	["index.tsx", "index.d.ts", "index.transformed.tsx"],
	["main.server.ts", "main.server.d.ts", "main.server.transformed.ts"],
	["main.d.ts", "main.d.ts", "main.transformed.d.ts"],
	["main.d.tsx", "main.d.tsx", "main.transformed.d.tsx"],
	["asset.json", "asset.json", "asset.transformed.json"],
]) {
	void test(`declaration and transformed output: ${input}`, () => {
		const translator = new PathTranslator(rootDir, outDir, undefined, true);
		assert.equal(translator.getOutputDeclarationPath(source(input)), output(declaration));
		assert.equal(translator.getOutputTransformedPath(source(input)), output(transformed));
	});
}
