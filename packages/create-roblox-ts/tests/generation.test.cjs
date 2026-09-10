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
		availableManagers(managers) {
			const bin = path.join(temporary, "bin");
			fs.mkdirSync(bin);
			for (const manager of managers) {
				fs.writeFileSync(path.join(bin, manager + (process.platform === "win32" ? ".cmd" : "")), "", {
					mode: 0o755,
				});
			}
			return { PATH: bin, Path: bin, PATHEXT: ".CMD" };
		},
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
			assert.equal(pkg.main, "out/init.luau");
			assert.equal(pkg.types, "out/index.d.ts");
			assert.deepEqual(pkg.files, ["out", "!**/*.tsbuildinfo"]);
			assert.deepEqual(pkg.publishConfig, { access: "public" });
			assert.equal(pkg.scripts.prepublishOnly, "npm run build");
		}
		assert.deepEqual(project.commands(), [
			"npm init -y",
			"git init",
			"npm install --silent -D roblox-ts @rbxts/compiler-types @rbxts/types typescript prettier eslint@8.57.1 @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-roblox-ts eslint-config-prettier eslint-plugin-prettier",
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

for (const [version, main] of [
	["2.3.0", "out/init.lua"],
	["3.0.0", "out/init.luau"],
]) {
	test(`package entry point matches compiler ${version} even when build is skipped`, t => {
		const project = fixture(t);
		const result = project.run([
			"package",
			"-y",
			"--no-git",
			"--no-eslint",
			"--no-prettier",
			"--no-vscode",
			"--skipBuild",
			"--compilerVersion",
			version,
			"--packageManager",
			"npm",
		]);
		assert.equal(result.status, 0, result.stdout + result.stderr);
		assert.equal(project.read("package.json").main, main);
		assert.deepEqual(project.commands(), [
			"npm init -y",
			`npm install --silent -D roblox-ts@${version} @rbxts/compiler-types@compiler-${version} @rbxts/types typescript`,
		]);
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

for (const manager of ["npm", "pnpm", "yarn"]) {
	for (const recommended of [false, true]) {
		test(`uses the only available manager ${manager} with recommended options ${recommended}`, t => {
			const project = fixture(t);
			const result = project.run(
				["game", ...(recommended ? ["-y"] : []), "--no-git", "--no-eslint", "--no-prettier", "--no-vscode"],
				project.availableManagers([manager]),
			);
			assert.equal(result.status, 0, result.stdout + result.stderr);
			assert.deepEqual(project.commands(), [
				`${manager} init${manager === "pnpm" ? "" : " -y"}`,
				`${manager} ${manager === "yarn" ? "add" : "install"} --silent -D roblox-ts @rbxts/compiler-types @rbxts/types typescript`,
				`${manager} run build`,
			]);
		});
	}
}

test("keeps explicit package manager selection even when another manager is detected", t => {
	const project = fixture(t);
	const result = project.run(["game", "-y", "--packageManager", "yarn"], project.availableManagers(["npm"]));
	assert.equal(result.status, 0, result.stdout + result.stderr);
	assert.ok(project.commands().every(command => command.startsWith("yarn ")));
});

test("reports when no package manager is available before running commands", t => {
	const project = fixture(t);
	const result = project.run(["game", "-y"], project.availableManagers([]));
	assert.equal(result.status, 1);
	assert.match(result.stdout + result.stderr, /No supported package manager found/);
	assert.deepEqual(project.commands(), []);
});

for (const file of ["package.json", "package-lock.json", "pnpm-lock.yaml"]) {
	test(`refuses to overwrite existing ${file} before running commands`, t => {
		const project = fixture(t);
		fs.mkdirSync(project.directory);
		const existing = file === "package.json" ? '{"name":"keep-me"}' : "keep-me\n";
		fs.writeFileSync(path.join(project.directory, file), existing);
		const result = project.run(["game", "-y", "--packageManager", "pnpm"]);
		assert.equal(result.status, 1);
		assert.match(result.stdout + result.stderr, /Cannot initialize project, process could overwrite/);
		assert.ok((result.stdout + result.stderr).includes(file));
		assert.equal(fs.readFileSync(path.join(project.directory, file), "utf8"), existing);
		assert.deepEqual(project.commands(), []);
	});
}

for (const directory of ["src", ".vscode"]) {
	for (const dangling of [false, true]) {
		test(`refuses ${dangling ? "dangling" : "empty"} ${directory} directory links before running commands`, t => {
			const project = fixture(t);
			fs.mkdirSync(project.directory);
			const target = path.join(project.directory, "..", "outside");
			fs.mkdirSync(target);
			const link = path.join(project.directory, directory);
			fs.symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
			if (dangling) {
				fs.rmdirSync(target);
			}

			const result = project.run(["game", "-y", "--packageManager", "npm"]);
			assert.equal(result.status, 1);
			assert.match(result.stdout + result.stderr, /Cannot initialize project, process could overwrite/);
			assert.ok((result.stdout + result.stderr).includes(directory));
			assert.deepEqual(project.commands(), []);
			assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
			if (dangling) {
				assert.equal(fs.existsSync(target), false);
			} else {
				assert.deepEqual(fs.readdirSync(target), []);
			}
		});
	}
}

test("allows empty template directories and unrelated vscode files", t => {
	const project = fixture(t);
	fs.mkdirSync(path.join(project.directory, "src"), { recursive: true });
	fs.mkdirSync(path.join(project.directory, ".vscode"));
	fs.writeFileSync(path.join(project.directory, ".vscode", "keep.txt"), "keep-me");
	const result = project.run(["game", "-y", "--packageManager", "npm"]);
	assert.equal(result.status, 0, result.stdout + result.stderr);
	assert.equal(fs.readFileSync(path.join(project.directory, ".vscode", "keep.txt"), "utf8"), "keep-me");
	assertTemplate(project.directory, "game");
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
