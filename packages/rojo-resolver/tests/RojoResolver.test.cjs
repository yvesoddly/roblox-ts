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

test("discovers configs and prefers the default without ambiguity warnings", t => {
	const { root, write } = fixture(t);
	assert.deepEqual(RojoResolver.findRojoConfigFilePath(root), { path: undefined, warnings: [] });
	const legacy = write("roblox-project.json", {});
	assert.deepEqual(RojoResolver.findRojoConfigFilePath(root), { path: legacy, warnings: [] });
	write("other.project.json", {});
	assert.equal(RojoResolver.findRojoConfigFilePath(root).warnings.length, 1);
	const defaultPath = write("default.project.json", {});
	assert.deepEqual(RojoResolver.findRojoConfigFilePath(root), { path: defaultPath, warnings: [] });
});

test("loads the packaged schema and resolves optional mounts and explicit files", t => {
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

test("resolves nested projects inside mapped directories", t => {
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

test("reports schema errors and rejects malformed JSON", t => {
	const { write } = fixture(t);
	const invalid = write("invalid.project.json", { name: "invalid", tree: false });
	const resolver = RojoResolver.fromPath(invalid);
	assert.match(resolver.getWarnings()[0], /Invalid configuration/);
	assert.deepEqual(resolver.getPartitions(), []);

	fs.writeFileSync(invalid, "{");
	assert.throws(() => RojoResolver.fromPath(invalid), SyntaxError);
});

test("synthetic resolvers preserve extension and init mapping", t => {
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

test("classifies Lua and Luau scripts without treating data files as scripts", t => {
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

test("preserves network boundaries and isolated-container relations", t => {
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

test("relative paths use the exported parent symbol", () => {
	assert.deepEqual(RojoResolver.relative(["a", "b"], ["a", "c"]), [RbxPathParent, "c"]);
	assert.deepEqual(RojoResolver.relative(["a"], ["a", "b"]), ["b"]);
	assert.deepEqual(RojoResolver.relative(["a", "b"], []), [RbxPathParent, RbxPathParent]);
	assert.deepEqual(RojoResolver.relative(["a"], ["a"]), []);
});
