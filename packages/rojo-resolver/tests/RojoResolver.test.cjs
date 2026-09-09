/* eslint-disable typescript/no-require-imports -- exercise the published CommonJS package entry point */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { FileRelation, NetworkType, RbxPathParent, RbxType, RojoResolver } = require("..");

function fixture(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "rojo-resolver-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	return {
		root,
		write(name, value) {
			const filePath = path.join(root, name);
			fs.mkdirSync(path.dirname(filePath), { recursive: true });
			fs.writeFileSync(filePath, JSON.stringify(value));
			return filePath;
		},
	};
}

void test("discovers configs and prefers the default without ambiguity warnings", t => {
	const { root, write } = fixture(t);
	assert.deepEqual(RojoResolver.findRojoConfigFilePath(root), { path: undefined, warnings: [] });
	const legacy = write("roblox-project.json", {});
	assert.deepEqual(RojoResolver.findRojoConfigFilePath(root), { path: legacy, warnings: [] });
	write("other.project.json", {});
	assert.equal(RojoResolver.findRojoConfigFilePath(root).warnings.length, 1);
	const defaultPath = write("default.project.json", {});
	assert.deepEqual(RojoResolver.findRojoConfigFilePath(root), { path: defaultPath, warnings: [] });
});

void test("loads the packaged schema and resolves optional mounts and explicit files", t => {
	const { root, write } = fixture(t);
	const config = write("default.project.json", {
		name: "game",
		tree: {
			$className: "DataModel",
			ReplicatedStorage: {
				shared: { $path: { optional: "out" } },
				entry: { $path: "entry.lua" },
			},
		},
	});
	const resolver = RojoResolver.fromPath(config);

	assert.equal(resolver.isGame, true);
	assert.deepEqual(resolver.getWarnings(), []);
	assert.deepEqual(resolver.getRbxPathFromFilePath(path.join(root, "out/lib/init.lua")), [
		"ReplicatedStorage",
		"shared",
		"lib",
	]);
	assert.deepEqual(resolver.getRbxPathFromFilePath(path.join(root, "entry.luau")), ["ReplicatedStorage", "entry"]);
	assert.equal(resolver.getRbxPathFromFilePath(path.join(root, "unmapped.luau")), undefined);
	assert.deepEqual(resolver.getPartitions(), [
		{ fsPath: path.join(root, "out"), rbxPath: ["ReplicatedStorage", "shared"] },
	]);
});

void test("resolves nested projects inside mapped directories", t => {
	const { root, write } = fixture(t);
	write("out/nested/default.project.json", { name: "nested", tree: { source: { $path: "src" } } });
	const resolver = RojoResolver.fromTree(root, { shared: { $path: "out" } });

	assert.deepEqual(resolver.getRbxPathFromFilePath(path.join(root, "out/nested/src/module.luau")), [
		"shared",
		"nested",
		"source",
		"module",
	]);
});

void test("reports schema errors and rejects malformed JSON", t => {
	const { write } = fixture(t);
	const invalid = write("invalid.project.json", { name: "invalid", tree: false });
	const resolver = RojoResolver.fromPath(invalid);
	assert.match(resolver.getWarnings()[0], /Invalid configuration/);
	assert.deepEqual(resolver.getPartitions(), []);

	fs.writeFileSync(invalid, "{");
	assert.throws(() => RojoResolver.fromPath(invalid), SyntaxError);
});

void test("synthetic resolvers preserve extension and init mapping", t => {
	const { root } = fixture(t);
	const resolver = RojoResolver.synthetic(root);
	for (const [name, expected] of [
		["init.luau", []],
		["folder/init.server.lua", ["folder"]],
		["folder/main.client.luau", ["folder", "main"]],
		["data.server.json", ["data.server"]],
		["config.toml", ["config"]],
	]) {
		assert.deepEqual(resolver.getRbxPathFromFilePath(path.join(root, name)), expected);
	}
	assert.equal(resolver.isGame, false);
	assert.equal(resolver.getNetworkType(["ServerStorage", "module"]), NetworkType.Unknown);
	assert.equal(resolver.isIsolated(["StarterGui", "module"]), false);
});

void test("classifies Lua and Luau scripts without treating data files as scripts", t => {
	const { root } = fixture(t);
	const resolver = RojoResolver.synthetic(root);
	for (const [name, expected] of [
		["module.lua", RbxType.ModuleScript],
		["module.luau", RbxType.ModuleScript],
		["main.server.lua", RbxType.Script],
		["main.server.luau", RbxType.Script],
		["main.plugin.luau", RbxType.Script],
		["main.client.luau", RbxType.LocalScript],
		["data.server.json", RbxType.ModuleScript],
	]) {
		assert.equal(resolver.getRbxTypeFromFilePath(name), expected);
	}
});

void test("preserves network boundaries and isolated-container relations", t => {
	const { root } = fixture(t);
	const resolver = RojoResolver.fromTree(root, { $className: "DataModel" });
	const shared = ["ReplicatedStorage", "module"];
	const gui = ["StarterGui", "screen"];
	const otherGui = ["StarterGui", "other"];
	const pack = ["StarterPack", "tool"];

	assert.equal(resolver.getNetworkType(shared), NetworkType.Unknown);
	assert.equal(resolver.getNetworkType(gui), NetworkType.Client);
	assert.equal(resolver.getNetworkType(["ServerStorage", "module"]), NetworkType.Server);
	assert.equal(resolver.isIsolated(gui), true);
	assert.equal(resolver.getFileRelation(shared, shared), FileRelation.OutToOut);
	assert.equal(resolver.getFileRelation(shared, gui), FileRelation.OutToIn);
	assert.equal(resolver.getFileRelation(gui, shared), FileRelation.InToOut);
	assert.equal(resolver.getFileRelation(gui, otherGui), FileRelation.InToIn);
	assert.equal(resolver.getFileRelation(gui, pack), FileRelation.OutToIn);
});

void test("relative paths use the exported parent symbol", () => {
	assert.deepEqual(RojoResolver.relative(["a", "b"], ["a", "c"]), [RbxPathParent, "c"]);
	assert.deepEqual(RojoResolver.relative(["a"], ["a", "b"]), ["b"]);
	assert.deepEqual(RojoResolver.relative(["a", "b"], []), [RbxPathParent, RbxPathParent]);
	assert.deepEqual(RojoResolver.relative(["a"], ["a"]), []);
});

void test("config discovery ignores directories with project filenames", t => {
	const { root, write } = fixture(t);
	for (const name of ["default.project.json", "roblox-project.json", "other.project.json"]) {
		fs.mkdirSync(path.join(root, name));
	}
	assert.deepEqual(RojoResolver.findRojoConfigFilePath(root), { path: undefined, warnings: [] });
	const config = write("actual.project.json", { name: "game", tree: {} });
	assert.deepEqual(RojoResolver.findRojoConfigFilePath(root), { path: config, warnings: [] });
});

void test("missing configs produce a warning", t => {
	const { root } = fixture(t);
	const config = path.join(root, "missing.project.json");
	const resolver = RojoResolver.fromPath(config);
	assert.deepEqual(resolver.getWarnings(), [`RojoResolver: Path does not exist "${config}"`]);
	assert.deepEqual(resolver.getPartitions(), []);
});

void test("optional paths require a string optional property", t => {
	const { write } = fixture(t);
	const config = write("default.project.json", { name: "game", tree: { mount: { $path: {} } } });
	const resolver = RojoResolver.fromPath(config);
	assert.match(resolver.getWarnings()[0], /Invalid configuration/);
	assert.deepEqual(resolver.getPartitions(), []);
});

void test("container ancestors are not classified as descendants", t => {
	const { root } = fixture(t);
	const resolver = RojoResolver.fromTree(root, { $className: "DataModel" });
	assert.equal(resolver.isIsolated(["StarterPlayer"]), false);
	assert.equal(resolver.getFileRelation(["StarterPlayer"], ["ReplicatedStorage", "M"]), FileRelation.OutToOut);
	assert.equal(resolver.getNetworkType([]), NetworkType.Unknown);
	assert.equal(resolver.isIsolated(["StarterPlayer", "StarterPlayerScripts", "M"]), true);
});

void test("descendant names can start with two dots", t => {
	const { root } = fixture(t);
	const resolver = RojoResolver.synthetic(path.join(root, "out"));
	assert.deepEqual(resolver.getRbxPathFromFilePath(path.join(root, "out", "..generated", "M.luau")), [
		"..generated",
		"M",
	]);
	assert.equal(resolver.getRbxPathFromFilePath(path.join(root, "M.luau")), undefined);
	assert.equal(resolver.getRbxPathFromFilePath(path.join(root, "outside", "M.luau")), undefined);
	if (process.platform === "win32") {
		const drive = path.parse(root).root.toUpperCase().startsWith("Z:") ? "Y:" : "Z:";
		assert.equal(resolver.getRbxPathFromFilePath(path.join(drive, path.sep, "M.luau")), undefined);
	}
});

void test("directory cycles terminate without losing separate symlink mounts", t => {
	const { root, write } = fixture(t);
	write("out/target/extra.project.json", { name: "extra", tree: { source: { $path: "src" } } });
	fs.symlinkSync(path.join(root, "out"), path.join(root, "out", "target", "loop"), "junction");
	fs.symlinkSync(path.join(root, "out", "target"), path.join(root, "out", "alias"), "junction");
	const resolver = RojoResolver.synthetic(path.join(root, "out"));
	for (const mount of ["alias", "target"]) {
		assert.deepEqual(resolver.getRbxPathFromFilePath(path.join(root, "out", mount, "src", "M.luau")), [
			mount,
			"extra",
			"source",
			"M",
		]);
	}
});

for (const directory of ["out", "out/nested"]) {
	void test(`mounted-tree scans traverse config-named directories under ${directory}`, t => {
		const { root, write } = fixture(t);
		const filePath = write(`${directory}/default.project.json/module.luau`, "");
		const resolver = RojoResolver.fromTree(root, { shared: { $path: "out" } });

		const expected = directory === "out" ? ["shared"] : ["shared", "nested"];
		assert.deepEqual(resolver.getRbxPathFromFilePath(filePath), [...expected, "default.project.json", "module"]);
		assert.deepEqual(resolver.getWarnings(), []);
	});
}
