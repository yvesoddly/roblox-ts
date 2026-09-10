const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const ts = require(process.env.TYPESCRIPT_PATH || "typescript");
const init = require(process.env.PLUGIN_PATH || "..");

const diagnosticCode = 1800000;

// use a real TypeScript service with a minimal tsserver project adapter
function createProject(t, files, config = {}, options = {}) {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rbxts-language-service-"));
	t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
	const filePath = name => path.join(directory, name);
	for (const [name, text] of Object.entries(files)) {
		fs.mkdirSync(path.dirname(filePath(name)), { recursive: true });
		fs.writeFileSync(filePath(name), text);
	}
	fs.writeFileSync(
		filePath("package.json"),
		JSON.stringify({
			devDependencies: options.nonRoblox ? {} : { "@rbxts/compiler-types": "*" },
		}),
	);
	if (options.rojo) {
		fs.writeFileSync(filePath("default.project.json"), JSON.stringify(options.rojo));
	}

	const compilerOptions = {
		strict: true,
		target: ts.ScriptTarget.ES2015,
		module: ts.ModuleKind.CommonJS,
		moduleResolution: ts.ModuleResolutionKind.Node10,
		rootDir: filePath("src"),
		outDir: filePath("out"),
		types: [],
	};
	const host = {
		...ts.sys,
		useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
		getCompilationSettings: () => compilerOptions,
		getScriptFileNames: () =>
			Object.keys(files)
				.filter(name => name.endsWith(".ts"))
				.map(filePath),
		getScriptVersion: () => "0",
		getScriptSnapshot: name => {
			const text = ts.sys.readFile(name);
			return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
		},
		getCurrentDirectory: () => directory,
		getDefaultLibFileName: settings => ts.getDefaultLibFilePath(settings),
	};
	const service = ts.createLanguageService(host);
	t.after(() => service.dispose());
	const plugin = init({ typescript: ts });
	const info = {
		languageService: service,
		languageServiceHost: host,
		serverHost: ts.sys,
		config: { useRojo: false, client: ["src/client"], server: ["src/server"], ...config },
		project: {
			getCurrentDirectory: () => directory,
			getCompilerOptions: () => compilerOptions,
			projectService: {
				logger: { info() {} },
				getHostFormatCodeOptions: () => ({}),
				getHostPreferences: () => ({}),
			},
		},
	};
	const proxy = plugin.create(info);
	return { service, proxy, plugin, info, filePath };
}

test("leaves non-roblox projects untouched and avoids double injection", t => {
	const plain = createProject(t, { "src/index.ts": "const value = 1;" }, {}, { nonRoblox: true });
	assert.equal(plain.proxy, plain.service);

	const roblox = createProject(t, { "src/index.ts": "const value = 1;" });
	assert.notEqual(roblox.proxy, roblox.service);
	assert.equal(roblox.plugin.create({ ...roblox.info, languageService: roblox.proxy }), roblox.proxy);
	assert.deepEqual(roblox.proxy.getSyntacticDiagnostics(roblox.filePath("src/index.ts")), []);
});

test("reports value imports across boundaries, preserves TS diagnostics, and offers type-only fix", t => {
	const source = 'import { remote } from "../server/remote";\nconst wrong: number = "text";\nremote;';
	const project = createProject(t, {
		"src/client/index.ts": source,
		"src/server/remote.ts": "export const remote = 1;",
	});
	const file = project.filePath("src/client/index.ts");
	const diagnostics = project.proxy.getSemanticDiagnostics(file);
	assert.ok(diagnostics.some(diagnostic => diagnostic.code === 2322));
	const boundary = diagnostics.filter(diagnostic => diagnostic.code === diagnosticCode);
	assert.equal(boundary.length, 1);
	assert.equal(boundary[0].category, ts.DiagnosticCategory.Warning);
	assert.equal(boundary[0].messageText, "Cannot import Server module from Client");
	assert.equal(source.slice(boundary[0].start, boundary[0].start + boundary[0].length), source.split("\n")[0]);

	const fix = project.proxy
		.getCodeFixesAtPosition(file, 0, 6, [diagnosticCode], {}, {})
		.find(action => action.fixName === "crossBoundaryImport");
	assert.ok(fix);
	const change = fix.changes[0];
	assert.equal(change.fileName, file);
	assert.deepEqual(change.textChanges, [{ newText: "import type", span: { start: 0, length: 6 } }]);
});

test("permits type-only and shared imports and invalidates boundaries on configuration changes", t => {
	const project = createProject(t, {
		"src/client/index.ts":
			'import type { Remote } from "../server/remote";\nimport { common } from "../shared/common";\ncommon;',
		"src/server/remote.ts": "export interface Remote {}",
		"src/shared/common.ts": "export const common = 1;",
	});
	const file = project.filePath("src/client/index.ts");
	assert.deepEqual(project.proxy.getSemanticDiagnostics(file), []);

	project.plugin.onConfigurationChanged({ server: ["src/shared"], diagnosticsMode: "error" });
	const diagnostics = project.proxy.getSemanticDiagnostics(file);
	assert.equal(diagnostics.length, 1);
	assert.equal(diagnostics[0].category, ts.DiagnosticCategory.Error);
	assert.equal(diagnostics[0].messageText, "Cannot import Server module from Client");

	project.plugin.onConfigurationChanged({ diagnosticsMode: "off" });
	assert.deepEqual(project.proxy.getSemanticDiagnostics(file), []);
});

test("filters hidden and optionally deprecated member completions", t => {
	const source = [
		"interface API {",
		"/** @hidden */ secret: number;",
		"/** @deprecated */ legacy: number;",
		"visible: number;",
		"}",
		"declare const api: API;",
		"api.",
	].join("\n");
	const project = createProject(t, { "src/client/index.ts": source });
	const file = project.filePath("src/client/index.ts");
	const names = () =>
		project.proxy
			.getCompletionsAtPosition(file, source.length, {})
			.entries.map(entry => entry.name)
			.sort();
	assert.deepEqual(names(), ["legacy", "visible"]);
	project.plugin.onConfigurationChanged({ hideDeprecated: true });
	assert.deepEqual(names(), ["visible"]);
});

test("prefixes cross-boundary auto imports, resolves their details, and supports remove mode", t => {
	const source = "export {};\nRemote";
	const project = createProject(t, {
		"src/client/index.ts": source,
		"src/server/remote.ts": "export class RemoteThing {}",
	});
	const file = project.filePath("src/client/index.ts");
	const preferences = { includeCompletionsForModuleExports: true, includeCompletionsWithInsertText: true };
	const entries = project.proxy.getCompletionsAtPosition(file, source.length, preferences).entries;
	const entry = entries.find(entry => entry.name === "Server: RemoteThing");
	assert.ok(entry);
	assert.equal(entry.insertText, "RemoteThing");
	const details = project.proxy.getCompletionEntryDetails(
		file,
		source.length,
		entry.name,
		{},
		entry.source,
		preferences,
		entry.data,
	);
	assert.ok(details);
	assert.ok(
		details.codeActions
			.flatMap(action => action.changes)
			.flatMap(change => change.textChanges)
			.some(change => change.newText.includes('from "../server/remote"')),
	);

	// upstream recognizes the legacy action description, not modern TypeScript's "Add import from"
	const originalDetails = project.service.getCompletionEntryDetails;
	project.service.getCompletionEntryDetails = (...args) => {
		const result = originalDetails(...args);
		for (const action of result.codeActions ?? []) {
			action.description = "Import 'RemoteThing' from module '../server/remote'";
		}
		return result;
	};
	// TypeScript accepts either separator but returns forward-slash paths in code actions
	const normalizedFile = ts.normalizePath(file);
	for (const fileName of [normalizedFile, normalizedFile.replace(/\//g, "\\")]) {
		const legacyDetails = project.proxy.getCompletionEntryDetails(
			fileName,
			source.length,
			entry.name,
			{},
			entry.source,
			preferences,
			entry.data,
		);
		assert.ok(
			legacyDetails.codeActions
				.flatMap(action => action.changes)
				.flatMap(change => change.textChanges)
				.some(change => change.newText.includes("import type { RemoteThing }")),
		);
	}

	project.plugin.onConfigurationChanged({ mode: "remove" });
	assert.ok(
		!project.proxy
			.getCompletionsAtPosition(file, source.length, preferences)
			.entries.some(entry => entry.name.includes("RemoteThing")),
	);
});

test("uses the shipped Rojo resolver to map source imports through output paths", t => {
	const project = createProject(
		t,
		{
			"src/client/index.ts": 'import { remote } from "../server/remote";\nremote;',
			"src/server/remote.ts": "export const remote = 1;",
		},
		{ useRojo: true, client: [], server: [] },
		{
			rojo: {
				name: "LanguageServiceTest",
				tree: {
					$className: "DataModel",
					StarterPlayer: {
						$className: "StarterPlayer",
						StarterPlayerScripts: { $className: "StarterPlayerScripts", $path: "out/client" },
					},
					ServerScriptService: { $className: "ServerScriptService", $path: "out/server" },
				},
			},
		},
	);
	const diagnostics = project.proxy.getSemanticDiagnostics(project.filePath("src/client/index.ts"));
	assert.equal(diagnostics.length, 1);
	assert.equal(diagnostics[0].messageText, "Cannot import Server module from Client");
});

test("falls back to the host service when plugin analysis throws", t => {
	const project = createProject(t, { "src/client/index.ts": "const value: number = 1;" });
	const file = project.filePath("src/client/index.ts");
	project.service.getProgram = () => {
		throw new Error("host program unavailable");
	};
	const messages = [];
	t.mock.method(console, "error", (...args) => messages.push(args.join(" ")));
	assert.deepEqual(project.proxy.getSemanticDiagnostics(file), []);
	assert.equal(messages.length, 1);
	assert.match(messages[0], /host program unavailable/);
});
