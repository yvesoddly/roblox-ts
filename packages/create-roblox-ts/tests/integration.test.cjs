const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

// port the upstream CI matrix, exercising the packed package instead of the source tree
// this intentionally installs current registry dependencies and requires network access
test("packed CLI generates and builds every upstream project type", { timeout: 900_000 }, async t => {
	const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "create-roblox-ts-integration-"));
	t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
	const root = path.resolve(__dirname, "..");
	const npm = process.env.npm_execpath;
	assert.ok(npm, "run this test through npm run test:integration");

	function run(args, cwd) {
		const result = spawnSync(process.execPath, args, { cwd, encoding: "utf8", timeout: 180_000 });
		assert.equal(result.status, 0, `${result.error ?? ""}\n${result.stdout}\n${result.stderr}`);
		return result.stdout;
	}

	const packed = JSON.parse(run([npm, "pack", "--json", "--pack-destination", temporary], root))[0];
	assert.equal(packed.name, "create-roblox-ts");
	assert.equal(packed.version, require("../package.json").version);
	for (const file of ["out/index.js", "out/commands/init.js", "LICENSE", "templates/game/tsconfig.json"]) {
		assert.ok(
			packed.files.some(entry => entry.path === file),
			`missing packed asset: ${file}`,
		);
	}
	const tool = path.join(temporary, "tool");
	fs.mkdirSync(tool);
	run(
		[
			npm,
			"install",
			"--prefix",
			tool,
			"--ignore-scripts",
			"--no-audit",
			"--no-fund",
			path.join(temporary, packed.filename),
		],
		temporary,
	);
	const cli = path.join(tool, "node_modules/create-roblox-ts/out/index.js");
	assert.equal(run([cli, "--version"], temporary).trim(), packed.version);

	for (const template of ["game", "place", "model", "plugin", "package"]) {
		await t.test(template, () => {
			const directory = path.join(temporary, template);
			run([cli, template, "-y", "--packageManager", "npm", "--dir", directory], temporary);
			const pkg = JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8"));
			assert.equal(pkg.scripts.build, "rbxtsc");
			assert.ok(fs.existsSync(path.join(directory, "tsconfig.json")));
			assert.ok(
				fs
					.readdirSync(path.join(directory, "out"), { recursive: true })
					.some(file => /\.(lua|luau)$/.test(file)),
			);
			if (template === "package") {
				assert.equal(pkg.main, "out/init.luau");
				assert.ok(fs.existsSync(path.join(directory, pkg.main)), `missing package main: ${pkg.main}`);
				assert.ok(fs.existsSync(path.join(directory, pkg.types)), `missing package types: ${pkg.types}`);
			}
		});
	}
});
