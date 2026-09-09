const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRequire } = require("node:module");
const { createVSIX } = require("@vscode/vsce");

const root = path.resolve(__dirname, "..");
const readManifest = directory => JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8"));

function resolveDependency(directory, name) {
	const localRequire = createRequire(path.join(directory, "package.json"));
	for (const modules of localRequire.resolve.paths(`${name}/package.json`) ?? []) {
		const candidate = path.join(modules, name);
		if (fs.existsSync(path.join(candidate, "package.json"))) {
			return fs.realpathSync(candidate);
		}
	}
	throw new Error(`Cannot resolve ${name} from ${directory}; install and build workspace dependencies first`);
}

// materialize pnpm links and preserve conflicting versions through nested node_modules
function copyDependencies(source, destination, ancestors = new Map()) {
	const manifest = readManifest(source);
	for (const name of Object.keys(manifest.dependencies ?? {})) {
		const dependency = resolveDependency(source, name);
		manifest.dependencies[name] = readManifest(dependency).version;
		if (ancestors.get(name) === dependency) {
			continue;
		}

		const target = path.join(destination, "node_modules", name);
		fs.cpSync(dependency, target, {
			recursive: true,
			dereference: true,
			filter: file => !["node_modules", ".git"].includes(path.basename(file)),
		});
		const available = new Map(ancestors);
		available.set(name, dependency);
		copyDependencies(dependency, target, available);
	}

	// workspace protocols and development scripts do not belong in the installed extension
	delete manifest.devDependencies;
	delete manifest.scripts;
	fs.writeFileSync(path.join(destination, "package.json"), JSON.stringify(manifest, undefined, "\t") + "\n");
}

async function main() {
	const stage = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "vscode-roblox-ts-vsix-")));
	try {
		for (const name of ["out", "README.md", "IMPORT.md", "icon.png", ".vscodeignore"]) {
			fs.cpSync(path.join(root, name), path.join(stage, name), { recursive: true });
		}
		copyDependencies(root, stage);
		const manifest = readManifest(root);
		const packagePath = path.resolve(
			process.argv[2] ?? path.join(root, `${manifest.name}-${manifest.version}.vsix`),
		);
		await createVSIX({
			cwd: stage,
			packagePath,
			dependencies: true,
			useYarn: false,
			allowMissingRepository: false,
			skipLicense: true,
		});
		console.log(`Packaged ${packagePath}`);
	} finally {
		fs.rmSync(stage, { recursive: true, force: true });
	}
}

main().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
