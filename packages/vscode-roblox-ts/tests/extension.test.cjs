const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { EventEmitter: NodeEventEmitter } = require("node:events");
const { test } = require("node:test");

const root = process.env.EXTENSION_ROOT ?? path.resolve(__dirname, "..");
const commands = new Map();
const providers = new Map();
const settings = new Map();
const messages = [];
const killed = [];
const spawned = [];
const opened = [];
const configurations = [];
const disposable = { dispose() {} };
let nextPid = 123;

class EventEmitter {
	listeners = [];
	event = listener => {
		this.listeners.push(listener);
		return disposable;
	};
	fire(value) {
		for (const listener of this.listeners) {
			listener(value);
		}
	}
	dispose() {
		this.listeners = [];
	}
}

const vscode = {
	EventEmitter,
	Range: class {
		constructor(start, end) {
			this.start = start;
			this.end = end;
		}
	},
	ViewColumn: { Beside: 2, Active: 1 },
	StatusBarAlignment: { Right: 2 },
	Uri: { file: file => file },
	extensions: {
		getExtension: () => ({
			activate: async () => {},
			exports: { getAPI: () => ({ configurePlugin: (...args) => configurations.push(args) }) },
		}),
	},
	commands: {
		registerCommand: (name, callback) => {
			commands.set(name, callback);
			return disposable;
		},
		executeCommand: () => Promise.resolve(),
	},
	workspace: {
		getConfiguration: section => ({ get: (key, fallback) => settings.get(`${section}.${key}`) ?? fallback }),
		onDidChangeConfiguration: () => disposable,
		openTextDocument: async file => ({ fileName: file }),
	},
	window: {
		onDidChangeActiveTextEditor: () => disposable,
		createStatusBarItem: () => ({ ...disposable, show() {}, hide() {} }),
		createTerminal: () => ({ ...disposable, show() {} }),
		showErrorMessage: message => {
			messages.push(message);
			return Promise.resolve();
		},
		showTextDocument: async (document, column) => opened.push([document.fileName, column]),
	},
	languages: {
		registerColorProvider: (language, provider) => {
			providers.set(language, provider);
			return disposable;
		},
	},
};

// exercise emitted extension code with only the host and process boundary substituted
const originalLoad = Module._load;
Module._load = function (name, ...args) {
	if (name === "vscode") {
		return vscode;
	}
	if (name === "tree-kill") {
		return pid => killed.push(pid);
	}
	if (name === "child_process") {
		return {
			spawn: (...arguments_) => {
				const child = new NodeEventEmitter();
				child.pid = nextPid;
				child.stdout = new NodeEventEmitter();
				child.stderr = new NodeEventEmitter();
				spawned.push({ arguments_, child });
				return child;
			},
		};
	}
	return originalLoad.call(this, name, ...args);
};
const extension = require(path.join(root, "out/extension.js"));
Module._load = originalLoad;

async function fixture(t) {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rbxts-extension-test-"));
	fs.mkdirSync(path.join(directory, "src"));
	fs.mkdirSync(path.join(directory, "out"));
	fs.writeFileSync(path.join(directory, "src/main.ts"), "export {};\n");
	fs.writeFileSync(
		path.join(directory, "package.json"),
		JSON.stringify({ name: "fixture", scripts: { watch: "rbxtsc -w" } }),
	);
	fs.writeFileSync(
		path.join(directory, "tsconfig.json"),
		JSON.stringify({ compilerOptions: { rootDir: "src", outDir: "out" } }),
	);
	vscode.window.activeTextEditor = {
		document: {
			fileName: path.join(directory, "src/main.ts"),
			uri: { fsPath: path.join(directory, "src/main.ts") },
		},
	};
	settings.clear();
	messages.length = 0;
	spawned.length = 0;
	killed.length = 0;
	opened.length = 0;
	const context = { subscriptions: [] };
	await extension.activate(context);
	t.after(() => {
		for (const subscription of context.subscriptions) {
			subscription.dispose();
		}
		fs.rmSync(directory, { recursive: true, force: true });
	});
	return directory;
}

test("activation forwards plugin configuration and registers TypeScript color providers", async t => {
	await fixture(t);
	settings.set("roblox-ts.boundary.mode", "prefix");
	settings.set("roblox-ts.boundary.paths.clientPaths", ["src/client"]);
	settings.set("roblox-ts.editor.hideDeprecated", false);
	extension.configurePlugin({ configurePlugin: (...args) => configurations.push(args) });
	const [name, configuration] = configurations.at(-1);
	assert.equal(name, "roblox-ts-extensions");
	assert.equal(configuration.mode, "prefix");
	assert.deepEqual(configuration.client, ["src/client"]);
	assert.equal(configuration.hideDeprecated, false);
	assert.deepEqual([...commands.keys()], ["roblox-ts.openOutput", "roblox-ts.start", "roblox-ts.stop"]);
	assert.equal(providers.get("typescript"), providers.get("typescriptreact"));

	const source = "const color = Color3.fromRGB(255, 0, 128);";
	const document = { getText: () => source, positionAt: offset => offset };
	const [information] = providers.get("typescript").provideDocumentColors(document);
	assert.equal(information.color.red, 1);
	assert.equal(information.color.green, 0);
	assert.equal(information.color.blue, 128 / 255);
	assert.equal(source.slice(information.range.start, information.range.end), "Color3.fromRGB(255, 0, 128)");
});

test("Open Output prefers Luau, falls back to Lua, and honors editor placement", async t => {
	const directory = await fixture(t);
	const lua = path.join(directory, "out/main.lua");
	const luau = path.join(directory, "out/main.luau");
	fs.writeFileSync(lua, "return nil");
	fs.writeFileSync(luau, "return nil");
	commands.get("roblox-ts.openOutput")();
	await Promise.resolve();
	assert.deepEqual(opened.pop(), [luau, vscode.ViewColumn.Beside]);

	fs.unlinkSync(luau);
	settings.set("roblox-ts.openOutputToSide", false);
	commands.get("roblox-ts.openOutput")();
	await Promise.resolve();
	assert.deepEqual(opened.pop(), [lua, vscode.ViewColumn.Active]);
});

test("compiler commands choose configured npm scripts and stop the process tree", async t => {
	const directory = await fixture(t);
	settings.set("roblox-ts.command.npm.useNpmScripts", true);
	settings.set("roblox-ts.command.npm.watchScriptArgs", ["--", "--verbose"]);
	await commands.get("roblox-ts.start")();
	assert.deepEqual(spawned[0].arguments_, [
		"npm",
		["run", "watch", "--", "--verbose"],
		{ cwd: directory, shell: true },
	]);
	await commands.get("roblox-ts.stop")();
	assert.deepEqual(killed, [123]);
});

test("failed compiler spawn reports the error without killing an undefined PID", async t => {
	await fixture(t);
	nextPid = undefined;
	t.after(() => {
		nextPid = 123;
	});
	await commands.get("roblox-ts.start")();
	spawned[0].child.emit("error", new Error("spawn failed"));
	assert.equal(
		messages.some(message => message.includes("spawn failed")),
		true,
	);
	assert.deepEqual(killed, []);
});
