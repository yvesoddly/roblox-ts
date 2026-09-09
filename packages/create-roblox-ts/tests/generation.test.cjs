const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");

function fixture(t) {
	const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "create-roblox-ts-"));
	t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
	const directory = path.join(temporary, "project");
	const log = path.join(temporary, "commands.log");
	return {
		directory,
		read: name => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8")),
		commands: () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n") : []),
		run: (args, env = {}) =>
			spawnSync(
				process.execPath,
				[
					"--require",
					path.join(__dirname, "mock-commands.cjs"),
					path.join(root, "out/index.js"),
					...args,
					"--dir",
					directory,
				],
				{
					cwd: temporary,
					encoding: "utf8",
					timeout: 30_000,
					env: { ...process.env, CREATE_ROBLOX_TS_COMMAND_LOG: log, ...env },
				},
			),
	};
}

function assertTemplate(directory, template) {
	const source = path.join(root, "templates", template);
	for (const entry of fs.readdirSync(source, { recursive: true, withFileTypes: true })) {
		if (entry.isFile()) {
			const file = path.join(entry.parentPath, entry.name);
			assert.deepEqual(fs.readFileSync(path.join(directory, path.relative(source, file))), fs.readFileSync(file));
		}
	}
}

for (const template of ["game", "place", "model", "plugin", "package"]) {
	test(`generates ${template} with recommended options`, t => {
		const project = fixture(t);
		const result = project.run([template, "-y", "--git", "--packageManager", "npm"]);
		assert.equal(result.status, 0, result.stdout + result.stderr);
		assertTemplate(project.directory, template === "place" ? "game" : template);
		const pkg = project.read("package.json");
		assert.equal(pkg.scripts.build, "rbxtsc");
		assert.equal(pkg.scripts.watch, "rbxtsc -w");
		if (template === "package") {
			assert.equal(pkg.name, "@rbxts/generated-project");
			assert.equal(pkg.main, "out/init.lua");
			assert.equal(pkg.types, "out/index.d.ts");
			assert.deepEqual(pkg.files, ["out", "!**/*.tsbuildinfo"]);
			assert.deepEqual(pkg.publishConfig, { access: "public" });
			assert.equal(pkg.scripts.prepublishOnly, "npm run build");
		}
		assert.deepEqual(project.commands(), [
			"npm init -y",
			"git init",
			"npm install --silent -D roblox-ts @rbxts/compiler-types @rbxts/types typescript prettier eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-roblox-ts eslint-config-prettier eslint-plugin-prettier",
			"npm run build",
		]);
		assert.equal(project.read(".eslintrc").rules["prettier/prettier"], "warn");
		assert.equal(project.read(".prettierrc").useTabs, true);
		assert.equal(project.read(".vscode/settings.json")["eslint.useFlatConfig"], false);
		assert.deepEqual(project.read(".vscode/extensions.json").recommendations, [
			"roblox-ts.vscode-roblox-ts",
			"dbaeumer.vscode-eslint",
		]);
		assert.equal(
			fs.readFileSync(path.join(project.directory, ".gitignore"), "utf8"),
			"/node_modules\n/out\n/include\n*.tsbuildinfo\n",
		);
	});
}

for (const manager of ["npm", "pnpm", "yarn"]) {
	test(`supports ${manager}, version selection, init alias and skipped build`, t => {
		const project = fixture(t);
		const result = project.run([
			"init",
			"game",
			"-y",
			"--no-git",
			"--no-eslint",
			"--no-prettier",
			"--no-vscode",
			"--skipBuild",
			"--compilerVersion",
			"2.3.0",
			"--packageManager",
			manager,
		]);
		assert.equal(result.status, 0, result.stdout + result.stderr);
		assert.deepEqual(project.commands(), [
			`${manager} init${manager === "pnpm" ? "" : " -y"}`,
			`${manager} ${manager === "yarn" ? "add" : "install"} --silent -D roblox-ts@2.3.0 @rbxts/compiler-types@compiler-2.3.0 @rbxts/types typescript`,
		]);
		for (const file of [".gitignore", ".eslintrc", ".prettierrc", ".vscode"]) {
			assert.equal(fs.existsSync(path.join(project.directory, file)), false);
		}
	});
}

test("refuses to overwrite an existing project before running commands", t => {
	const project = fixture(t);
	fs.mkdirSync(project.directory);
	const existing = '{"name":"keep-me"}';
	fs.writeFileSync(path.join(project.directory, "package.json"), existing);
	const result = project.run(["game", "-y", "--packageManager", "npm"]);
	assert.equal(result.status, 1);
	assert.match(result.stdout + result.stderr, /Cannot initialize project, process could overwrite/);
	assert.equal(fs.readFileSync(path.join(project.directory, "package.json"), "utf8"), existing);
	assert.deepEqual(project.commands(), []);
});

test("rejects an invalid compiler version before running commands", t => {
	const project = fixture(t);
	const result = project.run(["game", "-y", "--compilerVersion", "latest"]);
	assert.equal(result.status, 1);
	assert.match(result.stdout + result.stderr, /Invalid --compilerVersion/);
	assert.deepEqual(project.commands(), []);
});

test("reports failed commands and does not continue generation", t => {
	const project = fixture(t);
	const result = project.run(["game", "-y", "--packageManager", "npm"], {
		CREATE_ROBLOX_TS_FAIL_COMMAND: "npm init -y",
	});
	assert.equal(result.status, 1);
	assert.match(result.stdout + result.stderr, /exited with code 1/);
	assert.deepEqual(project.commands(), ["npm init -y"]);
	assert.equal(fs.existsSync(path.join(project.directory, "src")), false);
});
