const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "../..");
const template = process.env.RBXTS_TEMPLATE_TYPE ?? "game";
const templates = {
	game: { source: "src/shared/module.ts", output: "out/shared/module.luau" },
	place: { source: "src/shared/module.ts", output: "out/shared/module.luau" },
	model: { source: "src/index.server.ts", output: "out/init.server.luau" },
	plugin: { source: "src/index.server.ts", output: "out/init.server.luau" },
	package: { source: "src/index.ts", output: "out/init.luau" },
};

function readJson(file) {
	return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
	fs.writeFileSync(file, JSON.stringify(value, undefined, "\t") + "\n");
}

function run(command, args, cwd, expectedStatus = 0, binDirectory) {
	const result = spawnSync(command, args, {
		cwd,
		encoding: "utf8",
		timeout: 180_000,
		maxBuffer: 16 * 1024 * 1024,
		// only the fixed-argument Corepack bootstrap needs a shell to launch corepack.cmd on Windows
		shell: process.platform === "win32" && command === "corepack",
		env: {
			...process.env,
			// do not let global modules satisfy an installed package's missing dependency
			NODE_PATH: "",
			PATH: [binDirectory, path.dirname(process.execPath), process.env.PATH].filter(Boolean).join(path.delimiter),
		},
	});
	assert.equal(
		result.status,
		expectedStatus,
		`${command} ${args.join(" ")} (cwd: ${cwd})\n${result.error ?? ""}\n${result.stdout}\n${result.stderr}`,
	);
	return result.stdout;
}

function filesUnder(directory) {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const file = path.join(directory, entry.name);
		return entry.isDirectory() ? filesUnder(file) : [file];
	});
}

function installedManifest(from, name) {
	return createRequire(from).resolve(`${name}/package.json`);
}

function binFrom(manifestPath, command) {
	const manifest = readJson(manifestPath);
	assert.equal(typeof manifest.bin[command], "string", `${manifest.name} must provide ${command}`);
	return path.resolve(path.dirname(manifestPath), manifest.bin[command]);
}

void test(`local generator, compiler, and lint plugin work together for ${template}`, { timeout: 900_000 }, () => {
	assert.ok(Object.hasOwn(templates, template), `unknown RBXTS_TEMPLATE_TYPE: ${template}`);
	const workspace = readJson(path.join(root, "package.json"));
	const pnpmVersion = workspace.packageManager.slice("pnpm@".length).split("+")[0];

	// macOS exposes its temporary directory through a symlink; parser and compiler paths must agree
	const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "rbxts-local-toolchain-")));
	try {
		// the generator invokes pnpm by name; Corepack shims live only in this test's temporary directory
		const binDirectory = path.join(temporary, "bin");
		fs.mkdirSync(binDirectory);
		run("corepack", ["enable", "--install-directory", ".", "pnpm"], binDirectory);
		writeJson(path.join(temporary, "package.json"), {
			private: true,
			packageManager: workspace.packageManager,
			scripts: { "pnpm-entry": "node -p process.env.npm_execpath" },
		});
		// use pnpm's actual JavaScript entrypoint so paths with spaces need no shell quoting on Windows
		const pnpmEntry = run("corepack", ["pnpm", "run", "--silent", "pnpm-entry"], temporary).trim();
		assert.ok(path.isAbsolute(pnpmEntry) && fs.existsSync(pnpmEntry), `invalid pnpm entrypoint: ${pnpmEntry}`);
		function pnpm(args, cwd) {
			return run(process.execPath, [pnpmEntry, ...args], cwd, 0, binDirectory);
		}
		assert.equal(pnpm(["--version"], root).trim(), pnpmVersion, "use the workspace's pinned pnpm");

		const packages = new Map();
		for (const [directory, contents] of [
			["compiler-types", ["types"]],
			["luau-ast", ["out"]],
			["path-translator", ["out"]],
			["rojo-resolver", ["out"]],
			["roblox-ts", ["out", "include"]],
			["cli", ["out"]],
			["create-roblox-ts", ["out", "templates"]],
			["eslint-plugin-roblox-ts", ["dist"]],
		]) {
			const source = path.join(root, "packages", directory);
			const manifest = readJson(path.join(source, "package.json"));
			const tarball = path.join(temporary, `${directory}.tgz`);
			for (const content of contents) {
				assert.ok(
					fs.existsSync(path.join(source, content)),
					`run corepack pnpm run build first: missing ${source}/${content}`,
				);
			}
			pnpm(["--filter", manifest.name, "pack", "--out", tarball], root);
			packages.set(manifest.name, { source, manifest, contents, tarball });
		}

		// pnpm file specs are paths, not percent-encoded URLs; normalize Windows separators but preserve spaces
		const overrides = Object.fromEntries(
			[...packages].map(([name, pkg]) => [name, `file:${pkg.tarball.split(path.sep).join("/")}`]),
		);
		const lintManifest = path.join(packages.get("eslint-plugin-roblox-ts").source, "package.json");
		const compilerManifest = path.join(packages.get("roblox-ts").source, "package.json");
		Object.assign(overrides, {
			"@rbxts/types": readJson(installedManifest(path.join(root, "package.json"), "@rbxts/types")).version,
			typescript: readJson(installedManifest(compilerManifest, "typescript")).version,
			eslint: readJson(installedManifest(lintManifest, "eslint")).version,
			"@typescript-eslint/parser": readJson(installedManifest(lintManifest, "@typescript-eslint/parser")).version,
		});

		function prepare(directory) {
			fs.mkdirSync(directory);
			// pnpm reads JSON as YAML; overrides apply to the generator's own install and to transitive dependencies
			// a hoisted layout keeps the templates' node_modules/@rbxts typeRoots intact without changing tsconfig
			writeJson(path.join(directory, "pnpm-workspace.yaml"), {
				packages: ["."],
				nodeLinker: "hoisted",
				// pnpm init otherwise pins the registry's latest pnpm instead of the workspace version
				initPackageManager: false,
				ignoreScripts: true,
				storeDir: path.join(temporary, "store"),
				overrides,
			});
		}

		const verified = new Set();
		function verifyLocalPackage(from, name) {
			const manifestPath = installedManifest(from, name);
			const installed = path.dirname(fs.realpathSync(manifestPath));
			assert.ok(
				installed.startsWith(fs.realpathSync(temporary) + path.sep),
				`${name} escaped the temporary install`,
			);
			if (verified.has(installed)) {
				return manifestPath;
			}
			verified.add(installed);

			const pkg = packages.get(name);
			const manifest = readJson(manifestPath);
			assert.equal(manifest.name, name);
			assert.equal(manifest.version, pkg.manifest.version);
			// versions alone cannot distinguish an unpublished local change from the registry release
			for (const content of pkg.contents) {
				for (const file of filesUnder(path.join(pkg.source, content))) {
					if (file.endsWith(".map") || file.endsWith(".tsbuildinfo")) {
						continue;
					}
					const relative = path.relative(pkg.source, file);
					assert.deepEqual(
						fs.readFileSync(path.join(installed, relative)),
						fs.readFileSync(file),
						`${name}/${relative}`,
					);
				}
			}
			for (const dependency of Object.keys(manifest.dependencies ?? {})) {
				if (packages.has(dependency)) {
					verifyLocalPackage(manifestPath, dependency);
				}
			}
			return manifestPath;
		}

		const tool = path.join(temporary, "tool");
		prepare(tool);
		const toolManifest = path.join(tool, "package.json");
		writeJson(toolManifest, {
			name: "local-generator-test",
			private: true,
			packageManager: workspace.packageManager,
			dependencies: { "create-roblox-ts": overrides["create-roblox-ts"] },
		});
		pnpm(["install", "--no-frozen-lockfile"], tool);
		const generator = verifyLocalPackage(toolManifest, "create-roblox-ts");

		const project = path.join(temporary, "project");
		prepare(project);
		run(
			process.execPath,
			[
				binFrom(generator, "create-roblox-ts"),
				template,
				"--yes",
				"--dir",
				project,
				"--packageManager",
				"pnpm",
				"--no-git",
				"--no-eslint",
				"--no-prettier",
				"--no-vscode",
				"--skipBuild",
			],
			temporary,
			0,
			binDirectory,
		);
		// the generated script needs the split CLI; lint uses the plugin's current flat-config API
		pnpm(
			[
				"add",
				"--save-dev",
				overrides["@roblox-ts/cli"],
				overrides["eslint-plugin-roblox-ts"],
				`eslint@${overrides.eslint}`,
				`@typescript-eslint/parser@${overrides["@typescript-eslint/parser"]}`,
			],
			project,
		);

		const projectManifest = path.join(project, "package.json");
		const cli = verifyLocalPackage(projectManifest, "@roblox-ts/cli");
		verifyLocalPackage(projectManifest, "roblox-ts");
		verifyLocalPackage(projectManifest, "@rbxts/compiler-types");
		verifyLocalPackage(projectManifest, "eslint-plugin-roblox-ts");
		assert.equal(readJson(projectManifest).scripts.build, "rbxtsc");

		const sourcePath = path.join(project, templates[template].source);
		const generatedSource = fs.readFileSync(sourcePath, "utf8");
		const checkSource = [
			"",
			"function toolchainHasValue(value: number) {",
			"\tif (value) {",
			'\t\tprint("local toolchain");',
			"\t}",
			"}",
			"toolchainHasValue(1);",
			"",
		].join("\n");
		fs.writeFileSync(sourcePath, generatedSource + checkSource);
		fs.writeFileSync(
			path.join(project, "eslint.config.mjs"),
			`import parser from "@typescript-eslint/parser";
import plugin from "eslint-plugin-roblox-ts";

export default [{
	files: ["src/**/*.ts"],
	languageOptions: {
		parser,
		parserOptions: { project: "./tsconfig.json", tsconfigRootDir: ${JSON.stringify(project)} },
	},
	plugins: { "roblox-ts": plugin },
	rules: { "roblox-ts/lua-truthiness": "error" },
}];
`,
		);
		const eslint = binFrom(installedManifest(projectManifest, "eslint"), "eslint");
		const lintArgs = [eslint, "--config", "eslint.config.mjs", "--format", "json", "src/**/*.ts"];
		const lint = JSON.parse(run(process.execPath, lintArgs, project, 1));
		const messages = lint.flatMap(result =>
			result.messages.map(message => ({ file: result.filePath, ...message })),
		);
		assert.equal(messages.length, 1, JSON.stringify(lint, undefined, 2));
		assert.equal(fs.realpathSync(messages[0].file), fs.realpathSync(sourcePath));
		assert.equal(messages[0].ruleId, "roblox-ts/lua-truthiness");
		assert.equal(messages[0].messageId, "falsy-string-number-check");
		assert.equal(messages[0].line, generatedSource.split("\n").length + 2);

		fs.writeFileSync(sourcePath, generatedSource + checkSource.replace("if (value)", "if (value !== 0)"));
		const cleanLint = JSON.parse(run(process.execPath, lintArgs, project));
		assert.ok(
			cleanLint.every(result => result.messages.length === 0),
			JSON.stringify(cleanLint, undefined, 2),
		);

		// invoke the installed manifest's bin, never npx or a PATH-resolved compiler from the parent workspace
		run(process.execPath, [binFrom(cli, "rbxtsc")], project);
		const output = fs.readFileSync(path.join(project, templates[template].output), "utf8");
		assert.match(output, /print\("local toolchain"\)/);
		assert.match(output, /if value ~= 0 then/);
		assert.match(output, /toolchainHasValue\(1\)/);
		if (template === "package") {
			assert.match(
				fs.readFileSync(path.join(project, "out/index.d.ts"), "utf8"),
				/makeHello\(name: string\): string/,
			);
		} else {
			for (const file of ["RuntimeLib.luau", "Promise.luau"]) {
				assert.deepEqual(
					fs.readFileSync(path.join(project, "include", file)),
					fs.readFileSync(path.join(packages.get("roblox-ts").source, "include", file)),
					`generated project must include the local ${file}`,
				);
			}
		}
		if (template === "game" || template === "place") {
			for (const side of ["client", "server"]) {
				assert.match(fs.readFileSync(path.join(project, `out/${side}/main.${side}.luau`), "utf8"), /makeHello/);
			}
		}
	} finally {
		fs.rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
	}
});
