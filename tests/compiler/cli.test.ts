import { spawnSync } from "child_process";
import fs from "fs-extra";
import path from "path";
import { COMPILER_VERSION } from "Shared/constants";
import { stripVTControlCharacters } from "util";

import { TEST_ROOT } from "./constants";
import { ReferenceFixture } from "./referenceFixture";

const CLI_PATH = require.resolve("@roblox-ts/cli/out/cli.js");
const DEVLINK_PATH = path.join(TEST_ROOT, "..", "devlink/rbxtsc-dev.js");
const FILESYSTEM_ROOT = path.parse(TEST_ROOT).root;
const LOOP_SOURCE = "export const value = 1; for (let i = 0; i < 3; i++) { print(i); }";
const HIDDEN_FLAGS = ["write-only-changed", "write-transformed-files", "optimized-loops", "allow-comment-directives"];

function runCli(args: Array<string>, cwd = FILESYSTEM_ROOT, entrypoint = CLI_PATH) {
	const result = spawnSync(process.execPath, [entrypoint, ...args], {
		cwd,
		encoding: "utf8",
		env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: undefined },
		timeout: 15000,
		killSignal: "SIGKILL",
	});
	const output = stripVTControlCharacters(`${result.stdout ?? ""}${result.stderr ?? ""}`).trim();

	// a hung watcher or unresolved effect must fail instead of leaking beyond fixture cleanup
	expect(result.error, output).toBeUndefined();
	expect(result.signal, output).toBeNull();

	return { status: result.status, output };
}

function runBuild(args: Array<string>, cwd = FILESYSTEM_ROOT, entrypoint = CLI_PATH) {
	return runCli(["build", ...args], cwd, entrypoint);
}

function expectExit(result: ReturnType<typeof runCli>, status = 0) {
	expect(result.status, result.output).toBe(status);
}

function expectFailureOnce(result: ReturnType<typeof runCli>, message: string) {
	expectExit(result, 1);
	expect(result.output.split(message)).toHaveLength(2);
	expect(result.output).not.toMatch(/\n\s+at |FiberFailure|\[object Object\]/);
}

describe("build", () => {
	let fixture: ReferenceFixture;
	beforeEach(() => {
		fixture = new ReferenceFixture();
		fixture.project("game");
		fixture.write("game/src/index.ts", LOOP_SOURCE);
		setOptions();
	});
	afterEach(() => fixture.close());

	function setOptions(options: Record<string, unknown> = {}) {
		const config = fs.readJsonSync(fixture.file("game/tsconfig.json"));
		fixture.json("game/tsconfig.json", {
			...config,
			rbxts: { rojo: "../default.project.json", includePath: "../include", ...options },
		});
	}

	it.each([
		{ name: "current directory", args: [], cwd: "game" },
		{ name: "directory path", args: ["--project", "game"], cwd: "." },
		{ name: "config file path", args: ["--project", "game/tsconfig.json"], cwd: "." },
		{ name: "upward discovery from the current directory", args: [], cwd: "game/src/nested" },
		{ name: "nonexistent starting path", args: ["-p", "game/missing/nested"], cwd: "." },
	])("supports $name", ({ args, cwd }) => {
		fs.ensureDirSync(fixture.file("game/src/nested"));

		expectExit(runBuild(args, fixture.file(cwd)));
		expect(fixture.read("out/game/init.luau")).toContain("for i = 0, 2 do");
		expect(fs.existsSync(fixture.file("out/game/init.lua"))).toBe(false);
		expect(fs.existsSync(fixture.file("include/RuntimeLib.luau"))).toBe(true);
	});

	it("shows usage instead of building the current project without a subcommand", () => {
		const result = runCli([], fixture.file("game"));

		expectExit(result);
		expect(result.output).toContain("rbxtsc <subcommand>");
		expect(fs.existsSync(fixture.file("out/game/init.luau"))).toBe(false);
		expect(fs.existsSync(fixture.file("include/RuntimeLib.luau"))).toBe(false);
	});

	it("accepts an existing config file with a custom filename", () => {
		fs.renameSync(fixture.file("game/tsconfig.json"), fixture.file("game/custom.json"));

		expectExit(runBuild(["-p", "game/custom.json"], fixture.directory));
		expect(fixture.read("out/game/init.luau")).toContain("value = 1");
	});

	it("lets explicit false override compiler defaults", () => {
		expectExit(runBuild(["--luau=false", "--optimized-loops", "false"], fixture.file("game")));

		expect(fixture.read("out/game/init.lua")).toContain("while true do");
		expect(fs.existsSync(fixture.file("out/game/init.luau"))).toBe(false);
		expect(fs.existsSync(fixture.file("include/RuntimeLib.lua"))).toBe(true);
	});

	it("preserves omitted rbxts settings and overrides them only when supplied", () => {
		setOptions({ luau: false, optimizedLoops: false, noInclude: true });

		expectExit(runBuild([], fixture.file("game")));
		expect(fixture.read("out/game/init.lua")).toContain("while true do");
		expect(fs.existsSync(fixture.file("out/game/init.luau"))).toBe(false);
		expect(fs.existsSync(fixture.file("include/RuntimeLib.lua"))).toBe(false);

		expectExit(runBuild(["--luau", "true", "--optimized-loops=true", "--no-include=false"], fixture.file("game")));
		expect(fixture.read("out/game/init.luau")).toContain("for i = 0, 2 do");
		expect(fs.existsSync(fixture.file("out/game/init.lua"))).toBe(false);
		expect(fs.existsSync(fixture.file("include/RuntimeLib.luau"))).toBe(true);
	});

	it.each(["--include-path", "-i"])("applies %s using invocation-relative paths", include => {
		fixture.rojo({ include: { $path: "runtime files" } });
		fs.renameSync(fixture.file("default.project.json"), fixture.file("selected.project.json"));
		fixture.write("game/src/index.ts", "export function check(value: number) { if (value) { print(value); } }");

		const result = runBuild(
			[
				"-p",
				"game",
				include,
				"runtime files",
				"--rojo",
				"selected.project.json",
				"--no-include",
				"--log-truthy-changes",
				"--verbose",
			],
			fixture.directory,
		);

		expectExit(result);
		expect(result.output).toContain("compiling as game..");
		expect(result.output).toContain("Value will be checked against 0, NaN");
		expect(fixture.read("out/game/init.luau")).toContain("value ~= 0");
		expect(fs.existsSync(fixture.file("runtime files/RuntimeLib.luau"))).toBe(false);
	});

	it.each(["game", "model", "package"])("accepts the %s project type override", type => {
		const result = runBuild(["--type", type, "--verbose"], fixture.file("game"));

		expectExit(result);
		expect(result.output).toContain(`compiling as ${type}..`);
		expect(fixture.read("out/game/init.luau")).toContain("value = 1");
	});

	it("accepts hidden flags and applies transformed-file and directive options", () => {
		const config = fs.readJsonSync(fixture.file("game/tsconfig.json"));
		config.compilerOptions.plugins = [{ transform: "../plugin.cjs" }];
		fixture.json("game/tsconfig.json", config);
		fixture.write("plugin.cjs", "module.exports = () => () => source => source;");
		fixture.write("game/src/index.ts", `// @ts-ignore\n${LOOP_SOURCE}`);

		expectExit(
			runBuild(
				[
					"--write-only-changed",
					"--write-transformed-files",
					"--allow-comment-directives",
					"--optimized-loops=false",
				],
				fixture.file("game"),
			),
		);
		expect(fixture.read("out/game/index.transformed.ts")).toContain("export const value = 1;");
		expect(fixture.read("out/game/init.luau")).toContain("while true do");
	});

	it.each([
		["--use-polling", "--watch=false"],
		["--use-polling=false", "-w", "false"],
		["--no-use-polling", "--no-watch"],
	])("requires watch to be supplied, not enabled: %j", (...args) => {
		expectExit(runBuild(args, fixture.file("game")));
		expect(fixture.read("out/game/init.luau")).toContain("value = 1");
	});

	it("applies native boolean negation", () => {
		const args = ["--no-optimized-loops", "--no-log-truthy-changes", "--no-write-transformed-files"];
		setOptions({ optimizedLoops: true, logTruthyChanges: true, writeTransformedFiles: true });
		const config = fs.readJsonSync(fixture.file("game/tsconfig.json"));
		config.compilerOptions.plugins = [{ transform: "../plugin.cjs" }];
		fixture.json("game/tsconfig.json", config);
		fixture.write("plugin.cjs", "module.exports = () => () => source => source;");
		fixture.write(
			"game/src/index.ts",
			`${LOOP_SOURCE}\nexport function check(value: number) { if (value) { print(value); } }`,
		);

		const result = runBuild(args, fixture.file("game"));

		expectExit(result);
		expect(fixture.read("out/game/init.luau")).toContain("while true do");
		expect(result.output).not.toContain("Value will be checked against");
		expect(fs.existsSync(fixture.file("out/game/index.transformed.ts"))).toBe(false);
	});

	it("applies negated write-only-changed to identical runtime files", () => {
		setOptions({ writeOnlyChanged: true });
		expectExit(runBuild([], fixture.file("game")));
		const runtimePath = fixture.file("include/RuntimeLib.luau");
		const oldTime = new Date("2000-01-01T00:00:00Z");
		fs.utimesSync(runtimePath, oldTime, oldTime);

		expectExit(runBuild(["--no-write-only-changed"], fixture.file("game")));

		expect(fs.statSync(runtimePath).mtimeMs).toBeGreaterThan(oldTime.getTime());
	});

	it.each(["--no-include=false", "--no-no-include"])("overrides configured noInclude with %s", flag => {
		setOptions({ noInclude: true });

		expectExit(runBuild([flag], fixture.file("game")));

		expect(fs.existsSync(fixture.file("include/RuntimeLib.luau"))).toBe(true);
	});

	it("applies negated allow-comment-directives", () => {
		setOptions({ allowCommentDirectives: true });
		fixture.write("game/src/index.ts", `// @ts-ignore\n${LOOP_SOURCE}`);

		const result = runBuild(["--no-allow-comment-directives"], fixture.file("game"));

		expectFailureOnce(result, "Usage of `@ts-ignore`, `@ts-expect-error`, and `@ts-nocheck` are not supported!");
	});

	it.each(["configuration", "source"])("flushes all piped %s diagnostics before failing", kind => {
		const count = 1000;
		let code: string;
		let lastMessage: string;
		if (kind === "configuration") {
			const config = fs.readJsonSync(fixture.file("game/tsconfig.json"));
			for (let i = 0; i < count; i++) {
				config.compilerOptions[`invalidOption${i}`] = true;
			}
			fixture.json("game/tsconfig.json", config);
			code = "TS5023";
			lastMessage = `Unknown compiler option 'invalidOption${count - 1}'.`;
		} else {
			fixture.write(
				"game/src/index.ts",
				Array.from({ length: count }, (_, i) => `export const value${i}: ${i} = "wrong";`).join("\n"),
			);
			code = "TS2322";
			lastMessage = `Type '"wrong"' is not assignable to type '${count - 1}'.`;
		}

		const result = runBuild([], fixture.file("game"));

		expectFailureOnce(result, lastMessage);
		expect(result.output.match(new RegExp(code, "g"))).toHaveLength(count);
		expect(result.output.length).toBeGreaterThan(65536);
	});

	it("prints compiler diagnostics once and exits unsuccessfully", () => {
		fixture.write("game/src/index.ts", 'export const value: number = "wrong";');
		const result = runBuild([], fixture.file("game"));

		expectFailureOnce(result, "TS2322");
		expect(result.output).toContain("Type 'string' is not assignable to type 'number'");
		expect(result.output).toContain("src/index.ts");
		expect(fs.existsSync(fixture.file("out/game/init.luau"))).toBe(false);
	});

	it("prints loggable configuration failures without an Effect stack", () => {
		setOptions({ luau: "false" });

		expectFailureOnce(runBuild([], fixture.file("game")), '"luau" must be a boolean');
	});

	it("builds through the CommonJS devlink entrypoint", () => {
		expectExit(runBuild(["-p", "game"], fixture.directory, DEVLINK_PATH));
		expect(fixture.read("out/game/init.luau")).toContain("for i = 0, 2 do");
	});
});

describe("argument handling", () => {
	it("reports the exact missing-config message when discovery exhausts the filesystem root", () => {
		const result = runBuild(["-p", FILESYSTEM_ROOT]);

		expectFailureOnce(result, "Unable to find tsconfig.json!");
		expect(result.output).toMatch(/Unable to find tsconfig\.json!$/);
	});

	it.each(["--use-polling", "--use-polling=false", "--no-use-polling"])(
		"rejects %s without a supplied watch flag",
		polling => {
			const result = runBuild([polling]);

			expectFailureOnce(result, "use-polling -> watch");
			expect(result.output).not.toContain("Unrecognized flag");
			expect(result.output).not.toContain("Unable to find tsconfig.json!");
		},
	);

	it.each([
		{ args: ["--unknown-option"], message: "unknown-option" },
		{ args: ["build", "--type", "place"], message: "place" },
		{ args: ["build", "--luau=maybe"], message: "maybe" },
		{ args: ["build", "--optimized-loops=maybe"], message: "maybe" },
		{ args: ["build", "--no-optimized-loops=maybe"], message: "maybe" },
		{ args: ["build", "--no-optimized-loops=false"], message: "omit the value" },
		{ args: ["build", "--project"], message: "project" },
		{ args: ["build", "--include-path"], message: "include-path" },
		{ args: ["build", "extra.ts"], message: "extra.ts" },
		{ args: ["buidl"], message: "buidl" },
		{ args: ["-p", ".", "build"], message: "-p" },
	])("rejects invalid arguments $args", ({ args, message }) => {
		const result = runCli(args);

		expectExit(result, 1);
		expect(result.output).toContain(message);
		expect(result.output).not.toContain("Unable to find tsconfig.json!");
	});

	it.each([[], ["--help"], ["-h"]])("shows root usage without building: %j", (...args) => {
		const result = runCli(args);

		expectExit(result);
		expect(result.output).toContain("rbxtsc <subcommand>");
		expect(result.output).toContain("Build a project");
		expect(result.output).not.toContain("--project");
		expect(result.output).not.toContain("Unable to find tsconfig.json!");
	});

	it.each(["--help", "-h"])("shows build help with %s without building", help => {
		const result = runBuild([help]);

		expectExit(result);
		expect(result.output).toContain("--project");
		expect(result.output).toContain("--watch");
		expect(result.output).toContain("--luau");
		expect(result.output).not.toContain("Unable to find tsconfig.json!");
		for (const flag of HIDDEN_FLAGS) {
			expect(result.output).not.toContain(flag);
		}
	});

	it.each([["--version"], ["-v"], ["build", "--version"]])("shows the compiler version: %j", (...args) => {
		const result = runCli(args);

		expectExit(result);
		expect(result.output).toBe(`rbxtsc v${COMPILER_VERSION}`);
	});
});
